# Architecture

> Keep this page current: update it in the same pull request that changes the architecture.
> The target design is in [scope.md](scope.md). This page describes what is **built** today.

## Context

Heya turns a photo of an empty or dated room into a staged one, in a chosen style, and writes the furniture
list and listing description. It is part 1 of AI on EKS and teaches the basics of running a web app on
Amazon EKS properly. The AI work happens in hosted APIs; the cluster runs stateless web and API pods.

## Built so far

```mermaid
flowchart LR
    client([Client]) --> api[api<br/>FastAPI :8000]
    api -. /metrics .-> prom[(Prometheus)]
```

| Component | Responsibility | Tech | Status |
|---|---|---|---|
| `api` | HTTP API, runtime contract | Python 3.13, FastAPI, uvicorn | Plumbing done; the staging API next |

Planned components are in the [roadmap](roadmap.md).

## Runtime contract (every service)

| Concern | How |
|---|---|
| Liveness | `GET /healthz`: process is up; never checks dependencies |
| Readiness | `GET /readyz`: 503 until started and during shutdown |
| Metrics | `GET /metrics`: Prometheus `http_requests_total`, `http_request_duration_seconds` |
| Logs | One JSON line per event on stdout, with `request_id` |
| Shutdown | On SIGTERM: fail readiness, drain in-flight requests (≤ 20 s), exit 0 |
| Config | Environment variables only; secrets from the platform's secret manager |
| Security | Non-root user, read-only filesystem, no capabilities, minimal base image |

## Data

Planned: photos in S3 (originals and staged versions, EXIF stripped), stagings and per-visitor usage in
DynamoDB. No database server to run. See [scope.md](scope.md).

## Deployment

Planned: Terraform for AWS; Kustomize manifests applied once by hand, then synced by Argo CD from `main`.
Roll back by reverting the commit.

## Reliability

SLOs are written in phase 2 of the [roadmap](roadmap.md), each with an alert and the runbook it links to.

## Security

Trust boundaries and controls: see [threat-model.md](threat-model.md).

## Decisions

See [adr/](adr/).
