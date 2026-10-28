"use client";

import { useState, type DragEvent, type ReactNode, type RefObject } from "react";

import { ACCEPTED } from "@/lib/photo";

export const SAMPLE = { src: "/samples/empty-living-room.jpg", name: "empty-living-room.jpg" };

interface Props {
  /** The hidden file input, so other controls (the panel's "Replace") can open the picker too. */
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  onSample: () => void;
  /** What's on the stage. Without it, the drop zone shows its own invitation. */
  children?: ReactNode;
  disabled?: boolean;
}

/** The stage: a drop target for a room photo at all times, with an invitation while it's empty. */
export function DropZone({ inputRef, onFile, onSample, children, disabled }: Props) {
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file && !disabled) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={onDrop}
      className="relative"
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = ""; // so choosing the same file again still fires
        }}
      />

      {children ?? (
        <div className="relative grid aspect-[3/2] w-full place-items-center overflow-hidden bg-paper-2 px-6 text-center">
          <RoomOutline />
          <div className="relative flex max-w-sm flex-col items-center">
            <p className="font-serif text-[clamp(1.75rem,3.4vw,2.5rem)] leading-[1.05] text-balance text-ink">
              {/* Nothing can be dropped on a touch screen. */}
              <span className="pointer-coarse:hidden">Drop a photo of an empty room</span>
              <span className="hidden pointer-coarse:inline">Add a photo of an empty room</span>
            </p>
            <p className="mt-3 text-sm text-ink-3">JPEG, PNG or WebP, up to 10 MB</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="btn-primary"
              >
                Choose a photo
              </button>
              <button type="button" onClick={onSample} className="btn-quiet group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={SAMPLE.src}
                  alt=""
                  className="h-7 w-10 rounded-[3px] object-cover ring-1 ring-black/10"
                />
                Try a sample room
              </button>
            </div>
          </div>
        </div>
      )}

      {over && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-paper/85 outline-2 -outline-offset-8 outline-shu backdrop-blur-[2px] outline-dashed">
          <p className="font-serif text-3xl text-ink">Drop to use this photo</p>
        </div>
      )}
    </div>
  );
}

/** A faint floor plan behind the invitation: the room waiting to be furnished. */
function RoomOutline() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 300 200"
      className="pointer-events-none absolute inset-0 size-full text-ink/[0.07]"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.6"
    >
      <path d="M0 0 105 62v86L0 200M300 0 195 62v86l105 52M105 62h90M105 148h90" />
    </svg>
  );
}
