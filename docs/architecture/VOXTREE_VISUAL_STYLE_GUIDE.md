# VoxTree Visual Theme and Clone Production Rules

Version: 1.0  
Date: 2026-09-29  
Scope: Personalized 3D characters, story environments, animation, and final video rendering.

## 1. Creative direction

**You, recognizable as the lead character in a cinematic animated film.**

VoxTree's visual target is cinematic, stylized 3D realism: sculpted animated characters, believable materials, expressive performances, and carefully composed lighting. The user-selected reference is the Lightyear image shared on September 29, 2026, showing two characters embracing, textured blue uniforms, dimensional hair, soft skin shading, and a defocused environment.

Use that reference to judge visual qualities and emotional credibility. Create original VoxTree characters, costumes, environments, and compositions. The reference does not require a science-fiction setting, blue uniforms, or a dark palette in every story. Its screenshot overlays, sample counter, and branding are not part of the theme.

This document defines the desired production standard. It does not claim that the repository already implements 3D cloning or RenderMan rendering. The current README describes a voice-personalization product; this standard guides its visual expansion.

## 2. Rule language and ownership

- **MUST / MUST NOT:** Required for a production release under this visual standard.
- **SHOULD:** Preferred approach; deviations require a documented artistic or technical reason.
- **Prototype default:** An initial engineering choice to benchmark, not an established capability or permanent product promise.

The product owner approves the character look and material changes to the theme. Developers and artists should use this document in visual implementation reviews. Exceptions must identify the affected asset or shot, reason, impact, and approval.

## 3. Character and likeness rules

| Area | Required result | Reject when |
| --- | --- | --- |
| Identity | Preserve recognizable face shape, nose, jaw, eye spacing, hairline, skin tone, and distinctive features | Users become interchangeable avatars or identity changes between shots |
| Stylization | Simplified facial planes, softened contours, modest proportional exaggeration, expressive brows and eyes | Exaggeration overwhelms likeness or varies randomly between characters |
| Skin | Natural tonal variation, controlled highlights, subtle surface detail, believable subsurface response | Waxy, plastic, excessively oily, flat, or unnaturally lightened skin |
| Hair | Deliberate silhouette, dimensional curls/braids/strands, appropriate density and texture | Painted-on appearance, scalp gaps, intersections, or unstable detail |
| Eyes and mouth | Integrated eyes, functioning eyelids, convincing lips, teeth, and mouth interior | Glassy stares, exposed eyeball gaps, floating teeth, broken mouth shapes |
| Body | Consistent stylization, plausible anatomy, usable hands, fitted clothing | Distorted joints, implausible hands, or unstable proportions |
| Clothing | Fabric scale, thickness, seams, folds, and material-specific highlights | Flat painted clothing, visible body clipping, or incompatible detail scale |

A clone MUST remain recognizable in front, three-quarter, and profile views, and while smiling and speaking. Identity approval cannot rely on one flattering still.

Do not silently change ethnicity, apparent age, body characteristics, or defining facial features to fit a generic beauty preset. Lighting may change appearance naturally; the underlying identity and materials must remain consistent.

Build an approved family of reusable character bases with consistent topology and rig conventions. A shared rig MUST still support the person's distinct facial structure. Face replacement alone is insufficient if the neck, ears, hands, hair, or body visibly disagree.

## 4. World, lighting, and camera rules

- Environments MUST belong to the same visual world as the characters: coherent scale, detail density, materials, and lighting.
- Lighting MUST support the scene's emotion while preserving readable faces and skin tones.
- Use motivated key, fill, and separation where appropriate. Avoid a mandatory lighting recipe for every setting.
- Materials SHOULD respond plausibly to light while allowing deliberate artistic control.
- Depth of field SHOULD direct attention without hiding important action or masking asset defects.
- Camera movement MUST feel intentional. Avoid accidental jitter, uncontrolled focus changes, and exaggerated lens distortion in likeness approval shots.
- Color grading MUST preserve the approved character identity and maintain continuity across cuts.
- Costumes and palettes may vary by story; the quality and stylization standard stays consistent.

## 5. Performance and animation rules

Characters MUST convey emotion through eyes, brows, cheeks, mouth, posture, and timing. Facial movement cannot be reduced to a talking jaw.

- Preserve story intent, gaze targets, timing, and emotional beats when transferring a master performance.
- Retargeting MUST be checked on the personalized geometry; shared skeletons do not guarantee correct motion.
- Lip sync MUST follow the final personalized audio. If its timing changes, update facial animation and affected editorial timing.
- Include blinks, natural eye movement, breathing, and restrained secondary motion where appropriate.
- Hands and bodies MUST make believable contact during hugs, prop handling, and seated or grounded movement.
- Correct foot sliding, clothing penetration, hair collisions, and broken facial deformation before final approval.
- Review motion at delivery speed as well as frame by frame. A convincing still is not sufficient.

## 6. RenderMan production rules

RenderMan is the required final renderer for this production direction. Modeling, grooming, rigging, animation, and scene assembly remain separate production responsibilities.

