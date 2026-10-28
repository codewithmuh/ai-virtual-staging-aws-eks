"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

interface Props {
  before: string;
  after: string;
  /** What the room is, for screen readers, e.g. "Living room". */
  alt: string;
  /** Wipe the staged photo in from the right when it first appears. */
  reveal?: boolean;
  /** Width ÷ height, if known before the photo loads; avoids a jump in layout. */
  ratio?: number;
}

const REVEAL_MS = 1400;

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/**
 * The original and the staged photo on top of each other, split by a handle (rule R1: a staged
 * photo is always shown with its original). Left of the handle is the original.
 */
export function CompareSlider({ before, after, alt, reveal = false, ratio: knownRatio }: Props) {
  const [pos, setPos] = useState(reveal ? 100 : 50);
  const [ratio, setRatio] = useState(knownRatio ?? 3 / 2);
  const box = useRef<HTMLDivElement>(null);
  const afterImg = useRef<HTMLImageElement>(null);
  const dragging = useRef(false);
  const frame = useRef(0);

  useEffect(() => {
    if (!reveal) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / REVEAL_MS);
      const eased = 1 - (1 - t) ** 4;
      setPos(100 - 50 * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    // A short pause first, so the eye lands on the empty room before it fills.
    const delay = setTimeout(() => (frame.current = requestAnimationFrame(tick)), 250);
    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(frame.current);
    };
  }, [reveal, after]);

  // A photo served from the browser cache can finish loading before React attaches onLoad.
  useEffect(() => {
    const img = afterImg.current;
    if (img?.complete && img.naturalWidth) setRatio(img.naturalWidth / img.naturalHeight);
  }, [after]);

  const moveTo = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (rect && rect.width > 0) setPos(clamp(((clientX - rect.left) / rect.width) * 100));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    cancelAnimationFrame(frame.current);
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    const next: Record<string, number> = {
      ArrowLeft: pos - step,
      ArrowRight: pos + step,
      Home: 0,
      End: 100,
    };
    if (e.key in next) {
      e.preventDefault();
      cancelAnimationFrame(frame.current);
      setPos(clamp(next[e.key]));
    }
  };

  const rounded = Math.round(pos);

  return (
    <div
      ref={box}
      className="relative mx-auto w-full cursor-ew-resize touch-pan-y overflow-hidden select-none"
      style={{ aspectRatio: ratio, maxWidth: `calc(74svh * ${ratio})` }}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => dragging.current && moveTo(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* Presigned S3 URLs, already sized by the API: next/image would only proxy them. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={afterImg}
        src={after}
        alt={`${alt}, virtually staged`}
        draggable={false}
        onLoad={(e) =>
          setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || ratio)
        }
        className="absolute inset-0 size-full object-cover"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={before}
        alt={`${alt}, original photo`}
        draggable={false}
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />

      <span
        className="photo-tag absolute top-3 left-3 transition-opacity duration-300"
        style={{ opacity: pos < 12 ? 0 : 1 }}
      >
        Original
      </span>
      <span
        className="photo-tag absolute top-3 right-3 transition-opacity duration-300"
        style={{ opacity: pos > 88 ? 0 : 1 }}
      >
        <span className="size-1.5 rounded-full bg-shu" aria-hidden />
        Virtually staged
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_0_0.5px_rgba(0,0,0,0.25)]"
        style={{ left: `${pos}%` }}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare the original and the staged photo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rounded}
          aria-valuetext={`${rounded}% original, ${100 - rounded}% staged`}
          onKeyDown={onKeyDown}
          className="pointer-events-auto absolute top-1/2 left-1/2 grid size-11 -translate-1/2 cursor-ew-resize place-items-center rounded-full bg-white text-ink shadow-[0_6px_24px_-6px_rgba(0,0,0,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-shu focus-visible:ring-offset-2"
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
        </div>
      </div>
    </div>
  );
}
