"use client";

import { useState } from "react";

import { errorMessage, type HeyaApi } from "@/lib/api";
import type { FurnitureItem, Staging } from "@/lib/types";

import { FurnitureRows } from "./furniture-rows";

interface Props {
  staging: Staging;
  api: () => HeyaApi;
  onListed: (stagingId: string, items: FurnitureItem[]) => void;
}

export function ShopTheLook({ staging, api, onListed }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = staging.furniture;

  const list = async () => {
    setLoading(true);
    setError(null);
    try {
      onListed(staging.id, await api().furniture(staging.id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="section-title">Shop this look</h2>
      <p className="mt-2 max-w-md text-[15px] text-ink-2">
        Claude names the main pieces in the staged photo, with a search for each.
      </p>
      <div className="mt-6">
        {items ? (
          <FurnitureRows items={items} />
        ) : loading ? (
          <RowsLoading />
        ) : (
          <button type="button" onClick={list} className="btn-secondary">
            List the furniture
          </button>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-amber">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function RowsLoading() {
  return (
    <div role="status" aria-label="Listing the furniture" className="border-y border-line">
      {[0.72, 0.55, 0.64].map((w, i) => (
        <div key={i} className="flex items-center gap-4 border-line py-4 not-last:border-b">
          <span className="h-3 w-6 rounded bg-paper-3" />
          <span className="flex-1 space-y-2">
            <span className="shimmer block h-3 rounded" style={{ width: `${w * 100}%` }} />
            <span className="shimmer block h-2.5 w-1/3 rounded" />
          </span>
        </div>
      ))}
    </div>
  );
}
