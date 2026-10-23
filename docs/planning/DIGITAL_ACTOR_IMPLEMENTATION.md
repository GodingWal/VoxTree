# Digital Actor implementation

This increment establishes the canonical schema, explicit adult self-capture consent, owner-scoped enrollment API and dashboard (`/dashboard/actor`), PostgreSQL tables, capture quality gate, replaceable model registry, canonical skeleton and semantic face controls, character assignment contract, and lease-fenced sequential job executor.

Apply migration 015 before using the API. Standalone PostgreSQL installs should regenerate their schema with `npm run db:schema`. Existing installations need the new migration applied through their database deployment process. No live database is modified by this change.

The queue executor is worker-only and requires a PostgreSQL pool and explicitly registered stage providers. Provider calls have deadlines. Providers must retain actor ownership and version, validate dependencies, record model provenance on assets, and only report ready after validated masters and previews exist. Capture metrics must come from trusted server-side analysis; browser assertions are insufficient.

## Remaining integration work

- Live camera face/body capture, representative-frame extraction, trusted visual quality assessment and private upload finalization.
- Actual licensed face/body reconstruction models, production rigging, geometry stylization and GLB LOD generation.
- Signed asset delivery, source/derived storage deletion with a durable cleanup outbox, partial deletion and transactional rebuild/version archival.
- Existing V2V adapter with voice ownership, timing checks and lip-sync integration.
- Interactive 3D viewer and real preview animations.
- Costume fitting, motion correction, USD writer, RenderMan deployment and rendered validation.
- Worker deployment, atomic enrollment-to-job enqueue and retry exhaustion recovery for crashed workers.

The enrollment page intentionally reports capture required. No generated actor, preview, voice, or RenderMan output is simulated. The full initial-release definition of done is not yet met.
