/**
 * Item photos live in the private Supabase Storage bucket "item-photos" as two JPEGs:
 *   items/<uuid>.jpg        ~1024px, for the item page
 *   items/<uuid>.thumb.jpg  ~160px, for lists (tiny, fast on cheap phones)
 * They are served by /photos/... which checks the login first.
 */
export const PHOTO_PATH_PATTERN = /^items\/[0-9a-f-]{36}(\.thumb)?\.jpg$/;

export function thumbPathFor(path: string): string {
  return path.replace(/\.jpg$/, ".thumb.jpg");
}

export function photoUrl(path: string, size: "full" | "thumb"): string {
  return `/photos/${size === "thumb" ? thumbPathFor(path) : path}`;
}
