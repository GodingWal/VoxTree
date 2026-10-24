"""Core logic for the VoxTree Chatterbox voice service.

Chatterbox (Resemble AI, MIT) does voice cloning from a reference recording:
there is no training step. "Cloning" a voice here means storing the consented
reference audio under a generated voice id; synthesis passes that file back to
the model as ``audio_prompt_path`` on every request. Deleting a voice deletes
the stored reference, which is what backs consent revocation.

The model is loaded lazily through an injectable loader so unit tests (and
the clone/delete paths) run without the model, torch, or a GPU.
"""
import json
import os
import re
import shutil
import struct
import threading
import time
import uuid
import wave
from io import BytesIO
from pathlib import Path

VOICE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
DEFAULT_LANGUAGE = "en"


class ServiceError(Exception):
    """HTTP-shaped error raised by the service layer."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def resolve_device():
    """Pick the inference device: CHATTERBOX_DEVICE wins, else CUDA if a
    torch build with a live GPU is importable, else CPU."""
    override = os.environ.get("CHATTERBOX_DEVICE")
    if override:
        return override
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    return "cpu"


def load_default_model(device):
    """Import and load the real Chatterbox model. Kept behind this function
    so importing this module never requires chatterbox-tts or torch.

    Verified against chatterbox-tts 0.1.7 (package ``chatterbox``):
    ``ChatterboxMultilingualTTS.from_pretrained(device=...)`` and
    ``generate(text, language_id, audio_prompt_path=...) -> tensor`` with
    the output sample rate on ``model.sr``.
    """
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    return ChatterboxMultilingualTTS.from_pretrained(device=device)


def _flatten_samples(samples):
    """Duck-typed flattening of a model output (torch tensor, numpy array, or
    nested sequences) into a flat list of floats, without importing torch."""
    if hasattr(samples, "detach"):  # torch tensor
        samples = samples.detach().cpu().numpy()
    if hasattr(samples, "tolist"):
        samples = samples.tolist()
    flat = []

    def walk(value):
        if isinstance(value, (list, tuple)):
            for item in value:
                walk(item)
        else:
            flat.append(float(value))

    walk(samples)
    return flat


def encode_wav(samples, sample_rate):
    """Encode mono float samples in [-1, 1] as 16-bit PCM WAV bytes."""
    flat = _flatten_samples(samples)
    frames = b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in flat
    )
    buffer = BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(int(sample_rate))
        wav.writeframes(frames)
    return buffer.getvalue()


class VoiceStore:
    """Filesystem store for cloned-voice reference audio.

    Layout: ``<root>/<voice_id>/reference<ext>`` plus ``meta.json``.
    The reference audio is biometric data: the store root must live outside
    any web-served directory (the worker's ``data/`` dir is gitignored).
    """

    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _voice_dir(self, voice_id):
        if not VOICE_ID_RE.match(voice_id or ""):
            raise ServiceError(400, "Invalid voice id")
        return self.root / voice_id

    def create(self, name, audio_bytes, filename="reference.wav"):
        if not audio_bytes:
            raise ServiceError(400, "Reference audio is empty")
        voice_id = "cb_" + uuid.uuid4().hex
        voice_dir = self._voice_dir(voice_id)
        voice_dir.mkdir(parents=True)
        suffix = Path(filename or "reference.wav").suffix or ".wav"
        reference = voice_dir / ("reference" + suffix)
        reference.write_bytes(audio_bytes)
        meta = {
            "voice_id": voice_id,
            "name": name or voice_id,
            "reference_file": reference.name,
            "created_at": time.time(),
        }
        (voice_dir / "meta.json").write_text(json.dumps(meta, indent=2))
        return meta

    def create_from_path(self, name, source_path):
        source = Path(source_path or "")
        if not source.is_file():
            raise ServiceError(400, "Reference audio path does not exist")
        return self.create(name, source.read_bytes(), source.name)

    def reference_path(self, voice_id):
        voice_dir = self._voice_dir(voice_id)
        meta_file = voice_dir / "meta.json"
        if not meta_file.is_file():
            raise ServiceError(404, "Voice not found")
        meta = json.loads(meta_file.read_text())
        return voice_dir / meta["reference_file"]

    def delete(self, voice_id):
        voice_dir = self._voice_dir(voice_id)
        if not voice_dir.is_dir():
            raise ServiceError(404, "Voice not found")
        shutil.rmtree(voice_dir)

    def count(self):
        return sum(1 for p in self.root.iterdir() if p.is_dir())


class ChatterboxService:
    """Voice operations over a VoiceStore plus a lazily loaded model."""

    def __init__(self, store, model_loader=load_default_model, device=None):
        self.store = store
        self._model_loader = model_loader
        self._device = device if device is not None else resolve_device()
        self._model = None
        self._model_lock = threading.Lock()
        self._generate_lock = threading.Lock()

    @property
    def device(self):
        return self._device

    @property
    def model_loaded(self):
        return self._model is not None

    def _model_instance(self):
        if self._model is None:
            with self._model_lock:
                if self._model is None:
                    self._model = self._model_loader(self._device)
        return self._model

    def clone_voice(self, name, audio_bytes, filename="reference.wav"):
        return self.store.create(name, audio_bytes, filename)

    def clone_voice_from_path(self, name, source_path):
        return self.store.create_from_path(name, source_path)

    def synthesize(self, voice_id, text, language_id=DEFAULT_LANGUAGE):
        """Returns (wav_bytes, character_count)."""
        if not text or not text.strip():
            raise ServiceError(400, "Text is required")
        reference = self.store.reference_path(voice_id)
        model = self._model_instance()
        # The model is not thread-safe; serialize synthesis.
        with self._generate_lock:
            wav = model.generate(
                text,
                language_id or DEFAULT_LANGUAGE,
                audio_prompt_path=str(reference),
            )
        return encode_wav(wav, model.sr), len(text)

    def delete_voice(self, voice_id):
        self.store.delete(voice_id)

    def health(self):
        return {
            "status": "ok",
            "model_loaded": self.model_loaded,
            "device": self._device,
            "voices": self.store.count(),
        }
