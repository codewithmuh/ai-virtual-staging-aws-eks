"use client";

import { useState, type FormEvent } from "react";

import { errorMessage, type HeyaApi } from "@/lib/api";
import type { Listing, ListingFacts } from "@/lib/types";

const PROPERTY_TYPES = ["Apartment", "House", "Condo", "Townhouse", "Studio", "Loft"];

interface Props {
  /** The staged photos Claude reads, newest first (the API takes up to six). */
  stagingIds: string[];
  api: () => HeyaApi;
}

export function ListingWriter({ stagingIds, api }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [copied, setCopied] = useState(false);
  const photos = stagingIds.slice(0, 6);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const area = String(form.get("area") ?? "").trim();
    const facts: ListingFacts = {
      property_type: String(form.get("type")).toLowerCase(),
      bedrooms: Number(form.get("bedrooms")),
      bathrooms: Number(form.get("bathrooms")),
      area_sqm: area ? Number(area) : null,
      location: String(form.get("location")).trim(),
      notes: String(form.get("notes") ?? "").trim(),
    };
    setBusy(true);
    setError(null);
    try {
      setListing(await api().listing(photos, facts));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!listing) return;
    const text = [
      listing.headline,
      listing.description,
      listing.highlights.map((h) => `• ${h}`).join("\n"),
    ].join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="section-title">Write the listing</h2>
      <p className="mt-2 max-w-md text-[15px] text-ink-2">
        Claude writes it from{" "}
        {photos.length === 1 ? "the staged photo" : `${photos.length} staged photos`} and your
        facts. It describes the space and light, not the furniture: that doesn&apos;t come with the
        home.
      </p>

      <form onSubmit={submit} className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <Field label="Property" className="col-span-2 sm:col-span-1">
          <select name="type" className="input select" defaultValue="Apartment">
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Bedrooms">
          <input
            name="bedrooms"
            type="number"
            min={0}
            max={20}
            defaultValue={2}
            required
            className="input"
          />
        </Field>
        <Field label="Bathrooms">
          <input
            name="bathrooms"
            type="number"
            min={0}
            max={20}
            step={0.5}
            defaultValue={1}
            required
            className="input"
          />
        </Field>
        <Field label="Area, m²" hint="optional" className="col-span-2 sm:col-span-1">
          <input
            name="area"
            type="number"
            min={1}
            max={10000}
            className="input"
            placeholder="e.g. 68"
          />
        </Field>
        <Field label="Location" className="col-span-2 sm:col-span-4">
          <input
            name="location"
            required
            maxLength={120}
            className="input"
            placeholder="Nakameguro, Tokyo"
          />
        </Field>
        <Field label="Anything else" hint="optional" className="col-span-2 sm:col-span-4">
          <textarea
            name="notes"
            rows={2}
            maxLength={600}
            className="input resize-y"
            placeholder="South-facing, 5 minutes to the station, renovated in 2024"
          />
        </Field>
        <div className="col-span-2 flex items-center gap-4 sm:col-span-4">
          <button type="submit" disabled={busy || photos.length === 0} className="btn-secondary">
            {busy ? "Writing…" : listing ? "Write it again" : "Write the listing"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-amber">
              {error}
            </p>
          )}
        </div>
      </form>

      {listing && (
        <article className="mt-8 border-t border-line pt-6" aria-live="polite">
          <div className="flex items-start justify-between gap-6">
            <h3 className="font-serif text-[1.75rem] leading-tight text-ink">{listing.headline}</h3>
            <button type="button" onClick={copy} className="link shrink-0 pt-2 text-[13px]">
              {copied ? "Copied" : "Copy text"}
            </button>
          </div>
          {listing.description.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="mt-4 text-[15px] leading-relaxed text-ink-2">
              {p}
            </p>
          ))}
          <ul className="mt-5 space-y-1.5">
            {listing.highlights.map((h) => (
              <li key={h} className="flex gap-3 text-[15px] text-ink">
                <span aria-hidden className="text-ink-4">
                  —
                </span>
                {h}
              </li>
            ))}
          </ul>
        </article>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] text-ink-2">
        {label}
        {hint && <span className="text-xs text-ink-4">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
