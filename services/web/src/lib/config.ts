import "server-only";

// Read at request time (callers run after `connection()`), so one image runs in any environment.

/**
 * Where browsers send API calls. Locally that's the API on :8000. In AWS it is set to "" (this
 * site's own domain): the load balancer sends /v1 to the API and everything else to the web app.
 */
export function publicApiUrl(): string {
  return process.env.PUBLIC_API_URL ?? "http://localhost:8000";
}

/** Where this server calls the API, e.g. the Kubernetes Service. Falls back to the public URL. */
export function serverApiUrl(): string {
  return process.env.API_URL || publicApiUrl() || "http://localhost:8000";
}
