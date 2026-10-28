# Heya (部屋): AI Virtual Staging on AWS EKS

[![ci](https://github.com/codewithmuh/ai-virtual-staging-aws-eks/actions/workflows/ci.yml/badge.svg)](https://github.com/codewithmuh/ai-virtual-staging-aws-eks/actions/workflows/ci.yml)
[![release](https://github.com/codewithmuh/ai-virtual-staging-aws-eks/actions/workflows/release.yml/badge.svg)](https://github.com/codewithmuh/ai-virtual-staging-aws-eks/actions/workflows/release.yml)
[![License: learning only, no commercial use](https://img.shields.io/badge/License-learning%20only%2C%20no%20commercial%20use-orange.svg)](LICENSE)

**An empty room becomes a furnished one in seconds.** Heya is an AI virtual-staging app for real estate:
upload a photo of an empty or dated room, pick a style, and get a staged photo, a list of the furniture in it
and a listing description. It runs on Amazon EKS, set up the way a production team would.

> **Virtual staging, honestly labelled.** Every staged photo says "Virtually staged" and is always shown next
> to the original. Heya adds furniture and decor only; it never changes walls, windows, floors or views. Many
> listing services require this; check the rules where you list.

**Status: phase 0, building in public.** The web app and the staging API are done and run locally with no AWS
account and no AI keys; comparing OpenAI and Gemini on real photos is next. See the [roadmap](docs/roadmap.md).

## Part 1 of AI on EKS

Five production AI apps on Amazon EKS, one industry each. Every part adds one new layer of Kubernetes on top of
the parts before it.

| Part | Project | Industry | New on Kubernetes |
|---|---|---|---|
| **1** | **Heya: AI virtual staging (this repo)** | **Real estate** | **EKS basics: ALB Ingress with HTTPS, HPA, Pod Identity, then Argo CD** |
| 2 | [Karute](https://github.com/codewithmuh/ai-medical-scribe-aws-eks): AI medical scribe | Healthcare | Security: NetworkPolicies, VPC endpoints, External Secrets, WebSockets |
| 3 | [Kisekae](https://github.com/codewithmuh/ai-virtual-try-on-aws-eks): AI virtual try-on | Fashion | GPUs: Karpenter, KEDA on SQS, Spot, scale to zero |
| 4 | [Fukikae](https://github.com/codewithmuh/ai-video-dubbing-aws-eks): AI dubbing in your own voice | Media | GPU pipelines: Argo Workflows, GPU sharing, RBAC |
| 5 | [Mimamori](https://github.com/codewithmuh/ai-cctv-video-search-aws-eks): AI CCTV video search | Security & retail | Operators (CRD), batched model serving, GPU metrics, SLOs |

## The demo

Scroll the home page: a strip of empty rooms (living room, bedroom, home office, open-plan workspace, dining room,
studio) slides past, and each one is furnished as it crosses the screen. Then try your own:

1. Upload a photo of an empty room (or click "Try a sample room").
2. Pick a style: Japandi, Scandinavian, Industrial or Modern.
3. The furnished room wipes in over the empty one, with a before/after slider and the "Virtually staged" label.
4. "Shop this look" lists the main pieces in the photo.
5. Claude writes the listing description from the photos and the facts you enter.
6. "Copy share link" gives a page a buyer can open: the same slider, nothing to install.

Then the platform demo: run a load test, kill pods and a node, and watch the autoscaler and the load balancer
keep the app up.

## What it proves

| Question an interviewer asks | How Heya answers it |
|---|---|
| "How do you get traffic into EKS with HTTPS?" | One Ingress: the AWS Load Balancer Controller creates the ALB, ACM provides the certificate, ExternalDNS writes the DNS record |
| "How does it scale?" | HorizontalPodAutoscaler, PodDisruptionBudgets and a load test with published numbers |
| "How do pods reach S3 without access keys?" | EKS Pod Identity: one IAM role per service account, no keys anywhere |
| "What happens to a slow AI call behind a load balancer?" | Timeouts set end to end (ALB, uvicorn, client), measured against the image model's real latency |
| "How do you deploy?" | Once by hand with `kubectl`, then Argo CD takes over and git becomes the only way to change the cluster |

The full design, rules and the numbers it will publish are in [docs/scope.md](docs/scope.md).

## The stack

| Layer | Choice |
|---|---|
| AI | Image editing through an API (OpenAI or Gemini, behind one interface so they swap); Claude (vision) for the furniture list and the listing text |
| App | Next.js web, FastAPI API, S3 for photos (presigned uploads), DynamoDB for stagings and usage |
| Kubernetes | EKS with a managed node group, AWS Load Balancer Controller, ExternalDNS, metrics-server, HPA, Kustomize, Argo CD |
| AWS | VPC, EKS, ECR, S3, DynamoDB, ACM, Route 53, Pod Identity, Secrets Manager, all in Terraform |

## Before you start

- An AWS account and a domain in Route 53 (for HTTPS).
- An OpenAI or Google AI (Gemini) API key for image editing, and an Anthropic API key.
- Phase 0 runs on your laptop with no AWS at all.
- Every phase publishes its measured cost per hour and ends with a teardown that leaves nothing running.

## Quick start

Requirements: [uv](https://docs.astral.sh/uv/), Node.js 22 or newer, [pre-commit](https://pre-commit.com/) and
Docker, or just open the **Dev Container**.

```bash
make setup    # install dependencies and git hooks
make check    # lint, type-check, test and build (same as CI)
make up       # web on :3000, API on :8000, S3 and DynamoDB emulated by moto on :4566

open http://localhost:3000                         # the app: click "Try a sample room"
open http://localhost:8000/docs                    # every API endpoint, with a "Try it out" button

make down
```

To work on the web app with hot reload, keep the API running and use `make dev` instead of the `web` container.

### The examples on the home page

They are real Heya results, made by `make examples` with the same pipeline as a staging: metadata removed,
staged, structure checked, labelled. Set `IMAGE_PROVIDER` and its key in `.env` (`openai` with
`OPENAI_API_KEY`, or `gemini` with `GEMINI_API_KEY`), then:

```bash
make examples                                   # six scenes; each empty room is generated, then staged
make examples ARGS="--only workspace --force"   # stage one scene again
```

To bring your own images, put them in `examples-src/` at the repository root (git-ignored), named by scene:
`living-room`, `bedroom`, `home-office`, `workspace`, `dining-room`, `studio` (`.png` or `.jpg`).

```bash
make examples                                          # real photos of empty rooms: Heya stages them
make examples ARGS="--generated-by Gemini"             # empty rooms you made with AI: the page says so
make examples ARGS="--generated-by Gemini --staged-by Gemini"   # also <scene>-staged.png, made outside Heya
```

With `--staged-by`, no API is called: Heya still checks each room's structure and adds the label, and the page
credits the tool for the staging.

Otherwise it's up to two image calls per scene (make the empty room, then stage it), billed by the provider.
The results go to `services/web/public/examples/` and `services/web/src/content/examples.json`; commit both.
Until there are examples, the strip doesn't show.

`make up` uses the **fake** AI providers, so it costs nothing and needs no keys. To use real ones, copy
`.env.example` to `.env` and set:

| Variable | Values | Needs |
|---|---|---|
| `IMAGE_PROVIDER` | `openai`, `gemini`, `fake` | `OPENAI_API_KEY` or `GEMINI_API_KEY` |
| `WRITER_PROVIDER` | `claude`, `fake` | `ANTHROPIC_API_KEY` |

How a staging works, end to end:

1. `POST /v1/uploads` returns a presigned POST; the browser sends the photo straight to S3.
2. `POST /v1/stagings` with the `upload_id` and a style: the API strips the photo's metadata, stages it, checks
   that the room didn't change, adds the "Virtually staged" label and returns both photos' URLs.
3. `POST /v1/stagings/{id}/furniture` lists what's in the photo (cached after the first call).
4. `POST /v1/listings` writes the listing from one to six stagings and the facts you send.

Each browser (`X-Visitor-Id`), IP address and the whole site has a daily limit on AI calls; over it, the API
answers `429` with `Retry-After`. Run `make` with no arguments to list every command.

## Repository layout

```
services/web/      Next.js web app, Dockerfile
  src/app/         the studio (/), the share page (/s/[id]), probes
  src/components/  studio, before/after slider, style picker, shop the look, listing writer
  src/lib/         API client, photo checks, visitor id, styles
services/api/      FastAPI service, Dockerfile, tests/ (with fixture responses in tests/fixtures/)
  src/api/         main (routes, probes, metrics), service (the staging workflow), editors (OpenAI,
                   Gemini, fake), writer (Claude, fake), images (clean, label), structure (rule R2),
                   storage (S3), store (DynamoDB and the daily limits), schemas, config
docs/              scope, roadmap, architecture, threat model, ADRs, runbooks
compose.yaml       local run with production-like hardening
Makefile           every command you need
```

The decisions behind it are in [docs/adr/](docs/adr/). Terraform and the Kubernetes manifests arrive with their
phases in the [roadmap](docs/roadmap.md).

## How changes flow

1. Open a pull request with a [Conventional Commit](https://www.conventionalcommits.org/) title.
2. CI must pass: lint, types, tests, secret and vulnerability scans, image builds and smoke tests.
3. release-please keeps a Release PR open. Merging it tags the version and publishes signed images (web and api)
   to GHCR with SBOMs.

## Production-grade checklist

Every item must pass before v1.0.

- [ ] Code quality: linters, formatters, type checks and pre-commit pass
- [ ] Tests: unit + integration, ≥ 80% coverage, a smoke test and a load test with published numbers
- [ ] CI: every PR runs lint, tests, build and scans; `main` is protected
- [ ] Security: no secrets in git, least privilege, scanned and signed images, SBOM, threat model
- [ ] Infrastructure as code: remote state, `make up` / `make down`, cost estimate, clean teardown
- [ ] Releases: semantic versions, changelog, images in a registry
- [ ] Observability: logs, metrics, traces, dashboards as code, alerts linked to runbooks
- [ ] Reliability: probes, graceful shutdown, timeouts/retries/idempotency, tested backups, written SLOs
- [ ] Docs: README with quick start, architecture, ADRs, runbooks, contributing, license
- [ ] Developer experience: one-command setup, Dev Container or Compose, seed data
- [ ] Demo: screenshots, a short demo video, a write-up

## License

**Learning only. Commercial use is not allowed.** You may clone, run, modify and deploy this project to learn, use
it to teach at a school or in free workshops, and show it in your portfolio with credit. You may not sell it, run it
as a service, use it in company or client work, or use it in paid or monetised courses and videos without written
permission. The full terms are in [LICENSE](LICENSE).

For a commercial license, or if you are unsure whether your use is allowed: **contact@codewithmuh.com**

© 2026 Muhammad Rashid ([CodeWithMuh](https://youtube.com/@codewithmuh)), Senior Platform Engineer ·
[codewithmuh.com](https://codewithmuh.com) · [GitHub](https://github.com/codewithmuh) ·
[LinkedIn](https://www.linkedin.com/in/muhammad-rashid-daha/)
