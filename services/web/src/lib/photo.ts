import type { ImageType } from "./types";

// The same limits the API and the S3 upload policy enforce; checking first saves a round trip.
export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPTED: readonly ImageType[] = ["image/jpeg", "image/png", "image/webp"];

/** Why this file can't be staged, in words for the user; null when it's fine. */
export function photoProblem(file: Pick<File, "name" | "type" | "size">): string | null {
  if (/\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/.test(file.type)) {
    return "HEIC photos aren't supported yet. Save it as a JPEG and try again.";
  }
  if (!(ACCEPTED as readonly string[]).includes(file.type)) {
    return "Choose a JPEG, PNG or WebP photo.";
  }
  if (file.size > MAX_BYTES) {
    return `That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`;
  }
  return null;
}
