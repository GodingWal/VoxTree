# VoxTree custom avatar worker — prototype

First implementation of the Blender → RenderMan path, independent of Unreal.
This is an offline, synthetic-only prototype, not a new public avatar endpoint.
The existing portrait endpoints do not call this worker.

## Implemented

- Strict versioned JSON input with bounded identity weights and ordered viseme cues.
- Artist-authored, shared-rig scene validation before personalization.
- Face/body shape-key application while retaining the scene's skeletal animation.
- Basic viseme envelopes (not a phoneme recognizer or production lip-sync solver).
- Save a personalized Blender scene; optionally invoke RenderMan with no fallback.
- Exclusive job output directories: repeated IDs fail instead of overwriting output.
- A geometric fixture generator for exercising the plumbing without biometric data.

## Run

Python 3.10+ is sufficient for contract tests:

```bash
python3 -m unittest discover -s workers/avatar_pipeline/tests -v
```

On a workstation with Blender installed, run from the repository root:

```bash
blender --background --factory-startup --python-exit-code 1 --python workers/avatar_pipeline/create_fixture.py -- /tmp/voxtree-fixture.blend
blender --background --disable-autoexec /tmp/voxtree-fixture.blend --python-exit-code 1 --python workers/avatar_pipeline/blender_worker.py -- --manifest workers/avatar_pipeline/examples/synthetic-avatar.json --output-root /tmp/voxtree-jobs
```

The fixture consists of two deformable spheres. Its shapes are deliberately generic;
it proves naming/binding mechanics, not likeness, artistic quality, or real lip motion.
No render is requested by default. Inspect `personalized.blend` in the output folder.

For RenderMan, install and enable a mutually compatible Blender/RenderMan-for-Blender
pair and configure licensed rendering, materials, lights, camera and RenderMan output
displays in a trusted studio template. Run the worker with that template and `--render`
using a new job ID/output root. The worker selects `PRMAN_RENDER`; missing support fails.
RenderMan display settings can govern output independently of Blender's output path.
Validate those settings on the worker image; this prototype does not certify generated
frames or encode a final movie. `render_operator_finished` is not a publication status.

## Studio asset contract

- Scene custom property `voxtree_rig_version = voxtree-adult-v1` and an active camera.
- Armature `VT_Rig`; meshes `VT_Face` and `VT_Body`, each with an armature modifier
  targeting that rig and artist-validated weights.
- Body shape `VT_body_build`. Face shapes: `VT_face_width`, `VT_jaw_width`,
  `VT_nose_width`, `VT_nose_length`, `VT_eye_spacing`, `VT_cheek_fullness`.
- Face mouth shapes `VT_viseme_` plus every name in `contract.VISEMES`.
- Shape keys must have no existing animation/drivers. Master expressions belong on
  the skeletal facial rig in this prototype. Skeletal actions/NLA remain untouched.
- Morphs use [0,1], with zero the authored neutral. Omitted morphs reset to zero.
- Cue times are seconds relative to frame_start, sorted and non-overlapping.

## Boundaries and next milestones

There is no photo fitting model, body measurement inference, hair/clothing selection,
voice generation, speech alignment, contact correction, queue, database write, upload,
or production base character in this change. Do not label its output a user clone.

1. Create and validate the production base mesh, identity shapes and facial rig.
2. Verify this worker on the pinned Blender/RenderMan image, including output displays,
   frame completeness, skeleton preservation and visual regressions for diverse shapes.
3. Add a photo-to-parameter fitting adapter, with user-reviewed likeness and quality gates.
4. Add voice synthesis/alignment and replace basic mouth envelopes with tested coarticulation.
5. Integrate a server-owned queue with authenticated ownership checks and active consent
   checked before dispatch, before rendering, and before publishing; handle revocation,
   cancellation, deletion races and private asset storage. Never treat `synthetic: true`
   as authorization: it is a fixture restriction, not a consent mechanism.
6. Benchmark representative personalized shots, validate frame outputs and encode/mux
   the final video before exposing any production UI.

Only trusted studio scenes may be loaded. Blender files/plugins are executable assets;
disable auto-execution, isolate workers, and never accept scene paths from public users.
Run the prototype only with synthetic fixtures until production authorization exists.
