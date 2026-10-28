/**
 * Shrinks a phone camera photo (often 3–8 MB) into two small JPEGs before upload:
 * ~1024px for the item page and ~160px for lists. Saves mobile data and keeps lists fast.
 */
export async function compressPhoto(file: File): Promise<{ full: Blob; thumb: Blob }> {
  const image = await loadImage(file);
  try {
    const [full, thumb] = await Promise.all([toJpeg(image, 1024, 0.8), toJpeg(image, 160, 0.75)]);
    return { full, thumb };
  } finally {
    if ("close" in image) image.close();
  }
}

type Drawable = ImageBitmap | HTMLImageElement;

async function loadImage(file: File): Promise<Drawable> {
  if (!file.type.startsWith("image/")) throw new Error("not-an-image");
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the <img> route (older browsers).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toJpeg(image: Drawable, maxSide: number, quality: number): Promise<Blob> {
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no-canvas");
  context.fillStyle = "#fff"; // transparent PNGs get a white background
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode-failed"))),
      "image/jpeg",
      quality,
    ),
  );
}
