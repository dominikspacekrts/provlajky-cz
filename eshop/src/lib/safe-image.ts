/** Detekce typu obrázku z magic bytes — bez SVG/HTML. */

export type SafeImageType = { contentType: "image/png" | "image/jpeg" | "image/webp"; ext: "png" | "jpg" | "webp" };

export function detectSafeImage(buffer: Buffer): SafeImageType | null {
  if (buffer.length < 12) return null;
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { contentType: "image/png", ext: "png" };
  }
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }
  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { contentType: "image/webp", ext: "webp" };
  }
  return null;
}

export function decodeSafeImageDataUrl(
  dataUrl: string,
  maxBytes: number,
): { buffer: Buffer; contentType: string; ext: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(m[2], "base64");
  } catch {
    return null;
  }
  if (buffer.length === 0 || buffer.length > maxBytes) return null;
  const detected = detectSafeImage(buffer);
  if (!detected) return null;
  return { buffer, contentType: detected.contentType, ext: detected.ext };
}
