import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase Storage signed upload URL. */
export async function createSignedUploadUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  options?: { upsert?: boolean },
): Promise<{
  data: { path: string; token: string; signedUrl: string } | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path, { upsert: options?.upsert ?? true });

  if (error || !data) {
    return {
      data: null,
      error: error ?? new Error("Failed to create signed upload URL"),
    };
  }

  return {
    data: {
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    },
    error: null,
  };
}

/** Supabase Storage signed download URL. */
export async function createSignedDownloadUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresIn: number,
): Promise<{
  data: { signedUrl: string } | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    return {
      data: null,
      error: error ?? new Error("Failed to create signed URL"),
    };
  }

  return {
    data: { signedUrl: data.signedUrl },
    error: null,
  };
}
