# VoxTree Face & Body Cloning Architecture

## Purpose

This document defines the architecture for automatically creating reusable VoxTree avatars from guided face and body capture. The goal is to convert a user's appearance into a standardized, stylized character asset that can replace selected characters in existing VoxTree scenes while preserving animation, clothing, props, lighting relationships, and RenderMan compatibility.

Core design principle: **clone identity, not topology.** Every avatar should conform to the same VoxTree character specification instead of generating arbitrary production meshes per user.

## 1. Target User Experience

1. Record face
2. Record body
3. Confirm or choose hairstyle
4. Preview avatar
5. Approve avatar
6. Use avatar in supported VoxTree videos

```text
Face Capture
    ↓
Body Capture
    ↓
Automated Reconstruction
    ↓
VoxTree Stylization
    ↓
Rig + Materials + Groom
    ↓
RenderMan Validation
    ↓
Reusable USD Avatar
```

Once created, character replacement becomes:

```text
Select Movie Character
        ↓
Select User Avatar
        ↓
Retarget Existing Animation
        ↓
Render Replacement Character Layers
        ↓
Composite Into Master
```

## 2. Processing Architecture

Use specialized workers rather than one monolithic model:

```text
Upload / Capture Service
        ↓
Capture QA
        ↓
Face Reconstruction Worker
        ↓
Body Reconstruction Worker
        ↓
Hair / Groom Worker
        ↓
Avatar Builder
        ↓
Canonical Rig Fitting
        ↓
RenderMan Look Development
        ↓
Automated QA
        ↓
USD Avatar Package
        ↓
VoxTree Avatar Library
```

Reconstruction models estimate identity and proportions. The Avatar Builder maps those results onto the canonical VoxTree character.

## 3. Guided Capture

### Face Capture

Preferred input is a short guided phone video with neutral lighting. The user slowly turns left and right, looks slightly up and down, holds a neutral expression, smiles, opens the mouth, blinks, and optionally speaks briefly. Multi-angle still images can be a fallback.

### Body Capture

Preferred input is a short 360-degree full-body video in a neutral pose with reasonably fitted clothing. Fallback views should include front, back, left, right, and two 45-degree angles.

The goal is to estimate body proportions and silhouette, not reproduce the clothes worn during capture.

### Capture QA

Reject poor source material early. Validate face visibility, full-body visibility, blur, lighting, occlusion, multiple people in frame, extreme lens distortion, and missing required angles before expensive GPU processing begins.

## 4. Canonical VoxTree Character

Do not create arbitrary production topology for each person.

```text
VOXTREE_BASE_CHARACTER
        ↓
Identity Shape Parameters
        +
Body Shape Parameters
        ↓
User-Specific Character
```

Every clone should preserve the same body vertex layout, face vertex layout, UV layout, material slots, skeleton, facial control names, blendshape definitions, groom attachment interfaces, and clothing attachment rules.

This is the foundation that makes swapping reliable.

## 5. Face Reconstruction

The face system should estimate structured identity parameters instead of merely projecting a photograph onto a mesh.

Example parameters include head width/depth, jaw width/depth/angle, cheek position and volume, eye size/spacing/depth/tilt, nose dimensions, lip dimensions, forehead dimensions, chin dimensions, and ear shape/rotation.

Also estimate skin tone and appearance, freckles, facial hair, eye color, eyebrow shape, hairline, and other distinguishing visible features.

### Stylization Layer

VoxTree should not simply output a photoreal scan. The pipeline should preserve recognizable identity while applying VoxTree art direction through controlled parameters such as eye scale, facial softness, shape simplification, feature exaggeration, head-to-body ratio, and surface treatment.

## 6. Body Reconstruction

Estimate proportions and apply them to the canonical body. Example parameters include height, shoulder width, chest scale, waist scale, hip width, arm length, forearm length, leg length, torso length, neck length, hand scale, foot scale, and body-mass distribution.

These values deform the canonical mesh without replacing its topology.

## 7. Canonical Rig

Every avatar should inherit a versioned rig such as `VoxTreeHumanoidRig_v1`.

```text
root
└── pelvis
    ├── spine_01
    │   └── spine_02
    │       └── chest
    │           └── neck
    │               └── head
    ├── clavicle_L → upperarm_L → forearm_L → hand_L
    ├── clavicle_R → upperarm_R → forearm_R → hand_R
    ├── thigh_L → calf_L → foot_L
    └── thigh_R → calf_R → foot_R
```

