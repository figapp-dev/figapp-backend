/**
 * Ensure env is present before any module imports `config/env`.
 * Prefer real local .env values when present.
 */
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY ??= "test-publishable-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.GOCARDLESS_ACCESS_TOKEN ??= "sandbox_test_token";
process.env.GOCARDLESS_WEBHOOK_SECRET ??= "test-webhook-secret";
process.env.GOCARDLESS_ENV ??= "sandbox";
process.env.BILLING_CRON_SECRET ??= "test-billing-cron-secret";
process.env.NODE_ENV ??= "test";
