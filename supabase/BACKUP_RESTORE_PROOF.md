# Backup/Restore Proof — VoxTree

Runbook to validate migrations and snapshot restore (P0 #6).

## Steps
1. Apply all migrations to a fresh project: `supabase db reset` — verifies 001..011 in order with no gaps/duplicates.
2. Snapshot: `supabase db dump --db-url "$PROD_URL" -f prod.dump`
3. Restore to second project: `supabase db reset --linked --project-ref "$STAGING_REF" && psql "$STAGING_URL" < prod.dump`
4. Verify counts: `SELECT count(*) FROM family_voices; SELECT count(*) FROM generated_clips;` must match source.
5. Verify RLS still enforced: run tests/rls.test.ts negative tests against restored DB.

## Last verified
_Pending first manual execution — migrations verified statically in tests/migrations-integrity.test.ts._
