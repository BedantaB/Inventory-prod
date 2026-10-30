import { getSession } from "@/features/auth/session";
import { photoBelongsToShop } from "@/features/items/queries";
import { downloadItemPhoto } from "@/features/items/photos";

/**
 * Serves item photos to logged-in users only. Each photo has its own random file name and
 * is never changed in place, so browsers may keep it for a long time. A photo is only served
 * to logins of the shop whose item uses it.
 */
export async function GET(_request: Request, { params }: RouteContext<"/photos/[...path]">) {
  const session = await getSession();
  if (session.status !== "active") return new Response(null, { status: 401 });

  const path = (await params).path.join("/");
  if (!(await photoBelongsToShop(session.user.shopId, path))) {
    return new Response(null, { status: 404 });
  }
  const photo = await downloadItemPhoto(path);
  if (!photo) return new Response(null, { status: 404 });

  return new Response(photo, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
