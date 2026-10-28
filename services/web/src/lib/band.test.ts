import { describe, expect, it } from "vitest";

import type { Example } from "@/content/examples";

import { examplesSource, galleryFrame } from "./band";

const example = (over: Partial<Example>): Example => ({
  id: "living-room",
  title: "Living room",
  style: "japandi",
  room: "generated",
  room_model: "gpt-image-2",
  staged_by: "heya",
  provider: "openai",
  model: "gpt-image-2",
  seconds: 21.4,
  structure: { score: 0.91, flagged: false },
  width: 1200,
  height: 800,
  ...over,
});

describe("galleryFrame", () => {
  it("opens on the first room, half furnished, with the others still empty", () => {
    expect(galleryFrame(0, 3)).toEqual({ position: 0, splits: [0.5, 1, 1] });
  });

  it("ends on the last room, with every room furnished", () => {
    expect(galleryFrame(1, 3)).toEqual({ position: 2, splits: [0, 0, 0] });
  });

  it("furnishes each room in place, then slides on to the next", () => {
    // 3 rooms: 3 furnish steps and 2 slides of 0.8 make 4.6 units; the first starts half-way.
    const at = (unit: number) => galleryFrame((unit - 0.5) / 4.1, 3);
    expect(at(0.75)).toEqual({ position: 0, splits: [0.25, 1, 1] });
    expect(at(1.4).position).toBeCloseTo(0.5);
    expect(at(1.4).splits).toEqual([0, 1, 1]);
    const second = at(2.3);
    expect(second.position).toBe(1);
    expect(second.splits[1]).toBeCloseTo(0.5);
  });

  it("only moves forward: positions never go back, rooms never un-furnish", () => {
    let last = galleryFrame(0, 6);
    for (let p = 0.01; p <= 1; p += 0.01) {
      const next = galleryFrame(p, 6);
      expect(next.position).toBeGreaterThanOrEqual(last.position);
      next.splits.forEach((s, i) => expect(s).toBeLessThanOrEqual(last.splits[i] + 1e-9));
      last = next;
    }
  });

  it("holds still before the gallery and after it", () => {
    expect(galleryFrame(-1, 3)).toEqual(galleryFrame(0, 3));
    expect(galleryFrame(2, 3)).toEqual(galleryFrame(1, 3));
  });

  it("copes with one room, or none", () => {
    expect(galleryFrame(0, 1)).toEqual({ position: 0, splits: [0.5] });
    expect(galleryFrame(1, 1)).toEqual({ position: 0, splits: [0] });
    expect(galleryFrame(0.5, 0)).toEqual({ position: 0, splits: [] });
  });
});

describe("examplesSource", () => {
  it("says the rooms were generated, and by what", () => {
    expect(examplesSource([example({}), example({ id: "bedroom" })])).toBe(
      "The empty rooms were generated with gpt-image-2. Heya staged each one with OpenAI, the same way it stages yours.",
    );
  });

  it("says when they are real photos, and names every provider", () => {
    expect(
      examplesSource([
        example({ room: "photo", room_model: null }),
        example({ room: "photo", room_model: null, provider: "gemini" }),
      ]),
    ).toBe(
      "The empty rooms are real photos. Heya staged each one with OpenAI and Gemini, the same way it stages yours.",
    );
  });

  it("says when only some were generated", () => {
    expect(examplesSource([example({ room: "photo", room_model: null }), example({})])).toMatch(
      /^Some empty rooms were generated with gpt-image-2\./,
    );
  });

  it("credits a tool outside Heya when it did the staging", () => {
    const outside = {
      staged_by: "external" as const,
      provider: "Gemini",
      model: null,
      seconds: null,
    };
    expect(examplesSource([example({ room_model: "Gemini", ...outside })])).toBe(
      "The empty rooms were generated with Gemini. Each was staged with Gemini using Heya's prompt, then checked and labelled by Heya.",
    );
    expect(examplesSource([example({}), example({ ...outside })])).toMatch(
      /Heya staged some with OpenAI; the rest were staged with Gemini using its prompt\.$/,
    );
  });

  it("credits what made the rooms, not what staged them", () => {
    expect(examplesSource([example({ room_model: "ChatGPT", provider: "gemini" })])).toBe(
      "The empty rooms were generated with ChatGPT. Heya staged each one with Gemini, the same way it stages yours.",
    );
  });
});
