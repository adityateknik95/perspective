// Identify an uploaded image by its leading bytes, not by the MIME type the
// browser sent. File.type comes from the client (it's just the filename
// extension, or whatever a script puts in the multipart header), so it
// can't decide what we store or the Content-Type we serve it with.
//
// Only the three formats the avatar uploader accepts are recognised:
//   JPEG  FF D8 FF
//   PNG   89 50 4E 47 0D 0A 1A 0A
//   WebP  "RIFF" <4-byte size> "WEBP"

export type SniffedImage =
  | { mime: "image/jpeg"; ext: "jpg" }
  | { mime: "image/png"; ext: "png" }
  | { mime: "image/webp"; ext: "webp" };

// Enough bytes for every signature above.
export const SNIFF_BYTES = 12;

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) =>
  bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

export function sniffImageType(bytes: Uint8Array): SniffedImage | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: "png" };
  }
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}
