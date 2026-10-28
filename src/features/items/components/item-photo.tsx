import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { photoUrl } from "../photo-paths";

/** Item picture, or a neutral placeholder. Uses the tiny thumbnail unless size="full". */
export function ItemPhoto({
  path,
  alt,
  size = "thumb",
  className,
}: {
  path: string | null;
  alt: string;
  size?: "thumb" | "full";
  className?: string;
}) {
  if (!path) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground",
          className,
        )}
        aria-hidden
      >
        <ImageIcon className="size-1/2 max-h-10 max-w-10" />
      </div>
    );
  }
  return (
    // Plain <img>: photos come from our own logged-in-only route, which next/image can't fetch.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl(path, size)}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 rounded-lg bg-secondary object-cover", className)}
    />
  );
}
