const KEY = "heya.visitor";
const VALID = /^[A-Za-z0-9-]{8,64}$/; // what the API accepts in X-Visitor-Id

/**
 * A random id for this browser, kept in localStorage, so the API can apply the per-visitor
 * daily limit. It identifies a browser, not a person, and is stored hashed on the server.
 */
export function visitorId(storage: Pick<Storage, "getItem" | "setItem"> | null): string {
  try {
    const existing = storage?.getItem(KEY);
    if (existing && VALID.test(existing)) return existing;
    const id = crypto.randomUUID();
    storage?.setItem(KEY, id);
    return id;
  } catch {
    // Storage blocked (private mode, strict settings): a fresh id for this page view.
    return crypto.randomUUID();
  }
}
