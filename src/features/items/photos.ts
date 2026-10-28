import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PHOTO_PATH_PATTERN, thumbPathFor } from "./photo-paths";

const BUCKET = "item-photos";
const MAX_FULL_BYTES = 1_500_000;
const MAX_THUMB_BYTES = 300_000;

export type PhotoProblem = "items.photoTooBig" | "items.photoNotImage";

/** Reads the two photo files a form sent (see compress-photo.ts). */
export function photoFilesFrom(formData: FormData): { full: File; thumb: File } | null {
  const full = formData.get("photo");
  const thumb = formData.get("photoThumb");
  if (full instanceof File && thumb instanceof File && full.size > 0 && thumb.size > 0) {
    return { full, thumb };
  }
  return null;
}

export function checkPhoto(files: { full: File; thumb: File }): PhotoProblem | null {
  if (files.full.type !== "image/jpeg" || files.thumb.type !== "image/jpeg")
    return "items.photoNotImage";
  if (files.full.size > MAX_FULL_BYTES || files.thumb.size > MAX_THUMB_BYTES)
    return "items.photoTooBig";
  return null;
}

/** Uploads both sizes and returns the stored path. */
export async function uploadItemPhoto(files: { full: File; thumb: File }): Promise<string> {
  const path = `items/${crypto.randomUUID()}.jpg`;
  const storage = createSupabaseAdminClient().storage.from(BUCKET);
  const options = { contentType: "image/jpeg", upsert: false };
  const [full, thumb] = await Promise.all([
    storage.upload(path, files.full, options),
    storage.upload(thumbPathFor(path), files.thumb, options),
  ]);
  if (full.error || thumb.error) {
    await deleteItemPhoto(path);
    throw full.error ?? thumb.error;
  }
  return path;
}

/** Best effort: a leftover file is harmless, so failures are only logged. */
export async function deleteItemPhoto(path: string | null | undefined) {
  if (!path) return;
  const { error } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .remove([path, thumbPathFor(path)]);
  if (error) console.error("Could not delete old photo", path, error);
}

export async function downloadItemPhoto(path: string): Promise<Blob | null> {
  if (!PHOTO_PATH_PATTERN.test(path)) return null;
  const { data, error } = await createSupabaseAdminClient().storage.from(BUCKET).download(path);
  if (error) return null;
  return data;
}
