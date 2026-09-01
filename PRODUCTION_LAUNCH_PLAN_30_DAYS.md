# VoxTree 30-Day Production Launch Plan

**Plan date:** August 27, 2026  
**Target public launch:** September 25, 2026  
**Launch DRI:** Founder / CEO (name to assign by August 28)  
**Recommended launch scope:** Core family voice-cloning and narrated-content experience. Keep singing voice, visual LoRA, and talking-video generation behind feature flags until each passes the same security, reliability, consent, and cost gates.

## Executive decision

VoxTree is not production-ready today, but a controlled launch within 30 days is achievable if scope is frozen now and the team works launch blockers before marketing expansion.

The codebase is synchronized to GitHub `main` at commit `917aab4`. The current verification baseline is:

- 58/58 automated tests pass.
- TypeScript validation passes.
- Lint passes with two image-optimization warnings.
- The production build fails in the FFprobe/media-upload bundle path.
- There is no CI workflow, and 27 API routes have no route-level automated coverage.
- The dependency audit reports 1 critical, 7 high, and 6 moderate production vulnerabilities; Next.js 14.2.21 is deprecated and vulnerable.
- Voice samples and face/avatar captures are committed under `public/uploads`, and additional recordings exist locally in that public directory.
- Production integrations can still fall back to simulation behavior when configuration is missing.
- The database migration sequence contains two `008` migrations, and one is currently untracked.
- There is a privacy page and consent checkbox, but no Terms page, no demonstrated verifiable-parental-consent mechanism, no complete parent data access/deletion workflow, and no legal/compliance sign-off.
- Monitoring, CI/CD, tested backups/restores, incident response, a status page, and a production runbook are not present in the repository.

## Non-negotiable launch scope

The launch journey must be limited to:

1. Parent creates and verifies an account.
2. Parent completes legally reviewed consent before any child or family biometric data is collected.
3. Parent records or uploads one family voice with explicit authorization from the voice owner.
4. VoxTree creates the clone, reports job status accurately, and handles failure/retry without duplicate charges or orphaned data.
5. Parent selects approved content and plays a generated narration.
6. Parent can manage billing, cancel, request a refund, export data, and permanently delete children, recordings, clones, generated media, and the account.
7. Support can diagnose an issue without accessing raw customer media by default.

Everything outside this journey is secondary. Any unfinished advanced generation feature remains disabled in production.

## Owners

| Workstream | Accountable owner | Responsibility |
|---|---|---|
| Launch command | Launch DRI | Scope, daily blocker review, go/no-go decision |
| Application and infrastructure | Engineering lead | Build, CI/CD, security, data, deployment, rollback |
| Product and QA | Product/QA lead | Acceptance tests, beta, accessibility, release sign-off |
| Privacy and legal | Qualified privacy counsel + founder | COPPA, biometric privacy, terms, consent, retention, vendor review |
| Billing and finance | Founder/finance owner | Stripe, pricing, refunds, tax and reconciliation |
| Support and growth | Support/growth owner | Help center, support queue, launch communications, metrics |

One person may hold multiple roles, but each row needs a named individual by August 28.

## Priority rules

- **P0 / Must:** Launch is prohibited until complete.
- **P1 / Should:** Complete before launch unless the Launch DRI records a specific accepted risk.
- **P2 / Later:** Explicitly excluded from the 30-day launch scope.
- Reserve at least 30% of engineering capacity for defects, integration surprises, and beta feedback.
- No new product features enter the launch branch after September 9.

## Days 1-3: Stabilize the release foundation (Aug 27-29)

**Outcome:** A secure, reproducible build with automated checks.

