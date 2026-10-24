"""HTTP entrypoint for the VoxTree Chatterbox voice service.

Stdlib-only HTTP layer (matching workers/avatar_pipeline conventions); all
logic lives in service.py. Run:

    python3 workers/chatterbox/server.py            # 127.0.0.1:8001
    CHATTERBOX_PORT=8001 python3 workers/chatterbox/server.py

Endpoints:
    GET    /health           -> {status, model_loaded, device, voices}
    POST   /voices/clone     -> multipart (name + file), JSON
                                {name, audio_base64 | audio_path}, or a raw
                                audio body (?name=...); returns {voice_id}
    POST   /tts              -> JSON {voice_id, text, language_id?}; returns
                                audio/wav with X-Character-Count header
    DELETE /voices/<id>      -> removes the stored reference audio (404 when
                                already gone; callers treat that as success)
"""
import argparse
import base64
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from service import ChatterboxService, ServiceError, VoiceStore

MAX_BODY_BYTES = 64 * 1024 * 1024


def parse_multipart(body, content_type):
    """Minimal multipart/form-data parser: returns (fields, files) where
    files maps field name -> (filename, bytes). Sufficient for the single
    audio upload this service accepts."""
    boundary = None
    for part in content_type.split(";"):
        part = part.strip()
        if part.startswith("boundary="):
            boundary = part[len("boundary="):].strip('"')
    if not boundary:
        raise ServiceError(400, "Missing multipart boundary")
    delimiter = b"--" + boundary.encode()
    fields, files = {}, {}
    for segment in body.split(delimiter)[1:]:
        if segment.startswith(b"--"):  # closing delimiter
            break
        # Each part is wrapped as CRLF <headers> CRLF CRLF <payload> CRLF.
        if segment.startswith(b"\r\n"):
            segment = segment[2:]
        if segment.endswith(b"\r\n"):
            segment = segment[:-2]
        header_blob, sep, payload = segment.partition(b"\r\n\r\n")
        if not sep:
            continue
        disposition = ""
        for line in header_blob.decode("utf-8", "replace").split("\r\n"):
            if line.lower().startswith("content-disposition:"):
                disposition = line
        name = filename = None
        for token in disposition.split(";"):
            token = token.strip()
            if token.startswith("name="):
                name = token[len("name="):].strip('"')
            elif token.startswith("filename="):
                filename = token[len("filename="):].strip('"')
        if name is None:
            continue
        if filename is not None:
            files[name] = (filename, payload)
        else:
            fields[name] = payload.decode("utf-8", "replace")
    return fields, files


def make_handler(service):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *args):  # keep stdout clean
            pass

        def _send_json(self, status, payload):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _send_error(self, err):
            if isinstance(err, ServiceError):
                self._send_json(err.status, {"error": err.message})
            else:
                self._send_json(500, {"error": str(err)})

        def _read_body(self):
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY_BYTES:
                raise ServiceError(413, "Request body too large")
            return self.rfile.read(length) if length else b""

        def do_GET(self):
            try:
                if urlparse(self.path).path == "/health":
                    self._send_json(200, service.health())
                else:
                    self._send_json(404, {"error": "Not found"})
            except Exception as err:  # noqa: BLE001 - surface as JSON 500
                self._send_error(err)

        def do_POST(self):
            try:
                path = urlparse(self.path).path
                if path == "/voices/clone":
                    self._handle_clone()
                elif path == "/tts":
                    self._handle_tts()
                else:
                    self._send_json(404, {"error": "Not found"})
            except Exception as err:  # noqa: BLE001
                self._send_error(err)

        def do_DELETE(self):
            try:
                path = urlparse(self.path).path
                if path.startswith("/voices/"):
                    service.delete_voice(path[len("/voices/"):])
                    self._send_json(200, {"deleted": True})
                else:
                    self._send_json(404, {"error": "Not found"})
            except Exception as err:  # noqa: BLE001
                self._send_error(err)

        def _handle_clone(self):
            content_type = self.headers.get("Content-Type") or ""
            body = self._read_body()
            if content_type.startswith("multipart/form-data"):
                fields, files = parse_multipart(body, content_type)
                upload = files.get("file") or files.get("audio")
                if upload is None:
                    raise ServiceError(400, "Multipart body must include an audio file field")
                filename, audio = upload
                meta = service.clone_voice(fields.get("name", ""), audio, filename)
            elif content_type.startswith("application/json"):
                payload = json.loads(body or b"{}")
                name = payload.get("name", "")
                if payload.get("audio_base64"):
                    audio = base64.b64decode(payload["audio_base64"])
                    meta = service.clone_voice(name, audio, payload.get("filename", "reference.wav"))
                elif payload.get("audio_path"):
                    meta = service.clone_voice_from_path(name, payload["audio_path"])
                else:
                    raise ServiceError(400, "JSON clone requires audio_base64 or audio_path")
            else:
                # Raw audio upload; name (and optional filename) via query string.
                query = parse_qs(urlparse(self.path).query)
                name = (query.get("name") or [""])[0]
                filename = (query.get("filename") or ["reference.wav"])[0]
                meta = service.clone_voice(name, body, filename)
            self._send_json(201, {"voice_id": meta["voice_id"], "name": meta["name"]})

        def _handle_tts(self):
            payload = json.loads(self._read_body() or b"{}")
            voice_id = payload.get("voice_id")
            text = payload.get("text")
            if not voice_id:
                raise ServiceError(400, "voice_id is required")
            wav_bytes, char_count = service.synthesize(
                voice_id, text or "", payload.get("language_id")
            )
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav_bytes)))
            self.send_header("X-Character-Count", str(char_count))
            self.end_headers()
            self.wfile.write(wav_bytes)

    return Handler


def main(argv=None):
    parser = argparse.ArgumentParser(description="VoxTree Chatterbox voice service")
    parser.add_argument("--host", default=os.environ.get("CHATTERBOX_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("CHATTERBOX_PORT", "8001")))
    parser.add_argument(
        "--data-dir",
        default=os.environ.get(
            "CHATTERBOX_DATA_DIR", str(Path(__file__).resolve().parent / "data" / "voices")
        ),
    )
    args = parser.parse_args(argv)
    service = ChatterboxService(VoiceStore(args.data_dir))
    server = ThreadingHTTPServer((args.host, args.port), make_handler(service))
    print(f"chatterbox voice service listening on http://{args.host}:{args.port} "
          f"(device={service.device}, data={args.data_dir})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
