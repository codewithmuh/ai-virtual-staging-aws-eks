"use client";

import { useState } from "react";

import { providerName } from "@/lib/format";
import { styleName } from "@/lib/styles";

import type { StagedRoom } from "./studio";
import { StructureNote } from "./structure-note";

/** Under the slider: what happened (style, time, model, structure check) and what to do next. */
export function ResultBar({ room }: { room: StagedRoom }) {
  const { staging, seconds } = room;
  const [copied, setCopied] = useState(false);
  const sharePath = `/s/${staging.id}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(new URL(sharePath, window.location.origin).href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <p className="font-mono text-xs tracking-wide text-ink-3 uppercase">
          {styleName(staging.style)} · ready in{" "}
          <span className="text-ink tabular-nums">{seconds.toFixed(1)} s</span> ·{" "}
          {providerName(staging.provider)}
        </p>
        <StructureNote check={staging.structure} />
      </div>
      <div className="flex shrink-0 items-center gap-5 text-[13px]">
        <button
          type="button"
          onClick={() =>
            download(staging.staged_url, `heya-${staging.style}-${staging.id.slice(0, 8)}.jpg`)
          }
          className="link"
        >
          Download
        </button>
        <button type="button" onClick={copyLink} className="link">
          {copied ? "Link copied" : "Copy share link"}
        </button>
        <a href={sharePath} target="_blank" rel="noopener" className="link">
          Share page <span aria-hidden>↗</span>
        </a>
      </div>
    </div>
  );
}

/** Save the labelled photo. Cross-origin links ignore `download`, so fetch it as a blob first. */
async function download(url: string, filename: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const href = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href, download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
