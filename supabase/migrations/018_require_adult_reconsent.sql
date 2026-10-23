-- Accounts that consented before the 18+ attestation (migration 016) have no
-- attested consent record. Reset their flag so they re-consent via /consent;
-- the guard in lib/consent.ts enforces the same rule at runtime.
UPDATE public.users u
SET consent_verified = false
WHERE u.consent_verified = true
  AND NOT EXISTS (
    SELECT 1 FROM public.consent_records c
    WHERE c.user_id = u.id
      AND c.revoked_at IS NULL
      AND c.adult_confirmed_at IS NOT NULL
  );
