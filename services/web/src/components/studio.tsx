"use client";

import { useRef, useState } from "react";

import { errorMessage, HeyaApi } from "@/lib/api";
import { megabytes } from "@/lib/format";
import { photoProblem } from "@/lib/photo";
import { styleName } from "@/lib/styles";
import type { FurnitureItem, Staging, StyleId } from "@/lib/types";
import { visitorId } from "@/lib/visitor";

import { CompareSlider } from "./compare-slider";
import { DropZone, SAMPLE } from "./drop-zone";
import { Elapsed } from "./elapsed";
import { ListingWriter } from "./listing-writer";
import { ResultBar } from "./result-bar";
import { ShopTheLook } from "./shop-the-look";
import { StylePicker } from "./style-picker";

interface Photo {
  file: File;
  preview: string; // an object URL, so the photo shows before it's uploaded
  width: number;
  height: number;
}

export interface StagedRoom {
  staging: Staging;
  /** From the click to the staged photo being ready to show, measured in this browser. */
  seconds: number;
  ratio: number;
}

type Upload = { state: "uploading" | "ready" | "failed"; id: Promise<string> };

/** The whole flow on one screen: photo, style, stage; then shop the look and write the listing. */
export function Studio({ apiUrl }: { apiUrl: string }) {
  const client = useRef<HeyaApi | null>(null);
  const upload = useRef<Upload | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const stageArea = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [uploadState, setUploadState] = useState<Upload["state"] | null>(null);
  const [style, setStyle] = useState<StyleId>("japandi");
  const [staging, setStaging] = useState<{ since: number; style: StyleId } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<StagedRoom[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = rooms.find((r) => r.staging.id === activeId) ?? null;

  // Created on first use, in the browser: the visitor id lives in localStorage.
  const api = () => (client.current ??= new HeyaApi(apiUrl, visitorId(localStorageOrNull())));

  const startUpload = (file: File) => {
    const id = (async () => {
      const ticket = await api().createUpload(file);
      await api().sendToStorage(ticket, file);
      return ticket.upload_id;
    })();
    const current: Upload = { state: "uploading", id };
    const settle = (state: Upload["state"]) => {
      current.state = state;
      if (upload.current === current) setUploadState(state);
    };
    upload.current = current;
    setUploadState("uploading");
    // A failure shows when the user stages (which retries the upload once), not before.
    id.then(
      () => settle("ready"),
      () => settle("failed"),
    );
  };

  const choose = async (file: File) => {
    const problem = photoProblem(file);
    if (problem) return setError(problem);
    const preview = URL.createObjectURL(file);
    const size = await imageSize(preview);
    if (!size) {
      URL.revokeObjectURL(preview);
      return setError("That file isn't a photo we can read.");
    }
    if (Math.min(size.width, size.height) < 256) {
      URL.revokeObjectURL(preview);
      return setError("That photo is too small. Use one at least 256 pixels on each side.");
    }
    if (photo) URL.revokeObjectURL(photo.preview);
    setError(null);
    setActiveId(null);
    setPhoto({ file, preview, ...size });
    startUpload(file);
  };

  const chooseSample = async () => {
    try {
      const blob = await (await fetch(SAMPLE.src)).blob();
      await choose(new File([blob], SAMPLE.name, { type: "image/jpeg" }));
    } catch {
      setError("The sample photo didn't load. Try again.");
    }
  };

  const stage = async () => {
    if (!photo || staging) return;
    const since = performance.now();
    setStaging({ since, style });
    // On a phone the button sits below the photo: bring the photo into view for the reveal.
    stageArea.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setError(null);
    try {
      // The upload started when the photo was chosen; it's usually done by now. Retry it once.
      if (!upload.current || upload.current.state === "failed") startUpload(photo.file);
      const uploadId = await upload.current!.id;
      const result = await api().stage(uploadId, style);
      // Load both photos before showing them, so the reveal plays on real pixels.
      await Promise.all([imageSize(result.staged_url), imageSize(result.original_url)]);
      const room = {
        staging: result,
        seconds: (performance.now() - since) / 1000,
        ratio: photo.width / photo.height,
      };
      setRooms((rs) => [room, ...rs]);
      setActiveId(result.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStaging(null);
    }
  };

  const listed = (stagingId: string, items: FurnitureItem[]) =>
    setRooms((rs) =>
      rs.map((r) =>
        r.staging.id === stagingId ? { ...r, staging: { ...r.staging, furniture: items } } : r,
      ),
    );

  const busy = staging !== null;
  const ratio = photo ? photo.width / photo.height : 3 / 2;

  return (
    <>
      <section
        aria-label="Stage a room"
        className="shell grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div ref={stageArea} className="min-w-0 scroll-mt-4">
          <DropZone inputRef={picker} onFile={choose} onSample={chooseSample} disabled={busy}>
            {staging && photo ? (
              <StagingInProgress photo={photo} since={staging.since} style={staging.style} />
            ) : active ? (
              <CompareSlider
                key={active.staging.id}
                before={active.staging.original_url}
                after={active.staging.staged_url}
                alt="The room"
                ratio={active.ratio}
                reveal
              />
            ) : photo ? (
              <Framed ratio={ratio}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.preview}
                  alt="Your room, before staging"
                  className="size-full object-cover"
                />
                <span className="photo-tag absolute top-3 left-3">Original</span>
              </Framed>
            ) : null}
          </DropZone>

          {active && !busy && <ResultBar room={active} />}

          {rooms.length > 1 && (
            <RoomStrip rooms={rooms} activeId={activeId} onPick={setActiveId} disabled={busy} />
          )}
        </div>

        <aside className="self-start lg:sticky lg:top-8">
          <Step n="01" title="Photo">
            {photo ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.preview}
                  alt=""
                  className="h-11 w-16 shrink-0 rounded-[3px] object-cover ring-1 ring-black/10"
                />
                <div className="min-w-0 flex-1 text-[13px]">
                  <p className="truncate font-medium text-ink">{photo.file.name}</p>
                  <p className="text-ink-3 tabular-nums">
                    {photo.width} × {photo.height} · {megabytes(photo.file.size)} ·{" "}
                    <UploadStatus state={uploadState} />
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => picker.current?.click()}
                  disabled={busy}
                  className="link shrink-0 text-[13px] disabled:opacity-40"
                >
                  Replace
                </button>
              </div>
            ) : (
              <p className="text-[15px] text-ink-3">A photo of an empty or dated room.</p>
            )}
          </Step>

          <Step n="02" title="Style">
            <StylePicker value={style} onChange={setStyle} disabled={busy} />
          </Step>

          <div className="mt-7">
            <button
              type="button"
              onClick={stage}
              disabled={!photo || busy}
              className="btn-primary w-full justify-between py-3.5 text-[15px]"
            >
              <span>{busy ? "Staging…" : `Stage in ${styleName(style)}`}</span>
              <span aria-hidden>→</span>
            </button>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-amber">
                {error}
              </p>
            ) : (
              <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
                Furniture and decor only. Walls, windows and floors stay as they are, and the photo
                is labelled &ldquo;Virtually staged&rdquo;.
              </p>
            )}
          </div>
        </aside>
      </section>

      {active && (
        <section aria-label="Use the staged photo" className="shell mt-20">
          <div className="grid gap-x-16 gap-y-14 border-t border-line pt-14 lg:grid-cols-2">
            <ShopTheLook
              key={active.staging.id}
              staging={active.staging}
              api={api}
              onListed={listed}
            />
            <ListingWriter stagingIds={rooms.map((r) => r.staging.id)} api={api} />
          </div>
        </section>
      )}
    </>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-7 first:mt-0">
      <h2 className="mb-3 flex items-baseline gap-3 text-[13px] font-medium tracking-wide text-ink uppercase">
        <span className="font-mono text-xs text-ink-4">{n}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function UploadStatus({ state }: { state: Upload["state"] | null }) {
  if (state === "uploading") return <span className="text-ink-3">uploading…</span>;
  if (state === "failed") return <span className="text-amber">upload failed, will retry</span>;
  return <span className="text-moss">ready</span>;
}

