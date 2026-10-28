import { describe, expect, it, vi } from "vitest";

import { ApiError, errorMessage, HeyaApi, toApiError } from "./api";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mockFetch(...responses: (Response | Error)[]) {
  const fn = vi.fn<typeof fetch>();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

const photo = new File(["jpeg bytes"], "room.jpg", { type: "image/jpeg" });

describe("HeyaApi", () => {
  it("asks for an upload with the photo's type and size, as this visitor", async () => {
    const fetch = mockFetch(json({ upload_id: "u1", url: "s3", fields: {}, expires_in: 300 }, 201));
    const ticket = await new HeyaApi("http://api", "visitor-123").createUpload(photo);

    expect(ticket.upload_id).toBe("u1");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://api/v1/uploads");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ content_type: "image/jpeg", size_bytes: 10 });
    expect(new Headers(init?.headers).get("X-Visitor-Id")).toBe("visitor-123");
  });

  it("calls the same domain when the base URL is empty", async () => {
    const fetch = mockFetch(json({ items: [] }));
    await new HeyaApi("", "visitor-123").furniture("abc");
    expect(fetch.mock.calls[0][0]).toBe("/v1/stagings/abc/furniture");
  });

  it("sends the policy fields first and the file last, as S3 requires", async () => {
    const fetch = mockFetch(new Response(null, { status: 204 }));
    const ticket = {
      upload_id: "u1",
      url: "http://s3/bucket",
      fields: { key: "k", policy: "p" },
      expires_in: 300,
    };
    await new HeyaApi("", "v").sendToStorage(ticket, photo);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://s3/bucket");
    expect([...(init?.body as FormData).keys()]).toEqual(["key", "policy", "file"]);
  });

  it("explains an S3 rejection in words", async () => {
    mockFetch(new Response("<Error><Code>EntityTooLarge</Code></Error>", { status: 400 }));
    const ticket = { upload_id: "u1", url: "http://s3", fields: {}, expires_in: 300 };
    await expect(new HeyaApi("", "v").sendToStorage(ticket, photo)).rejects.toMatchObject({
      code: "EntityTooLarge",
      message: "That photo is over 10 MB. Use a smaller one.",
    });
  });

  it("stages, lists furniture and writes a listing with the API's own shapes", async () => {
    const fetch = mockFetch(
      json({ id: "s1" }, 201),
      json({ items: [{ name: "sofa" }] }),
      json({ headline: "h", description: "d", highlights: [] }),
    );
    const api = new HeyaApi("", "v");
    await api.stage("u1", "japandi");
    expect(await api.furniture("s1")).toEqual([{ name: "sofa" }]);
    const facts = {
      property_type: "apartment",
      bedrooms: 2,
      bathrooms: 1,
      area_sqm: null,
      location: "Tokyo",
      notes: "",
    };
    await api.listing(["s1"], facts);

    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
      upload_id: "u1",
      style: "japandi",
    });
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toEqual({
      staging_ids: ["s1"],
      facts,
    });
  });

  it("turns a network failure into a message, not a stack trace", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    await expect(new HeyaApi("", "v").stage("u1", "modern")).rejects.toMatchObject({
      status: 0,
      code: "network",
    });
  });

  it("passes the API's error message through", async () => {
    mockFetch(
      json({ error: "daily_limit", scope: "visitor", message: "Today's limit is used up." }, 429),
    );
    await expect(new HeyaApi("", "v").stage("u1", "modern")).rejects.toMatchObject({
      status: 429,
      code: "daily_limit",
      message: "Today's limit is used up.",
    });
  });
});

describe("toApiError", () => {
  it("reads FastAPI's plain detail", async () => {
    const e = await toApiError(json({ detail: "Staging not found." }, 404));
    expect([e.code, e.message]).toEqual(["not_found", "Staging not found."]);
  });

  it("hides validation details, which only a bug in this app would cause", async () => {
    const e = await toApiError(json({ detail: [{ loc: ["body"], msg: "bad" }] }, 422));
    expect([e.code, e.message]).toEqual(["invalid", "Something in that request wasn't valid."]);
  });

  it("copes with a body that isn't JSON", async () => {
    const e = await toApiError(new Response("<html>Bad Gateway</html>", { status: 502 }));
    expect(e.message).toBe("Something went wrong (HTTP 502). Try again.");
  });
});

describe("errorMessage", () => {
  it("shows our messages and hides everything else", () => {
    expect(errorMessage(new ApiError("Try again.", 502, "provider_failed"))).toBe("Try again.");
    expect(errorMessage(new Error("internal detail"))).toBe("Something went wrong. Try again.");
  });
});
