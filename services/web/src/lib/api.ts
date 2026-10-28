import type {
  FurnitureItem,
  ImageType,
  Listing,
  ListingFacts,
  Staging,
  StyleId,
  UploadTicket,
} from "./types";

/** An error the UI can show as is: `message` is written for the person using the app. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const UNREACHABLE = "Can't reach Heya right now. Check your connection and try again.";

/** What to tell the user about any error thrown while talking to the API. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Try again.";
}

/** Turn any of the API's error bodies into one readable message. */
export async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON (a proxy's error page, for example): fall back to the status below.
  }
  const b = (body ?? {}) as { error?: unknown; message?: unknown; detail?: unknown };
  // Our own errors: {"error": "daily_limit", "message": "..."}.
  if (typeof b.message === "string") {
    return new ApiError(
      b.message,
      response.status,
      typeof b.error === "string" ? b.error : "error",
    );
  }
  // FastAPI's HTTPException: {"detail": "..."}.
  if (typeof b.detail === "string") {
    return new ApiError(b.detail, response.status, response.status === 404 ? "not_found" : "error");
  }
  // FastAPI's validation errors: {"detail": [{"msg": "...", ...}]}. A bug in this app, not the user's.
  if (Array.isArray(b.detail)) {
    return new ApiError("Something in that request wasn't valid.", response.status, "invalid");
  }
  return new ApiError(
    `Something went wrong (HTTP ${response.status}). Try again.`,
    response.status,
    "error",
  );
}

/** The browser's side of the staging API. One instance per page, with this browser's visitor id. */
export class HeyaApi {
  constructor(
    private readonly base: string,
    private readonly visitorId: string,
  ) {}

  private async call<T>(path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          // Counts this browser against its daily limit (rule R4).
          "X-Visitor-Id": this.visitorId,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(UNREACHABLE, 0, "network");
    }
    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as T;
  }

  createUpload(file: File): Promise<UploadTicket> {
    return this.call("/v1/uploads", {
      content_type: file.type as ImageType,
      size_bytes: file.size,
    });
  }

  /** Send the photo straight to S3 with the presigned POST. The file must be the last field. */
  async sendToStorage(ticket: UploadTicket, file: File): Promise<void> {
    const form = new FormData();
    for (const [key, value] of Object.entries(ticket.fields)) form.append(key, value);
    form.append("file", file);
    let response: Response;
    try {
      response = await fetch(ticket.url, { method: "POST", body: form });
    } catch {
      throw new ApiError(UNREACHABLE, 0, "network");
    }
    if (!response.ok) {
      // S3 answers in XML, e.g. <Code>EntityTooLarge</Code>.
      const code = /<Code>([^<]+)<\/Code>/.exec(await response.text())?.[1] ?? "UploadFailed";
      const message =
        code === "EntityTooLarge"
          ? "That photo is over 10 MB. Use a smaller one."
          : "The photo didn't upload. Try again.";
      throw new ApiError(message, response.status, code);
    }
  }

  stage(uploadId: string, style: StyleId): Promise<Staging> {
    return this.call("/v1/stagings", { upload_id: uploadId, style });
  }

  async furniture(stagingId: string): Promise<FurnitureItem[]> {
    const { items } = await this.call<{ items: FurnitureItem[] }>(
      `/v1/stagings/${stagingId}/furniture`,
      {},
    );
    return items;
  }

  listing(stagingIds: string[], facts: ListingFacts): Promise<Listing> {
    return this.call("/v1/listings", { staging_ids: stagingIds, facts });
  }
}