- [ ] **P0 — Engineering:** Fix the FFprobe bundling failure and prove `npm run build` succeeds from a clean install.
- [ ] **P0 — Engineering:** Upgrade Next.js and related React/build dependencies to supported, patched versions; resolve every critical/high production vulnerability or document a compensating control approved by the Launch DRI.
- [ ] **P0 — Engineering:** Add GitHub Actions for clean install, type-check, lint, unit tests, production build, dependency audit, and secret scanning on every pull request.
- [ ] **P0 — Engineering:** Protect `main`; require review and green CI before merge. Create a `release/2026-09-launch` branch or equivalent release process.
- [ ] **P0 — Engineering:** Add startup environment validation. Production must fail closed when Stripe, Supabase, storage, ElevenLabs, Replicate, webhook, or app URL configuration is missing.
- [ ] **P0 — Engineering:** Remove or production-disable all mock upload/download routes, fake IDs, placeholder Stripe prices, demo children, and simulation fallbacks.
- [ ] **P0 — Engineering:** Remove customer-like voice/face/media files from `public/uploads`, add the directory to `.gitignore`, rotate any affected test credentials, and decide with counsel/security whether repository history must be purged.
- [ ] **P1 — Engineering:** Restrict Next Image remote hosts instead of allowing every HTTPS hostname.
- [ ] **P1 — Product:** Freeze launch scope and define which advanced features are off by default.

**Exit gate:** Fresh checkout installs reproducibly; CI is green; production build succeeds; no secrets or customer biometric media are present in the release tree.

## Days 4-7: Privacy, security, and data controls (Aug 30-Sep 2)

**Outcome:** Collection and processing of child, voice, and facial data is defensible and controllable.

- [ ] **P0 — Privacy counsel:** Review COPPA applicability, the current consent flow, the privacy notice, voice-owner authorization, vendor disclosures, data retention, deletion, and launch geography. Remove all “fully compliant” claims until counsel signs off.
- [ ] **P0 — Privacy counsel:** Review biometric laws for every launch geography. Illinois BIPA expressly includes voiceprints and requires written notice/consent plus a public retention/destruction policy; similar state laws may also apply.
- [ ] **P0 — Product/Engineering:** Replace the current checkbox-only claim of parental verification with counsel-approved verifiable parental consent and age/parent verification.
- [ ] **P0 — Product/Engineering:** Require separate, auditable authorization from the person whose voice/likeness is cloned; handle minors and deceased family members explicitly.
- [ ] **P0 — Engineering:** Implement complete parent access, export, revocation, and deletion. Deletion must cascade through Supabase, GCS, ElevenLabs, Replicate/Hedra outputs, caches, logs, and backups according to policy.
- [ ] **P0 — Legal:** Publish counsel-reviewed Terms of Service, Privacy Notice, Biometric/Voice Data Notice and Consent, retention/deletion schedule, refund policy, acceptable-use/anti-impersonation policy, and DMCA/content reporting path.
- [ ] **P0 — Engineering:** Verify object-level authorization on every voice, child, clip, avatar, invitation, admin, download, and status endpoint. Add negative tests proving one family cannot access another family's data.
- [ ] **P0 — Engineering:** Verify signed Stripe and Replicate webhooks in production and reject unsigned, replayed, stale, or malformed events.
- [ ] **P0 — Engineering:** Review Supabase RLS, service-role usage, storage bucket privacy, signed URL expiry, encryption, log redaction, rate limiting, job idempotency, and cost caps.
- [ ] **P0 — Engineering:** Normalize and test migration order, remove duplicate numbering, apply all migrations to a fresh staging database, and prove backup restore to a separate project.
- [ ] **P1 — Legal/Engineering:** Complete vendor inventory and DPAs/subprocessor disclosures for Supabase, Google Cloud, ElevenLabs, Replicate, Hedra, Stripe, analytics, monitoring, and support tools.

**Exit gate:** Counsel approves launch documents and consent design; cross-account access tests pass; deletion is verified end-to-end; staging can be rebuilt and restored from documented migrations/backups.

## Week 2: Make the core journey reliable (Sep 3-9)

**Outcome:** Staging behaves like production and money/data paths are tested.

