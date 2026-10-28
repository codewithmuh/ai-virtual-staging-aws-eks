# Roadmap

Built in public, phase by phase. Every phase ends with measured results, not claims. See [scope.md](scope.md).

## Phase 0: the app, locally (no AWS)

- [x] Repository from the production template: CI, scans, signed releases, FastAPI plumbing (probes, metrics,
      JSON logs, graceful shutdown)
- [x] ADRs: image-editing provider (behind one interface), S3 + presigned uploads, DynamoDB instead of a database
      server
- [x] API: uploads, stagings, listing text, "shop this look"; EXIF removed, files checked, per-visitor daily limit
- [x] Structure check that flags staged photos where walls, windows or doors moved (rule R2)
- [x] Web: upload, style picker, before/after slider, "Virtually staged" label, share page, "shop this look",
      listing form ([ADR 0004](adr/0004-web-app-and-one-domain.md))
- [x] Tests with fixture responses in each provider's format, so CI never calls a paid API
- [ ] Compare OpenAI and Gemini on real room photos: structure score, p95 time, price per photo (ADR 0002)

## Phase 1: on EKS

- [ ] Terraform: VPC across three AZs, EKS with a managed node group, ECR, S3, DynamoDB, Pod Identity, ACM,
      Route 53
- [ ] AWS Load Balancer Controller, ExternalDNS, metrics-server
- [ ] Kustomize manifests: Deployments, Services, Ingress, HPA, PodDisruptionBudgets; applied once with `kubectl`
- [ ] Argo CD takes over: delete everything by hand and let git recreate it
- [ ] Timeouts set end to end, measured against the image model's real latency
- [ ] One domain: the Ingress sends `/v1` to the API; uvicorn trusts the ALB's `X-Forwarded-For` (ADR 0004)

## Phase 2: measured

- [ ] Load test with the AI provider mocked: requests per second, p95 latency, HPA scale-up time
- [ ] Drill: kill pods and a node during the load test; count failed requests
- [ ] Cost per hour of the cluster and per staged photo; `make destroy` leaves nothing behind

## Phase 3: v1.0

- [ ] All 11 areas of the production-grade checklist
- [ ] Results table in the README, demo video and write-up
