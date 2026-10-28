import type { Example } from "@/content/examples";

import { providerName } from "./format";

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** Sliding to the next room takes this long, relative to furnishing one. */
const SLIDE = 0.8;

const ease = (t: number) => t * t * (3 - 2 * t);

export interface GalleryFrame {
  /** The room in the centre: fractional while the strip slides from one room to the next. */
  position: number;
  /** Each room's split, from 1 (all original) to 0 (all staged). */
  splits: number[];
}

/**
 * The pinned gallery at a scroll `progress` from 0 to 1. Each room in turn is centred and
 * furnished in place, then the strip slides on to the next. The first room starts half-way, so
 * the first screen already shows a before and after; the last ends fully furnished.
 */
export function galleryFrame(progress: number, rooms: number): GalleryFrame {
  const splitsWith = (active: number, split: number) =>
    Array.from({ length: rooms }, (_, i) => (i < active ? 0 : i > active ? 1 : split));
  if (rooms === 0) return { position: 0, splits: [] };

  const units = rooms + (rooms - 1) * SLIDE;
  const reached = 0.5 + clamp(progress) * (units - 0.5);
  let u = reached;
  for (let i = 0; i < rooms - 1; i++) {
    if (u <= 1) return { position: i, splits: splitsWith(i, 1 - u) };
    u -= 1;
    if (u <= SLIDE) return { position: i + ease(u / SLIDE), splits: splitsWith(i + 1, 1) };
    u -= SLIDE;
  }
  // The last room: measured from the end, so it lands on exactly 0 (fully furnished).
  return { position: rooms - 1, splits: splitsWith(rooms - 1, clamp(units - reached)) };
}

/** One honest line on where the examples came from. */
export function examplesSource(examples: Example[]): string {
  const generated = examples.filter((e) => e.room === "generated");
  const makers = [...new Set(generated.map((e) => e.room_model ?? "AI"))].join(" and ");
  const rooms =
    generated.length === 0
      ? "The empty rooms are real photos"
      : generated.length === examples.length
        ? `The empty rooms were generated with ${makers}`
        : `Some empty rooms were generated with ${makers}`;
  const names = (list: Example[], name: (e: Example) => string) =>
    [...new Set(list.map(name))].join(" and ");
  const byHeya = examples.filter((e) => e.staged_by === "heya");
  const outside = examples.filter((e) => e.staged_by === "external");
  const staged =
    outside.length === 0
      ? `Heya staged each one with ${names(byHeya, (e) => providerName(e.provider))}, the same way it stages yours`
      : byHeya.length === 0
        ? `Each was staged with ${names(outside, (e) => e.provider)} using Heya's prompt, then checked and labelled by Heya`
        : `Heya staged some with ${names(byHeya, (e) => providerName(e.provider))}; the rest were staged with ${names(outside, (e) => e.provider)} using its prompt`;
  return `${rooms}. ${staged}.`;
}
