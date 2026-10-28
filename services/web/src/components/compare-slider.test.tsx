import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompareSlider } from "./compare-slider";

const props = { before: "/before.jpg", after: "/after.jpg", alt: "Living room" };

function originalClip() {
  return screen.getByAltText("Living room, original photo").style.clipPath;
}

describe("CompareSlider", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
  });
  afterEach(cleanup);

  it("shows both photos split in the middle, and says which is which", () => {
    render(<CompareSlider {...props} />);
    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("aria-valuenow")).toBe("50");
    expect(slider.getAttribute("aria-valuetext")).toBe("50% original, 50% staged");
    expect(originalClip()).toBe("inset(0 50% 0 0)");
    expect(screen.getByText("Virtually staged")).toBeTruthy();
  });

  it("moves with the arrow keys, Shift for bigger steps, Home and End", () => {
    render(<CompareSlider {...props} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuenow")).toBe("52");
    fireEvent.keyDown(slider, { key: "ArrowLeft", shiftKey: true });
    expect(slider.getAttribute("aria-valuenow")).toBe("42");
    fireEvent.keyDown(slider, { key: "End" });
    expect(slider.getAttribute("aria-valuenow")).toBe("100");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuenow")).toBe("100");
    fireEvent.keyDown(slider, { key: "Home" });
    expect(originalClip()).toBe("inset(0 100% 0 0)");
  });

  it("follows the pointer across the photo", () => {
    const { container } = render(<CompareSlider {...props} />);
    const box = container.firstElementChild as HTMLDivElement;
    box.getBoundingClientRect = () => ({ left: 100, width: 400 }) as DOMRect;
    box.setPointerCapture = () => {};

    fireEvent.pointerDown(box, { clientX: 200, pointerId: 1 });
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("25");
    fireEvent.pointerMove(box, { clientX: 450, pointerId: 1 });
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("88");
    fireEvent.pointerUp(box, { pointerId: 1 });
    fireEvent.pointerMove(box, { clientX: 100, pointerId: 1 });
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("88");
  });

  it("reveals the staged room from the right, ending in the middle", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "requestAnimationFrame", "performance"] });
    render(<CompareSlider {...props} reveal />);
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("100");
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("50");
    vi.useRealTimers();
  });

  it("takes its shape from the staged photo once it loads", () => {
    const { container } = render(<CompareSlider {...props} />);
    const after = screen.getByAltText("Living room, virtually staged") as HTMLImageElement;
    Object.defineProperty(after, "naturalWidth", { value: 1200 });
    Object.defineProperty(after, "naturalHeight", { value: 1600 });
    fireEvent.load(after);
    expect((container.firstElementChild as HTMLElement).style.aspectRatio).toBe("0.75");
  });
});
