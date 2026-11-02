# VoxTree SeedVC voice service

Self-hosted voice *conversion* for VoxTree, built on
[Seed-VC](https://github.com/Plachtaa/seed-vc) by Plachtaa
(**GPL-3.0 license** — see the license note below). This is VoxTree's
**only** voice engine as of Nov 2, 2026: the Next.js app talks to this
service through `lib/seedvc.ts` (selected by `lib/voice-provider.ts`),
and no voice data ever leaves the host running it.

> **History:** this service replaced the Chatterbox TTS service on
> Nov 2, 2026, on Goding's direction. The contract change is fundamental:
> Seed-VC converts a recorded source performance into the target voice;
> it cannot synthesize speech from text.

## How conversion works here

Seed-VC clones zero-shot from a 1–30 second reference recording — there is
no training step.

- `POST /voices/clone` stores the consented target reference audio under a
  generated `sv_…` voice id in the data dir and returns the id (the app
  stores it as `provider_voice_id`).
- `POST /convert` loads the model lazily, runs
  `SeedVCWrapper.convert_voice(source=<source performance file>,
  target=<stored reference>, diffusion_steps=25, length_adjust=1.0,
  inference_cfg_rate=0.7, f0_condition=False, stream_output=False)`, and
  returns WAV bytes (22,050 Hz; 44,100 Hz with `f0_condition`) plus an
  `X-Source-Bytes` header. The source performance is the master reading of
  the lesson — its timing, prosody, and emotion carry into the output.
  A convert request with no source audio fails with
  `seedvc_requires_source_audio` — there is no text path to fake.
- `DELETE /voices/<id>` removes the stored reference. This is what consent
  revocation calls: once the reference is gone the voice cannot be used.
- `GET /health` reports the engine, whether the model is loaded, the
  device, and the stored-voice count. It never triggers a model load.

Clone accepts three request shapes: multipart form data (`name` + `file`),
JSON (`{name, audio_base64, filename?}` or `{name, audio_path}` to copy a
file already on the host), or a raw audio body with `?name=&filename=`.
Convert accepts multipart (`voice_id` + `source` file + optional option
fields) or JSON (`{voice_id, source_audio_base64, source_filename?,
diffusion_steps?, length_adjust?, inference_cfg_rate?, f0_condition?,
auto_f0_adjust?, pitch_shift?}`).

## Run

Python 3.10+ (upstream suggests 3.10) and a dedicated venv (the dependency
tree — torch, transformers, librosa — is large). Seed-VC is **not on
PyPI**: clone the upstream repo and put it on `PYTHONPATH` so
`seed_vc_wrapper` imports.

```bash
git clone https://github.com/Plachtaa/seed-vc workers/seedvc/seed-vc
python3 -m venv workers/seedvc/.venv
workers/seedvc/.venv/bin/pip install -r workers/seedvc/requirements.txt
PYTHONPATH=workers/seedvc/seed-vc workers/seedvc/.venv/bin/python workers/seedvc/server.py
```

The app finds the service at `SEEDVC_SERVICE_URL`
(default `http://localhost:8001`). Model checkpoints
(`Plachta/Seed-VC` on HuggingFace — the pruned
`seed-uvit-whisper-small-wavenet` DiT for speech, the F0 model for
singing) download automatically on first conversion.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `SEEDVC_HOST` | `127.0.0.1` | Bind address |
| `SEEDVC_PORT` | `8001` | Bind port |
| `SEEDVC_DATA_DIR` | `workers/seedvc/data/voices` | Stored reference audio (**biometric — keep private, never commit**) |
| `SEEDVC_DEVICE` | auto | `cuda` or `cpu`; auto picks CUDA when torch sees a GPU |

## Hardware note

A GPU is **strongly recommended**: conversion is diffusion-based
(25 steps by default) and CPU inference is slow. First conversion
downloads/loads both DiT models, so it is much slower than subsequent
calls; the models then stay resident. Real SeedVC inference has **not**
been run yet in this repo's environments (no GPU in the dev sandbox) —
the first real pass happens on GPU hardware, same as its predecessor.

## License note (read before shipping)

Seed-VC's code is **GPL-3.0** (LICENSE file in Plachtaa/seed-vc,
verified Nov 2, 2026). GPL permits commercial use, but it is copyleft —
unlike the MIT-licensed engine it replaced. Distributing this service
(or a modified Seed-VC) triggers GPL source-availability obligations for
the covered code; running it unmodified as a separate internal service
is the posture this wrapper assumes. The model checkpoints are
distributed via the `Plachta/Seed-VC` HuggingFace repo. **This needs the
planned legal review before public launch** — flag, do not paper over.

## Tests

Stdlib `unittest`, model stubbed — no GPU, torch, or seed-vc install
required:

```bash
python3 -m unittest discover -s workers/seedvc/tests -v
```

## API assumption

Written against Plachtaa/seed-vc main @ `51383ef`, verified from the
repo source (`seed_vc_wrapper.py`, `inference.py`, README):
`SeedVCWrapper(device=...)`; `convert_voice(source, target,
diffusion_steps=10*, length_adjust=1.0, inference_cfg_rate=0.7,
f0_condition=False, auto_f0_adjust=True, pitch_shift=0,
stream_output=True)` — with `stream_output=False` it returns the full
converted waveform (numpy array) at 22,050 Hz (44,100 Hz when
`f0_condition`). (*Upstream wrapper default is 10 steps; this service
defaults to 25, upstream's recommended CLI value for quality.)
