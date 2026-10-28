import { describe, expect, it } from "vitest";

import { MAX_BYTES, photoProblem } from "./photo";

const file = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("photoProblem", () => {
  it("accepts JPEG, PNG and WebP up to 10 MB", () => {
    expect(photoProblem(file("a.jpg", "image/jpeg"))).toBeNull();
    expect(photoProblem(file("a.png", "image/png"))).toBeNull();
    expect(photoProblem(file("a.webp", "image/webp", MAX_BYTES))).toBeNull();
  });

  it("names HEIC, the format iPhones use, by name", () => {
    expect(photoProblem(file("IMG_0001.HEIC", ""))).toMatch(/HEIC/);
    expect(photoProblem(file("photo", "image/heif"))).toMatch(/HEIC/);
  });

  it("rejects other types", () => {
    expect(photoProblem(file("plan.pdf", "application/pdf"))).toBe(
      "Choose a JPEG, PNG or WebP photo.",
    );
  });

  it("says how big a too-large photo is", () => {
    expect(photoProblem(file("a.jpg", "image/jpeg", 12.4 * 1024 * 1024))).toBe(
      "That photo is 12.4 MB. The limit is 10 MB.",
    );
  });
});