Once a production rig version is released, incompatible changes should create a new version rather than silently changing the contract.

## 8. Facial Rig

The face should expose a stable facial performance interface. Typical controls include jaw open, left/right blink, brow raise/lower, smile, frown, pucker, funnel, cheek raise, nose wrinkle, and other expression controls.

All avatars should expose the same animation interface so facial animation created for a movie character can drive any compatible user avatar.

## 9. Animation Retargeting

Movie animation should belong to the rig, not to the original character mesh.

```text
Movie Animation
      ↓
Canonical Rig
      ↓
User Avatar Mesh
```

Retargeting must compensate for different proportions so hands still reach props, feet remain grounded, eye lines remain correct, and bodies do not intersect furniture.

Store semantic interaction anchors such as left/right hand grip, foot contacts, eye target, mouth target, seat contact, and prop sockets.

## 10. Modular Clothing

Keep clothing separate from the body clone:

```text
Character
├── Head
├── Body
├── Hair
├── Top
├── Bottom
├── Shoes
└── Accessories
```

When replacing a movie character, the user's identity and body can be transferred while the movie costume remains. Clothing should adapt through predefined morphs, deformation, simulation, or a combination.

## 11. Hair and Grooming

Treat hair as a modular production asset rather than reconstructing strand-for-strand from phone footage.

Estimate hairline, length, curl pattern, volume, density, color, part, fade style, and facial hair. Match these attributes to a high-quality groom library and deform the selected groom to the generated head.

## 12. RenderMan Look Development

Generated avatars should automatically receive RenderMan-compatible materials for skin, eyes, cornea, teeth, mouth, hair, clothing, and accessories.

The look-development pipeline should support subsurface skin response, roughness, normal detail, specular response, eye shading, hair shading, and VoxTree stylization controls.

## 13. USD Asset Structure

USD should be the backbone of reusable character assets.

```text
USER_82731.usd

USER_82731
├── geometry
│   ├── head
│   └── body
├── rig
│   ├── bodyRig
│   └── faceRig
├── groom
├── textures
├── materials
├── metadata
└── validation
```

Suggested package:

```text
avatars/USER_82731/
├── USER_82731.usd
├── geometry/head.usd
├── geometry/body.usd
├── rig/rig.usd
├── groom/hair.usd
├── textures/skin_basecolor.exr
├── textures/skin_roughness.exr
├── textures/skin_normal.exr
├── textures/eyes.exr
└── metadata/avatar.json
```

## 14. Character Replacement

Movie characters should use persistent IDs such as `CHAR_001`, `CHAR_002`, and so on. Each ID should reference mesh, rig, animation, materials, groom, clothing, voice, visibility rules, shadow/reflection relationships, props, and interaction anchors.

Replacing a character becomes an asset-reference change from the original character USD to the selected user's USD while preserving animation, world transform, camera, props, costume, lighting, and shot timing.

## 15. Selective RenderMan Rendering

Do not rerender an entire movie by default when only one character changes.

Author each reusable shot with a character-free background plate or decomposed scene layers. Render affected character passes such as beauty, alpha, shadow, reflection, indirect contribution when necessary, depth, motion vectors, Cryptomatte/object IDs, and other required AOVs. Composite the replacement over the clean plate, not over pixels containing the original character. If the clean plate or required interaction layers are unavailable, rerender the affected background and interaction surfaces; a mask alone cannot recover occluded pixels.

Some shots will still require wider rerendering when a replacement materially changes global illumination, reflections, volumetrics, cloth interaction, or physical contact. The system should classify these cases rather than assuming every shot can be isolated.

## 16. Automated Quality Assurance

Generate standardized test renders before accepting a new avatar:

1. Front face
2. 45-degree face
3. Side face
4. Smile
5. Speaking pose
6. Eyes closed
7. Full body
8. Walking or motion pose

Validate identity similarity, proportions, facial deformation, eyes, mouth, skin/material quality, hair attachment, rig deformation, joints, and render integrity. Low-confidence results may return to the relevant fitting stage for at most two automated refitting attempts. Record the attempt count and failure reason; exhausted jobs enter `QA_FAILED` for manual review or a new capture instead of consuming more GPU time.

