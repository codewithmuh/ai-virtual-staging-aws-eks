import { describe, expect, it } from "vitest";

import { visitorId } from "./visitor";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const UUID = /^[0-9a-f-]{36}$/;

describe("visitorId", () => {
  it("creates an id once and keeps it", () => {
    const storage = memoryStorage();
    const first = visitorId(storage);
    expect(first).toMatch(UUID);
    expect(visitorId(storage)).toBe(first);
  });

  it("replaces a stored value the API wouldn't accept", () => {
    expect(visitorId(memoryStorage({ "heya.visitor": "bad id!" }))).toMatch(UUID);
  });

  it("still works when storage is blocked or missing", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
    };
    expect(visitorId(blocked)).toMatch(UUID);
    expect(visitorId(null)).toMatch(UUID);
  });
});