1. Final assets MUST use materials and features validated in the selected RenderMan version and rendering mode.
2. Skin SHOULD use an appropriate subsurface-scattering material, tuned to scene scale and the approved stylization.
3. Hair SHOULD use dedicated hair shading and geometry or an alternative explicitly validated at the final viewing distance.
4. Pin the authoring application, export format, renderer version, rendering mode, plugins, and color configuration for reproducible output.
5. Use a documented color-management pipeline; a linear working space such as ACEScg is a proposed starting point to validate.
6. Preview rendering may use faster tools, but MUST be labeled as preview and cannot substitute for final RenderMan acceptance.
7. Sampling, denoising, motion blur, and depth of field MUST be evaluated in motion. Reject flicker, crawling hair, smeared expressions, halos, and disappearing texture.
8. No fixed sample count guarantees quality or speed. The reference's "64 samples per pixel" overlay is not a render budget.
9. Do not promise the visual quality of the reference simply because RenderMan is used.

Prototype default: test 1920 × 1080 at 24 fps. The delivery specification must be explicitly approved before production; this default is not a claim about current service output.

## 7. Clone production workflow

1. **Capture:** Collect authorized likeness references with adequate front, three-quarter, and side coverage and usable lighting.
2. **Fit:** Fit a reusable character base to the user's identity and the VoxTree style.
3. **Develop appearance:** Customize skin, eyes, hair, proportions, and wardrobe; inspect under neutral and story lighting.
4. **Approve identity:** Obtain approval of a turntable and an expression test before expensive story rendering.
5. **Rig and validate:** Verify facial controls, speech shapes, body motion, and clothing fit.
6. **Transfer performance:** Apply the master scene's acting and synchronize to final personalized audio.
7. **Render and composite:** Produce final RenderMan output and integrate all affected scene interactions.
8. **Review and deliver:** Pass visual and temporal checks, then encode the approved video.

Record asset, rig, material, scene, audio, and renderer versions with each render job. Keep personal source images and voice recordings in controlled media storage, never in the public code repository.

## 8. Master-scene reuse and cost rules

Author reusable stories with preserved cameras, lighting, animation, scene geometry, and replaceable character slots. A flattened master video alone is not enough for reliable 3D character replacement.

Reuse approved backgrounds and unaffected shots when technically valid. Rendering only the replacement character is an optimization to prove per shot, not a universal assumption.

A replacement can change shadows, reflections, occlusion, indirect light, contact, and visible background regions. The pipeline MUST rerender the affected contributions or the full shot when required. Compositing must correctly handle depth ordering, motion blur, transparent edges, and hair.

Benchmark the complete workflow, including asset preparation, simulation, rendering, denoising, compositing, encoding, storage, and retries. Separate one-time story creation, one-time clone creation, and per-video processing costs. Report hardware and software configuration with timing results.

Do not commit to a per-video price or throughput target based on sample counts or a single still. Quality reductions require an explicit product decision.

## 9. First proof of quality

Before long-form production, build one approved adult clone and a 10–15-second test:

- Neutral front, three-quarter, and profile views.
- A head turn, blink, smile, and spoken sentence.
- A transition between neutral and story lighting.
- Visible hair and clothing motion.
- A separate short contact test, such as touching a prop or embracing another character, before approving interactive story shots.

Review the result at full resolution and normal playback speed. Capture render timings, peak memory, failures, retries, and total processing cost. Test representative identities, skin tones, and hair textures before treating one successful clone as a general solution.

## 10. Release acceptance checklist

- [ ] Product owner approves the overall look against the selected reference.
- [ ] User likeness remains recognizable across views, expressions, and lighting.
- [ ] Skin tone, facial features, and hair remain consistent through the sequence.
- [ ] Skin, hair, eyes, and clothing meet the material rules.
- [ ] Facial performance and lip sync match the final audio.
- [ ] Hands, feet, clothing, and physical contact have no distracting defects.
- [ ] Shadows, reflections, occlusion, and background integration are correct.
- [ ] No distracting flicker, identity drift, denoising artifacts, or edge halos appear.
- [ ] Final output is rendered and reviewed with the pinned RenderMan configuration.
- [ ] Delivery resolution, frame rate, color transform, and audio synchronization are verified.
- [ ] Asset versions, render configuration, benchmark results, and review decisions are recorded.

Failing any required item blocks approval of the affected asset or shot. This checklist specifies production review; it does not imply automated checks already exist.

## 11. Implementation guidance for developers and artists

Implement the first complete character test before expanding to many story templates. Keep capture, character fitting, approval, animation, rendering, and delivery as separately observable stages.

A stage MUST report an honest status and actionable failure reason. Mock assets or fallback videos must not be represented as a completed personalized RenderMan video.

This document establishes visual production requirements. It does not replace existing consent, access-control, retention, or voice-cloning requirements. Resolve conflicts explicitly rather than silently weakening an existing control.

## 12. Technical references

These RenderMan resources support material and lighting implementation; they are not performance guarantees:

- [Pixar: RenderMan](https://www.pixar.com/renderman)
- [RenderMan: Cinematography with Soul](https://renderman.pixar.com/stories/cinematography-with-soul)
- [RenderMan: Skin Material Presets](https://renderman.pixar.com/skin-material-presets)
- [RenderMan: Hair and Fur Material Presets](https://renderman.pixar.com/hair-and-fur-material-presets)

Reference image: user-supplied Lightyear screenshot, filename 1790677372188.jpeg, shared September 29, 2026. This document describes its relevant qualities; the screenshot is not redistributed in this repository.
