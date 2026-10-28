"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import type { Example } from "@/content/examples";
import { examplesSource, galleryFrame } from "@/lib/band";
import { styleName } from "@/lib/styles";

/** After a drag, scrolling this far hands the line back to the scroll, gradually. */
const HANDBACK_PX = 300;

const clamp = (n: number) => Math.min(1, Math.max(0, n));

interface Props {
  examples: Example[];
  /** The headline, shown above the rooms and pinned with them. */
  children: ReactNode;
}

/**
 * The hero: the headline and the before/after rooms, pinned to the screen while the page scrolls
 * through them. Each room is centred and furnished in turn (the line sweeps across it), then the
 * strip slides to the next; the page moves on after the last. Every line can also be dragged, or
 * moved with the arrow keys. With reduced motion nothing is pinned: swipe the strip instead.
 */
export function ExamplesBand({ examples, children }: Props) {
  const band = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = band.current;
    const frameEl = pin.current;
    const track = strip.current;
    if (!section || !frameEl || !track) return;
    const driven = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = [...track.querySelectorAll<HTMLElement>("[data-room]")];
    const knobs = [...track.querySelectorAll<HTMLElement>("[role=slider]")];
    // A drag moves a room's line away from where the scroll put it, by `offset`; the offset
    // fades out as the page scrolls on from `at`, so the scroll takes over again smoothly.
    const moved = new Map<number, { offset: number; at: number }>();
    let timeline: number[] = cards.map(() => 0.5);
    let frame = 0;

    const draw = () => {
      frame = 0;
      if (driven) {
        const scrollable = section.offsetHeight - frameEl.offsetHeight;
        const progress = -section.getBoundingClientRect().top / Math.max(1, scrollable);
        const { position, splits } = galleryFrame(progress, cards.length);
        timeline = splits;
        const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 0;
        const centre = cards[0].offsetLeft + cards[0].offsetWidth / 2 + position * step;
        track.style.transform = `translate3d(${(window.innerWidth / 2 - centre).toFixed(1)}px, 0, 0)`;
      }
      cards.forEach((card, i) => {
        let split = timeline[i];
        const m = moved.get(i);
        if (m) {
          const weight = driven ? 1 - Math.abs(window.scrollY - m.at) / HANDBACK_PX : 1;
          if (weight > 0) split = clamp(split + m.offset * weight);
          else moved.delete(i);
        }
        const original = Math.round(split * 100);
        card.style.setProperty("--split", split.toFixed(4));
        knobs[i]?.setAttribute("aria-valuenow", String(original));
        knobs[i]?.setAttribute(
          "aria-valuetext",
          `${original}% original, ${100 - original}% staged`,
        );
      });
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(draw);
    };
    const moveLine = (i: number, split: number) => {
      moved.set(i, { offset: clamp(split) - timeline[i], at: window.scrollY });
      draw();
    };

    let dragging: { index: number; box: HTMLElement } | null = null;
    const toSplit = (box: HTMLElement, clientX: number) => {
      const rect = box.getBoundingClientRect();
      return rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    };
    const onPointerDown = (e: PointerEvent) => {
      const box = (e.target as HTMLElement).closest<HTMLElement>("[data-compare]");
      if (!box) return;
      dragging = { index: Number(box.dataset.compare), box };
      track.setPointerCapture?.(e.pointerId);
      moveLine(dragging.index, toSplit(box, e.clientX));
    };
    const onPointerMove = (e: PointerEvent) => {
      if (dragging) moveLine(dragging.index, toSplit(dragging.box, e.clientX));
    };
    const onPointerUp = () => {
      dragging = null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const i = knobs.indexOf(e.target as HTMLElement);
      if (i < 0) return;
      const current = Number(cards[i].style.getPropertyValue("--split") || 0.5);
      const step = e.shiftKey ? 0.1 : 0.02;
      const next: Record<string, number> = {
        ArrowLeft: current - step,
        ArrowRight: current + step,
        Home: 0,
        End: 1,
      };
      if (e.key in next) {
        e.preventDefault();
        moveLine(i, next[e.key]);
      }
    };

    draw();
    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointermove", onPointerMove);
    track.addEventListener("pointerup", onPointerUp);
    track.addEventListener("pointercancel", onPointerUp);
    track.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("pointerup", onPointerUp);
      track.removeEventListener("pointercancel", onPointerUp);
      track.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  if (examples.length === 0) return null;

  return (
    <>
      {/* Tall enough for 70% of a screen of scrolling per room; the frame inside stays pinned. */}
      <section
        ref={band}
        aria-labelledby="examples-title"
        className="relative motion-safe:h-[calc(100svh+var(--rooms)*70svh)]"
        style={{ "--rooms": examples.length } as CSSProperties}
      >
        <div
          ref={pin}
          className="flex flex-col pt-3 pb-4 motion-safe:sticky motion-safe:top-0 motion-safe:h-svh motion-safe:overflow-hidden sm:pt-6 lg:pt-8"
        >
          {children}
          <h2 id="examples-title" className="sr-only">
            Before and after examples
          </h2>
          <div className="mt-5 motion-reduce:snap-x motion-reduce:snap-mandatory motion-reduce:overflow-x-auto sm:mt-7">
            <div
              ref={strip}
              className="relative flex w-max gap-4 px-4 will-change-transform sm:gap-6 sm:px-6 lg:px-8"
            >
              {examples.map((e, i) => (
                <ExampleCard key={e.id} example={e} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>
      <p className="shell mt-3 text-[12.5px] leading-relaxed text-ink-3">
        {examplesSource(examples)}
      </p>
    </>
  );
}

function ExampleCard({ example: e, index }: { example: Example; index: number }) {
  const style = styleName(e.style);
  // The line, its knob and the tags follow --split (1 = all original, 0 = all staged); the line
  // fades out at either end, where there's nothing to compare.
  const atLine = "clamp(0, calc((min(var(--split), 1 - var(--split))) * 30), 1)";
  return (
    <figure
      data-room
      // Sized so the headline, the room and its caption fit on one screen: taller rooms on
      // phones (4:5), the photo's own 3:2 from small tablets up.
      className="w-[min(88vw,calc((100svh-21rem)*0.8))] shrink-0 snap-center sm:w-[min(88vw,calc((100svh-21rem)*1.5),64rem)]"
      style={{ "--split": 0.5 } as CSSProperties}
    >
      <div
        data-compare={index}
        className="relative aspect-[4/5] cursor-ew-resize touch-pan-y overflow-hidden rounded-[3px] bg-paper-2 select-none sm:aspect-[3/2]"
      >
        {/* Static files sized by `make examples`: next/image would add nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/examples/${e.id}-after.jpg`}
          alt={`${e.title}, virtually staged in ${style}`}
          width={e.width}
          height={e.height}
          decoding="async"
          draggable={false}
          className="absolute inset-0 size-full object-cover"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/examples/${e.id}-before.jpg`}
          alt={`${e.title}, empty`}
          width={e.width}
          height={e.height}
          decoding="async"
          draggable={false}
          className="absolute inset-0 size-full object-cover"
          style={{ clipPath: "inset(0 calc((1 - var(--split)) * 100%) 0 0)" }}
        />
        <span
          className="photo-tag absolute top-3 left-3"
          style={{ opacity: "clamp(0, calc((var(--split) - 0.12) * 8), 1)" }}
        >
          Original
        </span>
        <span
          className="photo-tag absolute top-3 right-3"
          style={{ opacity: "clamp(0, calc((0.88 - var(--split)) * 8), 1)" }}
        >
          <span className="size-1.5 rounded-full bg-shu" aria-hidden />
          Virtually staged
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_0_0.5px_rgba(0,0,0,0.2)]"
          style={{ left: "calc(var(--split) * 100%)", opacity: atLine }}
        />
        <span
          role="slider"
          tabIndex={0}
          aria-label={`Compare the ${e.title.toLowerCase()} before and after`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={50}
          className="absolute top-1/2 grid size-11 -translate-1/2 place-items-center rounded-full bg-white text-ink shadow-[0_6px_24px_-6px_rgba(0,0,0,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-shu focus-visible:ring-offset-2"
          // Kept inside the photo at either end, so it can always be grabbed and brought back.
          style={{ left: "clamp(1.5rem, calc(var(--split) * 100%), calc(100% - 1.5rem))" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path
              d="M6.5 4.5 2 9l4.5 4.5M11.5 4.5 16 9l-4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <figcaption className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-serif text-[1.3rem] leading-none text-ink">{e.title}</span>
        <span
          className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide whitespace-nowrap text-ink-3 uppercase"
          title={`Structure check: ${Math.round(e.structure.score * 100)}% of the room's edges match`}
        >
          {style}
          {e.seconds !== null && ` · ${e.seconds.toFixed(0)} s`}
          <span aria-hidden>·</span>
          <span aria-hidden className="size-1.5 rounded-full bg-moss" />
          room unchanged
        </span>
      </figcaption>
    </figure>
  );
}
