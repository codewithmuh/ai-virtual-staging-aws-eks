import { describe, expect, it } from "vitest";

import { megabytes, providerName } from "./format";
import { styleName } from "./styles";

describe("names people see", () => {
  it("names the image model, and says plainly when there was no AI", () => {
    expect(providerName("gemini")).toBe("Gemini");
    expect(providerName("fake")).toBe("the fake model (no AI)");
    expect(providerName("new-provider")).toBe("new-provider");
  });

  it("names styles", () => {
    expect(styleName("scandinavian")).toBe("Scandinavian");
  });

  it("shows sizes in MB with one decimal", () => {
    expect(megabytes(1_572_864)).toBe("1.5 MB");
  });
});
