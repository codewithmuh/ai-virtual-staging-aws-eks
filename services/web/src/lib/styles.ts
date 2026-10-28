import type { StyleId } from "./types";

export interface StyleOption {
  id: StyleId;
  name: string;
  /** What the style brings, for people. The model's own brief lives in the API (STYLE_BRIEFS). */
  note: string;
  /** Three colours from the style's palette: main material, textile, accent. */
  swatches: [string, string, string];
}

export const STYLES: readonly StyleOption[] = [
  {
    id: "japandi",
    name: "Japandi",
    note: "Low oak, linen, a few ceramics",
    swatches: ["#c3a27a", "#e6dccb", "#3b3733"],
  },
  {
    id: "scandinavian",
    name: "Scandinavian",
    note: "Light wood, soft grey, warm lamps",
    swatches: ["#dcc8a8", "#e9e7e2", "#9aa3a8"],
  },
  {
    id: "industrial",
    name: "Industrial",
    note: "Leather, dark metal, reclaimed wood",
    swatches: ["#7a4f33", "#2f2c29", "#45563f"],
  },
  {
    id: "modern",
    name: "Modern",
    note: "Marble, matte black, one bold piece",
    swatches: ["#ebe8e3", "#232326", "#b8442f"],
  },
];

export function styleName(id: StyleId): string {
  return STYLES.find((s) => s.id === id)?.name ?? id;
}
