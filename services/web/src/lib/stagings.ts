import "server-only";

import { cache } from "react";

import { serverApiUrl } from "./config";
import type { Staging } from "./types";

const STAGING_ID = /^[0-9a-f]{32}$/;

/**
 * One staging for the share page, or null if there's no such staging. `cache` shares the result
 * between the page and its metadata within one request.
 */
export const getStaging = cache(async (id: string): Promise<Staging | null> => {
  if (!STAGING_ID.test(id)) return null;
  const response = await fetch(`${serverApiUrl()}/v1/stagings/${id}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET /v1/stagings/${id} returned ${response.status}`);
  return (await response.json()) as Staging;
});
