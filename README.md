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

**Status: phase 0, building in public.** The repository, CI and the API's plumbing are done; the staging API is next.
See the [roadmap](docs/roadmap.md).

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

1. Upload a photo of an empty room.
2. Pick a style: Japandi, Scandinavian, Industrial or Modern.
3. The furnished room appears in seconds, with a before/after slider and the "Virtually staged" label.
4. "Shop this look" lists the main pieces in the photo.
5. Claude writes the listing description from the photos and the facts you enter.

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

Requirements: [uv](https://docs.astral.sh/uv/), [pre-commit](https://pre-commit.com/) and Docker, or just open
the **Dev Container**.

```bash
make setup    # install dependencies and git hooks
make check    # lint, type-check and test (same as CI)
make up       # the API on :8000

curl localhost:8000/healthz          # {"status":"ok"}
curl localhost:8000/readyz           # {"status":"ready"}

make down
```

Run `make` with no arguments to list every command.

## Repository layout

```
services/api/      FastAPI service: src/api (config, logs, probes, metrics), tests/, Dockerfile. The
                   staging endpoints go here as they are built.
docs/              scope, roadmap, architecture, threat model, ADRs, runbooks
compose.yaml       local run with production-like hardening
Makefile           every command you need
```

The web app, Terraform and Kubernetes manifests arrive with their phases in the [roadmap](docs/roadmap.md).

## How changes flow

1. Open a pull request with a [Conventional Commit](https://www.conventionalcommits.org/) title.
2. CI must pass: lint, types, tests, secret and vulnerability scans, image build and smoke test.
3. release-please keeps a Release PR open. Merging it tags the version and publishes a signed image to GHCR with an
   SBOM.

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