- [ ] **P0 — Engineering:** Create separate development, staging, and production projects/keys for Supabase, Stripe, storage, and AI vendors. Rotate secrets and enforce least privilege.
- [ ] **P0 — Engineering/QA:** Add route-level tests for Stripe checkout/webhooks, voice create/process/delete, upload validation, consent gating, invitations, download authorization, rate limits, retries, and quota/cost enforcement.
- [ ] **P0 — QA:** Add browser end-to-end tests for signup/login/reset, consent, voice capture, clone creation, narration, billing, cancellation, deletion, and failure recovery.
- [ ] **P0 — Billing:** Test Stripe monthly/annual checkout, webhook replay, upgrade/downgrade, cancellation, failed payment, refund, invoice, and entitlement synchronization.
- [ ] **P0 — Engineering:** Add transactional email for verification, password reset, invitation, payment failure, cancellation, data deletion, and support acknowledgment. Configure SPF, DKIM, and DMARC.
- [ ] **P0 — Engineering:** Add structured error monitoring, application logs with request/job IDs, uptime checks, synthetic checks for the core journey, and alerts for error rate, job failures, vendor failures, latency, spend, and webhook backlog.
- [ ] **P0 — Engineering:** Document and test rollback, database recovery, vendor outage degradation, credential rotation, and incident response.
- [ ] **P1 — Product/QA:** Complete WCAG 2.1 AA review of authentication, consent, recording, player, billing, deletion, and error states.
- [ ] **P1 — Engineering:** Replace eligible raw images with optimized images and remove large `@ts-nocheck` blind spots on launch-critical components.

**Exit gate:** All core journeys pass in staging with production-like services; Stripe test matrix is signed; alerts fire to a human; rollback and restore have been rehearsed.

## Week 3: Closed beta and operational proof (Sep 10-16)

**Outcome:** Real families complete the journey safely without founder assistance.

- [ ] **P0 — Product:** Run a closed beta with 10-20 consented families using a scripted test and explicit beta data terms.
- [ ] **P0 — QA:** Record activation, completion, error, abandonment, support, and job-success metrics; interview at least five families.
- [ ] **P0 — Engineering:** Load-test authentication, browse, status polling, signed downloads, webhooks, and job creation. Do not attempt to load-test paid generation without vendor limits and budget guards.
- [ ] **P0 — Security:** Perform an OWASP-focused review and external penetration test or qualified independent review of auth, IDOR, uploads, webhooks, SSRF, file parsing, admin access, secrets, and payment flows.
- [ ] **P0 — Operations:** Verify daily backups, restore evidence, media lifecycle/deletion jobs, log retention, alert routing, support escalation, and incident severity definitions.
- [ ] **P1 — Support:** Build support macros for consent, failed clones, refunds, deletion, billing, impersonation reports, and security/privacy escalation.
- [ ] **P1 — Product:** Fix all beta-blocking and high-severity usability defects; defer cosmetic work that does not affect trust or conversion.

**Beta success targets:** At least 10 families complete the full journey; at least 80% complete onboarding without live help; at least 95% of accepted generation jobs complete successfully; zero unresolved P0/P1 security, privacy, billing, or data-loss defects.

## Week 4: Release candidate and launch readiness (Sep 17-23)

**Outcome:** A frozen release candidate passes a full rehearsal.

- [ ] **P0 — Launch DRI:** Cut the release candidate and freeze features. Only blocker fixes may merge.
- [ ] **P0 — QA:** Run the complete regression matrix on supported desktop/mobile browsers and slow/interrupted networks.
- [ ] **P0 — Engineering:** Run a production deployment rehearsal, migration rehearsal, smoke test, rollback, and restore in staging.
- [ ] **P0 — Operations:** Publish the status page; finalize on-call rotation, escalation tree, vendor contacts, support hours, and incident/customer communication templates.
- [ ] **P0 — Finance:** Confirm business entity, banking, accounting, Stripe live mode, refund operations, sales-tax advice, pricing, unit economics, vendor budgets, and spend alerts.
- [ ] **P0 — Support/Growth:** Finalize the product demo, onboarding email, launch email, help center, press assets, and accurate feature/privacy claims.
- [ ] **P1 — Growth:** Configure privacy-respecting product analytics for signup, consent completion, first clone, first play, paid conversion, cancellation, deletion, and support contact.
- [ ] **P1 — Launch DRI:** Conduct a tabletop exercise for vendor outage, accidental data exposure, runaway AI spend, payment outage, and abusive impersonation.

**Exit gate:** Release candidate is unchanged for 48 hours, staging rehearsal passes, support/on-call is staffed, and every launch gate below has named evidence.

