import { MAX_BYTES, ReviewError } from "./policy.mjs";
export function sniff(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n))
    return "image/png";
  const ascii = (a, b) => String.fromCharCode(...bytes.slice(a, b));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  throw new ReviewError("Only JPEG, PNG and WebP photographs are accepted.");
}
// Copy only decoded image chunks. Drop EXIF, XMP and ICC, including any GPS.
// Never serve the original bytes as a public fallback.
export function cleanWebP(bytes) {
  if (sniff(bytes) !== "image/webp" || bytes.length < 20)
    throw new ReviewError("Image processing failed.", 503);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    parts = [];
  let length = 4,
    at = 12,
    hasImage = false;
  if (view.getUint32(4, true) + 8 !== bytes.length)
    throw new ReviewError("Invalid processed image.", 503);
  while (at + 8 <= bytes.length) {
    const tag = String.fromCharCode(...bytes.slice(at, at + 4)),
      size = view.getUint32(at + 4, true),
      end = at + 8 + size + (size % 2);
    if (end > bytes.length)
      throw new ReviewError("Invalid processed image.", 503);
    if (["ANIM", "ANMF"].includes(tag))
      throw new ReviewError("Animated photographs are not supported.");
    if (["VP8 ", "VP8L", "VP8X", "ALPH"].includes(tag)) {
      const chunk = bytes.slice(at, end);
      if (tag === "VP8X") chunk[8] &= ~(0x20 | 0x08 | 0x04);
      parts.push(chunk);
      length += chunk.length;
      if (tag === "VP8 " || tag === "VP8L") hasImage = true;
    }
    at = end;
  }
  if (!hasImage || at !== bytes.length)
    throw new ReviewError("Invalid processed image.", 503);
  const result = new Uint8Array(length + 8);
  result.set([82, 73, 70, 70], 0);
  new DataView(result.buffer).setUint32(4, length, true);
  result.set([87, 69, 66, 80], 8);
  at = 12;
  for (const part of parts) {
    result.set(part, at);
    at += part.length;
  }
  return result;
}
export async function transformPhoto(bytes, mime, images) {
  if (!bytes.length || bytes.length > MAX_BYTES)
    throw new ReviewError("Each photograph must be 10 MB or smaller.", 413);
  if (sniff(bytes) !== mime)
    throw new ReviewError("The file content does not match its image type.");
  if (!images)
    throw new ReviewError(
      "Photo processing is unavailable. Please try again later.",
      503,
    );
  const stream = () => new Blob([bytes]).stream();
  let info;
  try {
    info = await images.info(stream());
  } catch {
    throw new ReviewError("This photograph could not be decoded.");
  }
  const formats = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
  };
  if (
    !info ||
    !Number.isInteger(info.width) ||
    !Number.isInteger(info.height) ||
    info.width < 1 ||
    info.height < 1 ||
    info.width > 12000 ||
    info.height > 12000 ||
    info.width * info.height > 40000000 ||
    String(info.format)
      .toLowerCase()
      .replace("image/", "")
      .replace("jpg", "jpeg") !== formats[mime]
  )
    throw new ReviewError("Invalid photograph or image exceeds 40 megapixels.");
  const variants = [];
  try {
    for (const size of [480, 960, 1600]) {
      const output = await images
        .input(stream())
        .transform({ width: Math.min(size, info.width) })
        .output({ format: "image/webp", quality: 82, anim: false });
      const response = output.response();
      if (!response.ok) throw Error();
      const raw = await response.arrayBuffer();
      if (raw.byteLength > 2 * 1024 * 1024)
        throw new ReviewError(
          "This photograph is too complex to process safely. Try a smaller photograph.",
        );
      const data = cleanWebP(new Uint8Array(raw));
      variants.push({ size, bytes: data });
    }
  } catch (e) {
    if (e instanceof ReviewError) throw e;
    throw new ReviewError(
      "Photo processing is temporarily unavailable. Nothing has been published.",
      503,
    );
  }
  return { width: info.width, height: info.height, variants };
}
