# 0004. A Next.js web app on the same domain as the API, configured at request time

- Status: accepted
- Date: 2026-10-28

## Context

Heya needs a web app for agents (upload, pick a style, compare, list the furniture, write the listing) and a share
page for buyers. The demo has to work in seconds for someone who isn't a developer, and the share page must look
right when its link is pasted into a chat (a title and an image in the preview).

Part 1 teaches Ingress, so the web app and the API are two Deployments behind one ALB. Two questions follow: how
the browser reaches the API, and how one container image learns where the API is in each environment.

## Decision

- **Next.js 16 (App Router)** in `services/web`, built as a standalone server (`output: "standalone"`): `server.js`
  plus only the `node_modules` it needs, in a non-root, read-only container like the API's.
- **One domain.** In AWS the Ingress sends `/v1/*` to the API and everything else to the web app. The browser calls
  `/v1/...` on the same domain: no CORS, and the ALB puts the client's address in `X-Forwarded-For`, so the
  per-IP daily limit (rule R4) can count real clients.
- **The browser calls the API directly**, never through the web pods. A staging waits tens of seconds on the image
  model; proxying it would hold a web connection for that long and hide the client's address.
- **Configured at request time, not build time.** `PUBLIC_API_URL` tells browsers where the API is: empty in AWS
  (same domain), `http://localhost:8000` locally (the API's `CORS_ORIGINS` allows `localhost:3000`). `API_URL`
  tells the share page's server-side render where to read stagings, e.g. the Kubernetes Service. Both are read
  after `connection()`, so the same image runs everywhere. `NEXT_PUBLIC_*` variables would be frozen into the
  JavaScript at build time.
- **Cache Components** (the Next.js 16 default): the page frame is prerendered and served at once, and the parts
  that need the request (the API address, the shared staging) stream in behind `<Suspense>`.
- **Share pages** render on the server, so link previews get the title and the staged photo (`og:image`). They are
  marked `noindex`; the 128-bit random id in the URL is the only key to them.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Same domain, browser calls the API (chosen) | One certificate and DNS name; no CORS in AWS; real client addresses | Needs a path rule in the Ingress |
| API on its own subdomain | Independent routing | CORS in production, a second certificate and DNS record |
| Web app proxies `/v1` to the API | The browser only knows one host | Long requests held by web pods; client address lost, so per-IP limits break |
| `NEXT_PUBLIC_API_URL` | The usual Next.js pattern | Baked into the build: one image per environment |
| A static single-page app | Simplest hosting | No server-rendered share page, so no link previews |

## Consequences

- Locally there are two origins (`:3000` and `:8000`), so the API keeps a CORS allow-list for local runs.
- Phase 1 adds the `/v1` path rule to the Ingress, sets `PUBLIC_API_URL=""` and `API_URL` to the API's Service,
  starts uvicorn with `--proxy-headers --forwarded-allow-ips` set to the VPC range (otherwise every request seems
  to come from the ALB), and adds the web origin to the photo bucket's CORS (browsers upload to it and download
  from it).
- A share link for a staging that doesn't exist shows the 404 page with `noindex`, but answers HTTP 200: the
  prerendered frame is already streaming when the lookup fails. Acceptable for an unlisted link.
- Web tests cover the logic the UI rests on (API client, photo checks, the slider); the full flow is checked in a
  browser against the local stack.
