# VoxTree Chatterbox voice service

Self-hosted voice cloning + text-to-speech for VoxTree, built on
[Chatterbox](https://github.com/resemble-ai/chatterbox) by Resemble AI
(MIT license). This is VoxTree's **only** voice engine: the Next.js app talks
to this service through `lib/chatterbox.ts` (selected by `lib/voice-provider.ts`),
and no voice data ever leaves the host running it.

## How cloning works here

Chatterbox clones from a reference recording — there is no training step.

- `POST /voices/clone` stores the consented reference audio under a generated
  `cb_…` voice id in the data dir and returns the id (the app stores it as
  `provider_voice_id`).
- `POST /tts` loads the model lazily, runs
  `generate(text, language_id, audio_prompt_path=<stored reference>)`, and
  returns WAV bytes plus an `X-Character-Count` header the app uses for
  usage accounting (`tts_chars_used`).
- `DELETE /voices/<id>` removes the stored reference. This is what consent
  revocation calls: once the reference is gone the voice cannot be used.
- `GET /health` reports whether the model is loaded, the device, and the
  stored-voice count. It never triggers a model load.

Clone accepts three request shapes: multipart form data (`name` + `file`),
JSON (`{name, audio_base64, filename?}` or `{name, audio_path}` to copy a
file already on the host), or a raw audio body with `?name=&filename=`.

## Run

Python 3.11+ and a dedicated venv (the dependency tree — torch, transformers —
is large):

```bash
python3 -m venv workers/chatterbox/.venv
workers/chatterbox/.venv/bin/pip install -r workers/chatterbox/requirements.txt
workers/chatterbox/.venv/bin/python workers/chatterbox/server.py
```

Or with Docker, from this directory, mounting the data dir:

```bash
docker run --rm -p 8001:8001 -v "$PWD/data:/app/data" \
  -e CHATTERBOX_HOST=0.0.0.0 python:3.12-slim sh -c \
  "pip install -r requirements.txt && python server.py"
```

(copy `server.py`, `service.py`, and `requirements.txt` into the image or
bind-mount the directory; the Dockerfile-less form above is for local dev.)

The app finds the service at `CHATTERBOX_SERVICE_URL`
(default `http://localhost:8001`).

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `CHATTERBOX_HOST` | `127.0.0.1` | Bind address |
| `CHATTERBOX_PORT` | `8001` | Bind port |
| `CHATTERBOX_DATA_DIR` | `workers/chatterbox/data/voices` | Stored reference audio (**biometric — keep private, never commit**) |
| `CHATTERBOX_DEVICE` | auto | `cuda` or `cpu`; auto picks CUDA when torch sees a GPU |

## Hardware note

A GPU is **strongly recommended**: Chatterbox is a ~500M-parameter model and
synthesis on CPU works but is slow (well above real time per sentence on
typical hardware). First synthesis downloads/loads the model, so it is much
slower than subsequent calls; the model then stays resident.

## Tests

Stdlib `unittest`, model stubbed — no GPU, torch, or chatterbox install
required:

```bash
python3 -m unittest discover -s workers/chatterbox/tests -v
```

## API assumption

Written against `chatterbox-tts` 0.1.7, verified from the published wheel:
`chatterbox.mtl_tts.ChatterboxMultilingualTTS.from_pretrained(device=...)`,
`generate(text, language_id, audio_prompt_path=...)` returning a waveform
tensor, sample rate on `model.sr` (24 kHz). Generated audio carries
Resemble's Perth watermark, as with all Chatterbox output.