## 17. Processing States

Recommended backend states:

```text
CAPTURE_STARTED
CAPTURE_UPLOADED
CAPTURE_VALIDATING
CAPTURE_REJECTED
FACE_PROCESSING
BODY_PROCESSING
GROOM_PROCESSING
AVATAR_BUILDING
RIGGING
MATERIAL_BUILDING
PROCESSING_FAILED
QA_RENDERING
QA_ANALYZING
QA_FAILED
PREVIEW_READY
USER_APPROVED
READY
ARCHIVED
DELETED
```

Store the failing stage, error code, and retry count with `PROCESSING_FAILED`. A worker may retry transient errors within a bounded budget; permanent or exhausted errors must leave the active processing state and surface to the user or operator.

## 18. Consent, Ownership, and Safety

Avatar data requires explicit lifecycle controls. Store versioned consent and ownership metadata with each avatar and verify permissions before every clone or render job.

Required controls:

- Explicit consent and likeness-owner authorization before opening capture or accepting any upload
- Ownership/authorization checks
- Ability to delete source captures
- Ability to delete generated avatar data
- Restricted sharing by default
- Audit trail for avatar creation and use
- Versioned consent terms
- Server-side authorization rather than UI-only enforcement
- Clear data-retention rules

The proposed avatar product is adult-only (18+). Age verification and server-side enforcement must be added before this policy can be claimed as active. The current consent form permits child audio/visual processing, so that flow and the launch plan must be reconciled with the adult-only avatar policy before release. Reject underage avatar capture at intake and check age and consent again during job execution.

## 19. Suggested Service Boundaries

- **Capture Service:** receives uploads and manages capture sessions.
- **Capture QA Worker:** validates source quality.
- **Face Worker:** landmarks, geometry reconstruction, appearance estimation, and identity fitting.
- **Body Worker:** estimates body parameters and fits the canonical body.
- **Groom Worker:** classifies hair/facial hair and selects/deforms production grooms.
- **Avatar Builder:** combines face, body, rig, groom, materials, and metadata.
- **Rig Validation Worker:** tests deformation and canonical animation compatibility.
- **RenderMan Worker:** generates reference frames and replacement passes.
- **QA Worker:** scores identity, deformation, material, and render quality.
- **Avatar Library:** stores approved versioned user avatars.

## 20. Recommended Implementation Order

### Phase 1: Canonical Character
Freeze the canonical body topology, face topology, UV layout, skeleton, facial controls, material slots, groom attachment standard, and USD schema.

### Phase 2: Manual Prototype
Create several avatars manually against the standard, swap them into existing animation, validate RenderMan materials, clothing transfer, selective rendering, and compositing.

### Phase 3: Automated Face Fitting
Automate capture, face reconstruction, parameter extraction, canonical face deformation, texture generation, and initial QA.

### Phase 4: Automated Body Fitting
Automate body reconstruction, proportion estimation, canonical body deformation, skeleton fitting, and clothing compatibility.

### Phase 5: Groom Automation
Add hair classification, groom matching, groom deformation, and facial hair.

### Phase 6: Fully Automated Avatar Builder
Connect all workers into one asynchronous pipeline.

### Phase 7: One-Click Character Replacement

```text
Select Character
      ↓
Select Avatar
      ↓
Replace
      ↓
Retarget
      ↓
Render Affected Layers
      ↓
Composite
      ↓
Deliver Personalized Video
```

## 21. Engineering Principle

The long-term advantage is not a single face or body model. Those models will change quickly. The durable system is the **VoxTree Character Standard**: canonical topology, canonical rig, facial interface, USD schema, material specification, groom interface, clothing interface, animation retargeting, RenderMan integration, and automated QA.

Models can then be replaced or upgraded without redesigning the production pipeline.

## 22. Immediate Next Milestone

Create **VoxTree Character Specification v1** before implementing the complete cloning backend.

It should define body topology requirements, face topology requirements, skeleton hierarchy, bone naming, facial control/blendshape list, morph parameter schema, UV specification, RenderMan material slots, groom attachment points, clothing attachment system, USD hierarchy, character IDs, animation interface, versioning rules, and validation tests.

Once this contract exists, every reconstruction, animation, rendering, and character-replacement component has a stable target.
