/**
 * Ensure env is present before any module imports `config/env`.
 * Prefer real local .env values when present.
 */
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY ??= "test-publishable-key";
process.env.NODE_ENV ??= "test";
