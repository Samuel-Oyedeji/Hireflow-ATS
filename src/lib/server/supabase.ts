import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "./env";

/**
 * Service-role Supabase client. This key bypasses RLS, so it must only ever run
 * on the server — every caller here is inside a `createServerFn` handler.
 */
let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const BUCKET = "applicant-files";

/** Upload a file to the private bucket and return the stored path. */
export async function uploadToBucket(file: File, path: string): Promise<string> {
  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

/** Time-limited download URL for a stored file (bucket is private). */
export async function signedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}
