import base64
import http.client
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
import wave
from io import BytesIO

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import make_handler  # noqa: E402
from service import ChatterboxService, ServiceError, VoiceStore, encode_wav, resolve_device  # noqa: E402
from http.server import ThreadingHTTPServer  # noqa: E402


class FakeModel:
    """Stands in for ChatterboxMultilingualTTS: records generate() calls and
    returns nested-list samples so no torch/chatterbox install is needed."""

    sr = 24000

    def __init__(self):
        self.calls = []

    def generate(self, text, language_id, audio_prompt_path=None):
        self.calls.append(
            {"text": text, "language_id": language_id, "audio_prompt_path": audio_prompt_path}
        )
        return [[0.0, 0.25, -0.25, 0.5]]


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.model = FakeModel()
        self.loader_calls = []

        def loader(device):
            self.loader_calls.append(device)
            return self.model

        self.service = ChatterboxService(
            VoiceStore(Path(self.tmp.name) / "voices"),
            model_loader=loader,
            device="cpu",
        )
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.service))
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.shutdown)

    def request(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request(method, path, body=body, headers=headers or {})
        response = conn.getresponse()
        data = response.read()
        conn.close()
        return response.status, dict(response.getheaders()), data

    def clone_multipart(self, audio=b"fake-audio-bytes", name="Grandma"):
        boundary = "----voxtree-test-boundary"
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="name"\r\n\r\n{name}\r\n'
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="sample.mp3"\r\n'
            f"Content-Type: audio/mpeg\r\n\r\n"
        ).encode() + audio + f"\r\n--{boundary}--\r\n".encode()
        status, _, data = self.request(
            "POST", "/voices/clone", body,
            {"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        self.assertEqual(status, 201, data)
        return json.loads(data)["voice_id"]

    def test_health_reports_unloaded_model(self):
        status, _, data = self.request("GET", "/health")
        self.assertEqual(status, 200)
        payload = json.loads(data)
        self.assertEqual(payload["status"], "ok")
        self.assertFalse(payload["model_loaded"])
        self.assertEqual(payload["device"], "cpu")
        self.assertEqual(payload["voices"], 0)
        self.assertEqual(self.loader_calls, [])  # health must not load the model

    def test_clone_multipart_stores_reference(self):
        voice_id = self.clone_multipart()
        self.assertTrue(voice_id.startswith("cb_"))
        stored = Path(self.tmp.name) / "voices" / voice_id / "reference.mp3"
        self.assertEqual(stored.read_bytes(), b"fake-audio-bytes")
        meta = json.loads((stored.parent / "meta.json").read_text())
        self.assertEqual(meta["name"], "Grandma")
        self.assertEqual(self.loader_calls, [])  # cloning needs no model

    def test_clone_json_base64(self):
        body = json.dumps({
            "name": "Grandpa",
            "audio_base64": base64.b64encode(b"wav-bytes").decode(),
            "filename": "ref.wav",
        }).encode()
        status, _, data = self.request("POST", "/voices/clone", body,
                                       {"Content-Type": "application/json"})
        self.assertEqual(status, 201, data)
        voice_id = json.loads(data)["voice_id"]
        stored = Path(self.tmp.name) / "voices" / voice_id / "reference.wav"
        self.assertEqual(stored.read_bytes(), b"wav-bytes")

    def test_clone_from_local_path(self):
        source = Path(self.tmp.name) / "take.wav"
        source.write_bytes(b"local-audio")
        body = json.dumps({"name": "Aunt", "audio_path": str(source)}).encode()
        status, _, data = self.request("POST", "/voices/clone", body,
                                       {"Content-Type": "application/json"})
        self.assertEqual(status, 201, data)
        voice_id = json.loads(data)["voice_id"]
        stored = Path(self.tmp.name) / "voices" / voice_id / "reference.wav"
        self.assertEqual(stored.read_bytes(), b"local-audio")

    def test_clone_raw_body(self):
        status, _, data = self.request(
            "POST", "/voices/clone?name=Raw&filename=take.mp3", b"raw-audio",
            {"Content-Type": "audio/mpeg"})
        self.assertEqual(status, 201, data)
        voice_id = json.loads(data)["voice_id"]
        stored = Path(self.tmp.name) / "voices" / voice_id / "reference.mp3"
        self.assertEqual(stored.read_bytes(), b"raw-audio")

    def test_clone_rejects_empty_audio(self):
        body = json.dumps({"name": "Nobody", "audio_base64": ""}).encode()
        status, _, _ = self.request("POST", "/voices/clone", body,
                                    {"Content-Type": "application/json"})
        self.assertEqual(status, 400)

    def test_tts_uses_stored_reference_and_reports_char_count(self):
        voice_id = self.clone_multipart()
        body = json.dumps({"voice_id": voice_id, "text": "Once upon a time"}).encode()
        status, headers, data = self.request("POST", "/tts", body,
                                             {"Content-Type": "application/json"})
        self.assertEqual(status, 200, data)
        self.assertEqual(headers.get("Content-Type"), "audio/wav")
        self.assertEqual(headers.get("X-Character-Count"), str(len("Once upon a time")))
        self.assertEqual(self.loader_calls, ["cpu"])  # lazy load on first synthesis
        self.assertEqual(len(self.model.calls), 1)
        call = self.model.calls[0]
        self.assertEqual(call["text"], "Once upon a time")
        self.assertEqual(call["language_id"], "en")
        expected_ref = str(Path(self.tmp.name) / "voices" / voice_id / "reference.mp3")
        self.assertEqual(call["audio_prompt_path"], expected_ref)
        # Response is a valid WAV at the model's sample rate.
        with wave.open(BytesIO(data), "rb") as wav:
            self.assertEqual(wav.getframerate(), 24000)
            self.assertEqual(wav.getnframes(), 4)
        # Second call reuses the loaded model.
        self.request("POST", "/tts", body, {"Content-Type": "application/json"})
        self.assertEqual(self.loader_calls, ["cpu"])
        _, _, health = self.request("GET", "/health")
        self.assertTrue(json.loads(health)["model_loaded"])

    def test_tts_unknown_voice_404(self):
        body = json.dumps({"voice_id": "cb_missing", "text": "hello"}).encode()
        status, _, data = self.request("POST", "/tts", body,
                                       {"Content-Type": "application/json"})
        self.assertEqual(status, 404)
        self.assertIn("error", json.loads(data))

    def test_tts_rejects_empty_text(self):
        voice_id = self.clone_multipart()
        body = json.dumps({"voice_id": voice_id, "text": "  "}).encode()
        status, _, _ = self.request("POST", "/tts", body,
                                    {"Content-Type": "application/json"})
        self.assertEqual(status, 400)

    def test_delete_removes_reference_then_404(self):
        voice_id = self.clone_multipart()
        voice_dir = Path(self.tmp.name) / "voices" / voice_id
        status, _, _ = self.request("DELETE", f"/voices/{voice_id}")
        self.assertEqual(status, 200)
        self.assertFalse(voice_dir.exists())
        status, _, _ = self.request("DELETE", f"/voices/{voice_id}")
        self.assertEqual(status, 404)

    def test_voice_id_traversal_rejected(self):
        status, _, _ = self.request("DELETE", "/voices/..%2F..%2Fetc")
        self.assertIn(status, (400, 404))
        with self.assertRaises(ServiceError):
            self.service.store.reference_path("../escape")


class WavAndDeviceTests(unittest.TestCase):
    def test_encode_wav_clamps_and_roundtrips(self):
        data = encode_wav([0.0, 2.0, -2.0], 22050)
        with wave.open(BytesIO(data), "rb") as wav:
            self.assertEqual(wav.getframerate(), 22050)
            self.assertEqual(wav.getnchannels(), 1)
            self.assertEqual(wav.getnframes(), 3)

    def test_device_env_override_wins(self):
        previous = os.environ.get("CHATTERBOX_DEVICE")
        os.environ["CHATTERBOX_DEVICE"] = "cpu"
        try:
            self.assertEqual(resolve_device(), "cpu")
        finally:
            if previous is None:
                del os.environ["CHATTERBOX_DEVICE"]
            else:
                os.environ["CHATTERBOX_DEVICE"] = previous


if __name__ == "__main__":
    unittest.main()