function Framed({ ratio, children }: { ratio: number; children: React.ReactNode }) {
  return (
    <div
      className="relative mx-auto w-full overflow-hidden"
      style={{ aspectRatio: ratio, maxWidth: `calc(74svh * ${ratio})` }}
    >
      {children}
    </div>
  );
}

function StagingInProgress({
  photo,
  since,
  style,
}: {
  photo: Photo;
  since: number;
  style: StyleId;
}) {
  return (
    <Framed ratio={photo.width / photo.height}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.preview} alt="Your room, being staged" className="size-full object-cover" />
      <div aria-hidden className="absolute inset-0 bg-ink/15" />
      <div aria-hidden className="sweep absolute inset-y-0 w-1/3" />
      <div
        role="status"
        className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-4 rounded-[4px] bg-ink/80 px-4 py-3 text-paper backdrop-blur-md"
      >
        <span className="flex items-center gap-3 text-sm">
          <span className="pulse-dot" aria-hidden />
          Furnishing in {styleName(style)}
        </span>
        <span className="font-mono text-xs text-paper/70">
          <Elapsed since={since} />
        </span>
      </div>
    </Framed>
  );
}

function RoomStrip({
  rooms,
  activeId,
  onPick,
  disabled,
}: {
  rooms: StagedRoom[];
  activeId: string | null;
  onPick: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-8">
      <p className="mb-3 text-[13px] text-ink-3">This session · {rooms.length} staged photos</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {rooms.map(({ staging }) => {
          const on = staging.id === activeId;
          return (
            <button
              key={staging.id}
              type="button"
              onClick={() => onPick(staging.id)}
              disabled={disabled}
              aria-pressed={on}
              className="group shrink-0 text-left disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={staging.staged_url}
                alt=""
                className={`h-16 w-24 rounded-[3px] object-cover transition ${
                  on
                    ? "ring-2 ring-ink ring-offset-2 ring-offset-paper"
                    : "opacity-75 group-hover:opacity-100"
                }`}
              />
              <span className={`mt-1.5 block text-xs ${on ? "text-ink" : "text-ink-3"}`}>
                {styleName(staging.style)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Load an image and return its size, or null if it can't be decoded. */
async function imageSize(src: string): Promise<{ width: number; height: number } | null> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}
