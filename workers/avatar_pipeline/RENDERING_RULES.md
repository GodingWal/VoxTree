# VoxTree reusable master rendering rules

## Required shot classification

| Strategy | Use | Per-user work |
| --- | --- | --- |
| reuse | No personalized character or personalized visual effects | Reuse verified plate |
| layered | Independently compositable character with controlled interactions | Character + signed environmental effect delta + composite |
| full | Complex interaction or unvalidated layer separation | Render the complete affected shot |

A character off camera can still affect shadows, mirrors, lighting or another actor.
Such a shot is not automatically reusable. Default uncertain shots to full.

## Authoring requirements

1. Preserve editable 3D scenes, animation, camera, materials and lighting. A flattened
   master movie is not the reusable source.
2. Render clean plates without the replaceable actor AND without its shadows,
   reflections, indirect light contribution or other effects. Reveal the background
   behind the original actor so a smaller replacement does not leave a hole.
3. Keep environment geometry available to secondary rays and occlusion. Hiding all
   scenery from rendering is not a correct substitute for holdouts/collectors.
4. Lock camera, lens, frame range, FPS, resolution, animation timing, lighting,
   exposure, shutter, depth of field, color configuration and render settings.
   Any change invalidates cached plates. The worker rejects templates and pass
   scenes whose frame rate differs from the job/shot instead of resampling them.
   Dialogue must fit the authored timing;
   otherwise revise and rerender the affected shot and its plate.
5. Character pass: scene-linear, premultiplied RGBA, with correct foreground occlusion.
   Effect pass: signed RGB delta on the uncovered environment relative to the clean
   plate. Include reflections, shadows and indirect-light changes; exclude character
   beauty. A raw shadow matte or raw RenderMan AOV is NOT this delta.
6. Composite in linear light: character.rgb + (plate.rgb + effects.rgb) *
   (1 - character.alpha). Retain negative and HDR values. Apply the display transform
   only for final delivery. Do not composite gamma-encoded PNGs using this equation.
7. Match motion blur, depth of field, edge coverage and denoising across passes.
   Validate transparent hair, partial coverage, reflections and foreground occluders
   against a full-render reference. Unsupported deep/volumetric/refraction cases use full.
8. Group interacting props/actors with the replacement when needed; this prototype
   uses full-shot fallback for those cases. It does not implement group rendering.
9. Hash every dependency supplied to the job and bump revision for external changes
   (renderer/plugin versions, OCIO, linked assets, textures, caches, shaders). Missing
   dependencies make cache correctness impossible. Never include a user's identity in
   a shared plate. Keep personalized outputs isolated and private.
10. Publish a cache receipt only after every expected frame decodes at the expected
    dimensions. Verify receipt hashes before reuse. Partial/corrupt caches fail closed;
    remove or quarantine them explicitly before retry. Separate cache writers operationally.
11. Validate final pixels and frame completeness, then encode with aligned dialogue,
    music and effects. Frame preparation does not authorize publication. Production
    ownership, consent, cancellation and deletion controls remain mandatory.
12. Measure real shot costs. Screen coverage is not proportional to savings. Characters,
    hair and secondary rays can dominate. Do not promise a cost per video yet.

## Implementation and execution

`shot_pipeline.py` implements strategy planning, content-keyed cache verification and
numerical compositing. `render_shot.py` executes authored RenderMan pass scenes,
checks EXR dimensions, caches clean plates, and composites layered shots.

Author independent scenes named `VT_plate`, `VT_character`, `VT_effects`, `VT_full`
as required by the shot strategy. Each needs custom property
`voxtree_pass_contract = linear-premult-delta-v1`. Personalized scenes also need the
avatar rig contract from README. Do not share mutable mesh/shape-key data between
pass scenes. The worker rejects already animated identity shape keys.

The studio must author RenderMan visibility, holdouts, collectors, signed effect
outputs and matching materials. The worker does not guess these renderer-specific
settings. Configure displays to honor each scene's output filepath and return the
contracted RGBA EXR. Missing/misdirected outputs stop the job. The geometric fixture
from the earlier prototype is NOT a layered RenderMan production template.

Example on a licensed, configured Blender/RenderMan worker (Blender includes NumPy):

```bash
blender --background --disable-autoexec /studio/story.blend --python-exit-code 1 --python workers/avatar_pipeline/render_shot.py -- --shot workers/avatar_pipeline/examples/shot.json --avatar workers/avatar_pipeline/examples/synthetic-avatar.json --dependency plates/wall.png=/studio/wall.png --dependency plates/floor.png=/studio/floor.png --cache-root /private/plates --output /private/jobs/example-001
```

Supply repeated `--dependency ASSET_ID=path` arguments for every file. The asset ID
is a studio-relative logical name (never an absolute machine path) that binds each
content hash to its role in the scene; swapping two files' contents invalidates the
key. The loaded template takes the reserved ID `scene`. Same output directory fails
rather than overwriting. Same plate key reuses complete verified frames; new avatar
jobs do not change that key. `full` renders without a plate; `reuse` skips character
work entirely.
No cloud queue, production UI, video encoding or automatic licensing is introduced.

Tests: `python3 -m unittest discover -s workers/avatar_pipeline/tests -v` (NumPy needed).
Blender/RenderMan integration and visual equivalence must be tested on the target
worker image before this draft is production-ready.

## RenderMan licensing checkpoint

Pixar's official store advertises commercial batch rendering, floating render-farm
licenses and cloud/rental options: https://renderman.pixar.com/store (checked 2026-09-08).
These support the proposed infrastructure direction but are not a reviewed grant for
VoxTree's particular hosted customer service. Obtain written confirmation from
RenderMan sales covering automated personalized customer videos, owned/cloud workers,
concurrent license requirements and cached/recomposited outputs before commercial
operation. No claim of Pixar endorsement or permission to use Pixar film assets follows
from a renderer license. The implementation does not distribute RenderMan binaries.
