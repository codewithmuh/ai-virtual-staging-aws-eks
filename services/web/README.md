# web

The Heya web app (Next.js 16, React 19, Tailwind CSS): the studio on `/` (upload, style, before/after, shop the
look, listing) and the share page on `/s/{id}` that buyers see. Above the studio, a strip of before/after examples
slides left as the page scrolls; `make examples` makes them (see the repository README). How the app reaches
the API, and why, is in [ADR 0004](../../docs/adr/0004-web-app-and-one-domain.md).

```bash
make dev          # from the repository root: hot reload on :3000; the API must be on :8000
```

| Variable | Default | What it is |
|---|---|---|
| `PUBLIC_API_URL` | `http://localhost:8000` | Where browsers send API calls. Empty in AWS: the same domain |
| `API_URL` | `PUBLIC_API_URL` | Where the share page's server-side render reads stagings, e.g. the Kubernetes Service |

Both are read per request, so one image runs in every environment.

Runtime contract: `/healthz` and `/readyz`, graceful shutdown on SIGTERM, non-root and read-only (Next.js may
write to `.next/cache`, so mount a writable `emptyDir` or `tmpfs` there).

`npm test` covers the API client, the photo checks and the before/after slider, with an 80% coverage gate; the
full flow is checked in a browser against the local stack. The sample room in `public/samples/` was
generated with Gemini, not photographed.
