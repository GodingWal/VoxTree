# VoxTree MetaHuman and Lip-Sync Pipeline

## Decision

Use Unreal Engine 5.8 MetaHuman Animator for identity, facial animation, and final playback. Use an offline audio solve for saved voice samples because it produces a deterministic facial sequence and lets Unreal play the facial animation and its source SoundWave from the same frame. Use Pixel Streaming only for experiences that must be interactive.

For the clone-list card, prefer an Unreal-rendered idle loop and a pre-rendered, lip-synced sample clip. Reserve live Pixel Streaming for the clone detail/studio view. This avoids keeping an expensive GPU Unreal instance alive for every small card.

## User experience

1. The clone card initially shows a clean Unreal-rendered portrait or idle loop without UI covering the face.
2. Selecting **Hear Sample** swaps the card media to a short Unreal-rendered performance whose audio and facial animation are encoded together.
3. Opening the clone enters the interactive MetaHuman studio through Pixel Streaming. Pointer or touch input can rotate the camera, trigger emotes, and start dance animations.
4. If the Unreal service is unavailable, the card falls back to the current portrait and audio-only sample.

## System flow

```text
Identity capture             Voice sample
photo/video/mesh             ElevenLabs MP3/WAV
       |                            |
       v                            v
MetaHuman Identity        Unreal SoundWave import
       |                            |
       +---------> MetaHuman Performance <---------+
                         |
                audio-driven face solve
                         |
             AnimSequence + SoundWave
                         |
                 one Level Sequence
                  /              \
                 v                v
      rendered MP4/WebM      Pixel Streaming
        for list cards       for live studio
                 \              /
                  v            v
                    VoxTree UI
```

## Identity creation

1. Collect explicit biometric/likeness consent before processing.
2. Capture a well-lit neutral face video plus teeth visibility; retain front and three-quarter views. A source mesh can also be used when available.
3. In Unreal Engine 5.8, enable MetaHuman Animator, MetaHuman Animator Depth Processing, and MetaHuman Live Link.
4. Create a MetaHuman Identity from video footage or a mesh, solve the neutral pose, add the recommended teeth pose, and conform a MetaHuman Character from that identity.
5. Assemble two variants:
   - **UE Cine** for high-quality rendered sample clips.
   - **UE Optimized** for live Pixel Streaming.

The existing AI-generated full-body image is a concept/reference image only. It is not suitable as the production MetaHuman identity source by itself.

## Lip-sync contract

The saved voice sample is the source of truth.

1. Store a stable `sample_audio_id`, content hash, duration, and Unreal frame rate.
2. Import that exact audio file into Unreal as a SoundWave.
3. Create a MetaHuman Performance asset with `Input Type = Audio` and solve the full face or mouth-region curves.
4. Export an Animation Sequence or Level Sequence.
5. Place the facial animation and original SoundWave at frame zero in the same Level Sequence.
6. Start playback through one Unreal command. Do not separately call `HTMLAudioElement.play()` for the MetaHuman version.
7. Unreal emits `sample_started`, `sample_ended`, and `sample_failed` events to the web client. The web UI derives its button state from these acknowledgements.

Because audio and video originate from one Unreal timeline and one streamed/rendered media track, browser scheduling cannot introduce facial drift.

### Browser-to-Unreal command

```json
{
  "type": "play_sample",
  "requestId": "uuid",
  "cloneId": "uuid",
  "performanceId": "mhperf_uuid",
  "startFrame": 0
}
```

### Unreal-to-browser acknowledgement

```json
{
  "type": "sample_started",
  "requestId": "uuid",
  "performanceId": "mhperf_uuid",
  "timecode": "00:00:00:00"
}
```

## Service boundaries

### VoxTree web application

- Authorizes the user and clone.
- Requests a signed sample-performance URL or a Pixel Streaming session.
- Displays loading, playing, failure, and fallback states.
- Never exposes raw storage credentials or arbitrary Unreal asset paths.

### MetaHuman build worker

- Runs on a trusted Windows GPU worker with Unreal Engine 5.8.
- Imports approved identity inputs and audio assets.
- Creates MetaHuman Performance assets and deterministic sample sequences.
- Renders synchronized card media and publishes versioned outputs.
- Records job logs, engine version, character version, audio hash, and solve settings.

### Pixel Streaming runtime

- Runs a packaged Unreal application, not an editor session.
- Loads only assets authorized for the current session.
- Receives JSON commands through Pixel Streaming input events.
- Returns playback acknowledgements and errors through Pixel Streaming responses.
- Uses STUN/TURN for internet clients and short-lived session tokens.

## Data model additions

```text
family_voices
  metahuman_status             pending | identity_ready | processing | ready | failed
  metahuman_character_id       internal stable identifier
  metahuman_character_version  integer
  metahuman_poster_url         signed or public rendered poster
  metahuman_idle_video_url     rendered idle loop
  metahuman_sample_video_url   rendered synchronized sample
  metahuman_last_error         sanitized failure reason

metahuman_performances
  id, voice_id, audio_sha256, engine_version, character_version
  unreal_sequence_path, rendered_video_url, duration_ms, frame_rate
  status, created_at, updated_at
```

Do not store a public filesystem path to an Unreal asset. Persist an internal identifier and resolve it inside the trusted worker/runtime.

## API surface

```text
POST /api/voices/:id/metahuman/build
GET  /api/voices/:id/metahuman/status
POST /api/voices/:id/metahuman/session
GET  /api/voices/:id/metahuman/sample
```

`session` returns a short-lived Pixel Streaming connection token. `sample` returns a signed URL for the synchronized rendered clip plus its content hash and duration.

## Delivery phases

### Phase 1 — local quality spike

- Build one MetaHuman Identity for the current clone in UE 5.8.
- Import the exact **Hear Sample** audio.
- Produce a MetaHuman Performance and Level Sequence.
- Render a synchronized sample clip and verify mouth timing by frame.
- Acceptance: no visible drift, face unobstructed, and playback starts within 500 ms after cached load.

### Phase 2 — VoxTree integration

- Add the database fields and job records.
- Add the build/status/sample endpoints.
- Replace audio-only playback with the synchronized sample video when ready.
- Keep the current audio/portrait path as fallback.

### Phase 3 — interactive studio

- Package the optimized MetaHuman scene with Pixel Streaming 2.
- Add signed session allocation and browser/Unreal JSON events.
- Support camera orbit, emotes, and dance triggers.
- Keep audio and facial animation under Unreal's single playback clock.

### Phase 4 — production reliability

- Add a GPU worker queue, idempotency by audio/identity hash, retries, and dead-letter handling.
- Warm a small Pixel Streaming pool and scale it by concurrent studio sessions.
- Track session startup latency, render failures, dropped frames, WebRTC RTT, and audio/video sync regressions.

## Trade-offs

- **Pixel Streaming everywhere:** most interactive, but expensive and slow to start for card grids.
- **Pre-rendered samples:** cheapest and most reliable lip sync, but not freely interactive during playback.
- **Recommended hybrid:** pre-rendered list-card media plus Pixel Streaming in the detail/studio view.
- **Realtime Audio Live Link:** useful for unscripted live speech, but the offline audio solve is preferable for the fixed **Hear Sample** because it is repeatable and supports richer facial motion.

## Revisit when usage grows

- Choose single-user versus SFU Pixel Streaming topology from measured concurrency.
- Decide whether to render every generated story or only previews.
- Evaluate regional GPU pools when startup latency or TURN traffic becomes material.
- Version MetaHuman characters and performance solves so older stories remain reproducible.