## Days 29-30: Go/no-go and launch (Sep 24-25)

### September 24 — Final go/no-go

- [ ] Review every P0 item and attach evidence.
- [ ] Confirm production secrets, DNS, TLS, email authentication, Stripe webhooks, backups, alerts, dashboards, vendor quotas, and feature flags.
- [ ] Confirm there are no critical/high known exploitable vulnerabilities and no unresolved P0/P1 defects.
- [ ] Confirm counsel, engineering, QA, billing, support, and Launch DRI sign-off.
- [ ] Take a pre-launch backup and record rollback version and decision maker.

### September 25 — Controlled public launch

- [ ] Deploy during staffed hours using a canary or small invite cohort first.
- [ ] Run smoke tests immediately: signup, consent, clone, narration, payment, cancellation, deletion, support contact.
- [ ] Observe for 60 minutes before broadening access.
- [ ] Monitor error rate, latency, job success, webhook backlog, vendor health, spend, signups, activation, payments, cancellations, and support volume.
- [ ] Send launch communications only after technical smoke tests pass.
- [ ] Hold a same-day checkpoint and a next-morning retrospective.

## Go/no-go scorecard

Launch only when every mandatory gate is green:

| Gate | Required evidence |
|---|---|
| Build and release | Clean install, CI, type-check, lint, tests, and production build all pass; release commit is tagged |
| Security | No critical/high exploitable vulnerabilities; independent review complete; secrets scanned/rotated; cross-account tests pass |
| Privacy and consent | Counsel-approved notices/terms/consent; verifiable parental consent; voice-owner authorization; retention/deletion policy published |
| Data lifecycle | No customer media in source/public assets; private storage; export/deletion tested across all vendors; backup and restore proven |
| Billing | Stripe test matrix passes; entitlements reconcile; refunds/cancellations/failed payments work; live webhooks verified |
| Reliability | Core synthetic checks pass; generation success at least 95%; non-media API error rate below 1%; alerts reach on-call |
| Performance | Core non-generation endpoints meet agreed staging baseline (initial target: p95 under 2.5 seconds); load test passes expected launch traffic at 2x headroom |
| Product | 10+ beta families complete the journey; no unresolved launch-blocking usability defects; advanced incomplete features disabled |
| Operations | Status page, support queue, incident plan, on-call schedule, rollback, vendor contacts, and launch runbook are ready |
| Business | Entity, banking, accounting, pricing, refund policy, tax advice, insurance decision, domain, and branded email are complete |

## Automatic rollback or access-pause triggers

- Confirmed or suspected exposure of voice, face, child, authentication, or payment data.
- Cross-account access or authorization failure.
- Payment/entitlement mismatch affecting more than one customer.
- Core error rate above 2% for 10 minutes or generation success below 90% for 15 minutes.
- Unbounded vendor spend, broken cost caps, or a queue growing without recovery.
- Inability to delete customer data or honor consent withdrawal.
- Critical core journey failure with no safe workaround.

The Launch DRI may pause signups or disable generation features independently of a full rollback.

## Explicitly deferred until after launch

- Public launch of singing voice, LoRA avatar training, and talking-video generation unless separately gated.
- Broad international rollout before country-specific privacy and child-consent review.
- Referral programs, Product Hunt optimization, blog expansion, and nonessential social channels.
- Large UI refactors unrelated to launch-critical type safety or defects.
- Nice-to-have admin analytics and nonessential content-library expansion.

## Daily operating cadence

- 15-minute launch standup every weekday: yesterday, today, blocker, risk.
- One shared tracker with owner, due date, status, evidence link, and dependency for every P0/P1 item.
- Launch DRI reviews P0 status daily and scope twice weekly.
- Formal go/no-go reviews on September 9, 16, 23, and 24.
- Any added work must identify what is being removed from the 30-day scope.

## Compliance references for counsel review

- FTC COPPA guidance: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- FTC six-step COPPA plan: https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business
- Illinois Biometric Information Privacy Act: https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3004
- European Commission guidance on children's data: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data/are-there-any-specific-safeguards-data-about-children_en

This plan is operational guidance, not legal advice. Qualified counsel should approve the legal launch gate.
