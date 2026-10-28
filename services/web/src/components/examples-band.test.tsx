import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Example } from "@/content/examples";

import { ExamplesBand } from "./examples-band";

const office: Example = {
  id: "home-office",
  title: "Home office",
  style: "modern",
  room: "generated",
  room_model: "gpt-image-2",
  staged_by: "heya",
  provider: "openai",
  model: "gpt-image-2",
  seconds: 24.2,
  structure: { score: 0.88, flagged: false },
  width: 1200,
  height: 800,
};

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query }));

const split = (el: Element) =>
  Number((el.closest("[data-room]") as HTMLElement).style.getPropertyValue("--split"));

function renderBand(examples: Example[]) {
  return render(
    <ExamplesBand examples={examples}>
      <h1>Furnish an empty room</h1>
    </ExamplesBand>,
  );
}

describe("ExamplesBand", () => {
  beforeEach(() => {
    reducedMotion(false);
    vi.stubGlobal("requestAnimationFrame", (draw: FrameRequestCallback) => (draw(0), 1));
  });
  afterEach(cleanup);

  it("renders nothing until there are examples, not even the headline", () => {
    const { container } = renderBand([]);
    expect(container.innerHTML).toBe("");
  });

  it("shows the headline with each room before and after, its style and the check", () => {
    renderBand([office]);
    expect(screen.getByRole("heading", { name: "Furnish an empty room" })).toBeTruthy();
    expect(screen.getByAltText("Home office, empty").getAttribute("src")).toBe(
      "/examples/home-office-before.jpg",
    );
    expect(screen.getByAltText("Home office, virtually staged in Modern")).toBeTruthy();
    expect(screen.getByTitle(/88% of the room's edges match/).textContent).toBe(
      "Modern · 24 s·room unchanged",
    );
    expect(screen.getByText(/generated with gpt-image-2/)).toBeTruthy();
  });

  it("leaves out the time when the staging happened outside Heya", () => {
    renderBand([
      { ...office, staged_by: "external", provider: "Gemini", model: null, seconds: null },
    ]);
    expect(screen.getByTitle(/88% of the room's edges match/).textContent).toBe(
      "Modern·room unchanged",
    );
  });

  it("centres a room and sets its line from the scroll", () => {
    const { container } = renderBand([office, { ...office, id: "b", title: "Bedroom" }]);
    const strip = container.querySelector(".will-change-transform") as HTMLElement;
    expect(strip.style.transform).toMatch(/^translate3d\(/);
    const [first, second] = screen.getAllByRole("slider");
    expect(first.getAttribute("aria-valuenow")).toBe("50"); // the first room opens half-way
    expect(second.getAttribute("aria-valuenow")).toBe("100"); // the next is still empty
    window.dispatchEvent(new Event("scroll"));
    expect(strip.style.transform).toMatch(/^translate3d\(/);
  });

  it("moves a line with the arrow keys, and says where it is", () => {
    renderBand([office]);
    const knob = screen.getByRole("slider", { name: "Compare the home office before and after" });
    fireEvent.keyDown(knob, { key: "ArrowLeft", shiftKey: true });
    expect(split(knob)).toBeCloseTo(0.4);
    expect(knob.getAttribute("aria-valuetext")).toBe("40% original, 60% staged");
    fireEvent.keyDown(knob, { key: "End" });
    expect(knob.getAttribute("aria-valuenow")).toBe("100");
    fireEvent.keyDown(knob, { key: "Tab" });
    expect(knob.getAttribute("aria-valuenow")).toBe("100");
  });

  it("moves a line where it's dragged", () => {
    const { container } = renderBand([office]);
    const box = container.querySelector("[data-compare]") as HTMLElement;
    box.getBoundingClientRect = () => ({ left: 100, width: 400 }) as DOMRect;

    fireEvent.pointerDown(box, { clientX: 200, pointerId: 1 });
    expect(split(box)).toBeCloseTo(0.25);
    fireEvent.pointerMove(box, { clientX: 400, pointerId: 1 });
    expect(split(box)).toBeCloseTo(0.75);
    fireEvent.pointerUp(box, { pointerId: 1 });
    fireEvent.pointerMove(box, { clientX: 100, pointerId: 1 });
    expect(split(box)).toBeCloseTo(0.75);
  });

  it("hands the line back to the scroll once the page scrolls on", () => {
    const { container } = renderBand([office]);
    const box = container.querySelector("[data-compare]") as HTMLElement;
    box.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;
    fireEvent.pointerDown(box, { clientX: 10, pointerId: 1 });
    fireEvent.pointerUp(box, { pointerId: 1 });
    expect(split(box)).toBeCloseTo(0.1);

    window.scrollY = 1000;
    window.dispatchEvent(new Event("scroll"));
    expect(split(box)).toBeCloseTo(0.5);
    window.scrollY = 0;
  });

  it("doesn't pin or slide for people who prefer less motion, but the lines still move", () => {
    reducedMotion(true);
    const { container } = renderBand([office]);
    const strip = container.querySelector(".will-change-transform") as HTMLElement;
    expect(strip.style.transform).toBe("");
    const knob = screen.getByRole("slider");
    fireEvent.keyDown(knob, { key: "Home" });
    expect(knob.getAttribute("aria-valuenow")).toBe("0");
  });
});
