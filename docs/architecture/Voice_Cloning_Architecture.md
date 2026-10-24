# VoxTree Voice Cloning Architecture

This document outlines the complete technical process of how voice cloning works within the VoxTree platform. VoxTree utilizes a **Hybrid Voice Architecture** to support both highly expressive storytelling (Text-to-Speech) and musical singing (Voice-to-Voice).

---

## 1. The Two Modes of Voice Cloning

VoxTree handles two distinct types of audio generation, each requiring a different AI model architecture:

1. **Text-to-Speech (TTS) for Storytelling:** Used when a family member is reading a book or narrating an educational video. We use **Chatterbox** (Resemble AI, MIT), self-hosted via `workers/chatterbox/`, because it clones from a short reference recording (30–60 seconds) with no training step and no voice data ever leaves our own infrastructure.
2. **Voice-to-Voice (V2V) for Singing:** Used when a family member needs to sing a lullaby or an educational song. We use **RVC (Retrieval-based Voice Conversion)** for this because singing requires perfect preservation of pitch, melody, and vibrato from an original studio track. RVC requires 5 to 10 minutes of clean training audio.

---

## 2. Standard Voice Creation Workflow (Chatterbox / TTS)

When a user creates a standard "Reading Voice" profile, the following data flow occurs:

1. **User Audio Capture:** The user records a 30-second audio snippet directly in the browser or uploads a pre-recorded file.
2. **Secure Upload:** The VoxTree backend generates a Google Cloud Storage (GCS) Pre-signed URL. The audio file is uploaded directly and securely from the user's browser to our private GCS bucket.
3. **Database Entry:** A record is created in the `family_voices` Postgres table with a status of `processing`.
4. **Chatterbox Clone Submission:** The backend sends the audio to the self-hosted Chatterbox service (`POST /voices/clone`). Chatterbox cloning is reference-based — there is no training or model creation; the service stores the reference recording under a generated `cb_…` voice id.
5. **Finalization:** The VoxTree database is updated with the id in `provider_voice_id`, and the voice profile is marked as `ready` for use. Deleting the voice (or revoking consent) calls `DELETE /voices/<id>`, which removes the stored reference so the voice can no longer be synthesized.

---

## 3. Singing Voice Creation Workflow (RVC / V2V)

When a user wants to upgrade their voice profile to a "Singing Model", the process is more intensive:

1. **Dataset Upload:** The user navigates to the "Singing" tab in the Clones dashboard and uploads 5 to 10 minutes of clean, isolated speech.
2. **GPU Worker Hand-off:** Because RVC requires heavy GPU processing, the dataset is sent to **Replicate** (our external GPU inference provider).
3. **Model Training:** Replicate trains a custom RVC model on the user's dataset. This process typically takes 15 to 30 minutes.
4. **Webhook Completion:** Once training is complete, Replicate sends a webhook back to VoxTree, updating the `rvc_model_id` and marking the `rvc_training_status` as `ready` in the database.

---

## 4. Clip Generation Process

When a user selects a Story or Video from the library and clicks "Generate", the system intelligently routes the request based on the content type:

### Path A: The Content is a "Story" (TTS)
1. The system reads the `text_script` attached to the content library item.
2. The `text_script` and the user's `provider_voice_id` are sent to the Chatterbox service (`POST /tts`), which synthesizes speech using the stored reference as the model's audio prompt.
3. Chatterbox returns the generated raw narration audio (WAV) plus a character count used for usage metering (`tts_chars_used`).
4. The VoxTree Next.js API route natively executes FFmpeg (since the app is hosted on Google Cloud Compute) to mix the generated narration with the story's `instrumental_url` (background music/sound effects) and sync it to the video. No separate background worker is needed.

### Path B: The Content is a "Song" (V2V)
1. The system reads the `isolated_vocals_url` (an acapella studio track) attached to the content library item.
2. The `isolated_vocals_url` and the user's `rvc_model_id` are sent to Replicate.
3. The Replicate RVC model uses the original vocal track as a guide, swapping the original singer's voice with the user's cloned voice while keeping the exact same pitch and timing.
4. The Next.js API route natively uses FFmpeg to mix the new vocals with the song's `instrumental_url`.

### Path C: The Content is "Mixed-Mode" (Segments)
1. The system reads the `segments` array attached to the content library item, which defines specific timestamps for different modes.
2. For each segment:
   - If `tts_normal`, the text is sent to the Chatterbox Text-to-Speech endpoint.
   - If `tts_expressive`, the text is sent to Chatterbox with a raised exaggeration setting to capture more emotional delivery.
   - If `v2v_singing`, the guide audio is sent to Replicate.
3. All returned generated audio segments are downloaded temporarily into the API route.
4. The Next.js API route natively uses FFmpeg to stitch the segments together exactly at their `start_time` timestamps, normalizes volume, and mixes them with the `instrumental_url`.

### Delivery
In all paths, the final rendered video/audio file is uploaded to Google Cloud Storage (GCS), the `generated_clips` database record is marked as `ready`, and the media is streamed back to the user's dashboard!
