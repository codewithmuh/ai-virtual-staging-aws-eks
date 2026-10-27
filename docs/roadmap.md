# Roadmap

Built in public, phase by phase. Every phase ends with measured results, not claims. See [scope.md](scope.md).

## Phase 0: the app, locally (no AWS)

- [x] Repository from the production template: CI, scans, signed releases, FastAPI plumbing (probes, metrics,
      JSON logs, graceful shutdown)
- [ ] ADRs: image-editing provider (behind one interface), S3 + presigned uploads, DynamoDB instead of a database
      server
- [ ] API: uploads, stagings, listing text, "shop this look"; EXIF removed, files checked, per-visitor daily limit
- [ ] Structure check that flags staged photos where walls, windows or doors moved (rule R2)
- [ ] Web: upload, style picker, before/after slider, "Virtually staged" label, share page
- [ ] Tests with recorded AI responses, so CI never calls a paid API

## Phase 1: on EKS

- [ ] Terraform: VPC across three AZs, EKS with a managed node group, ECR, S3, DynamoDB, Pod Identity, ACM,
      Route 53
- [ ] AWS Load Balancer Controller, ExternalDNS, metrics-server
- [ ] Kustomize manifests: Deployments, Services, Ingress, HPA, PodDisruptionBudgets; applied once with `kubectl`
- [ ] Argo CD takes over: delete everything by hand and let git recreate it
- [ ] Timeouts set end to end, measured against the image model's real latency

## Phase 2: measured

- [ ] Load test with the AI provider mocked: requests per second, p95 latency, HPA scale-up time
- [ ] Drill: kill pods and a node during the load test; count failed requests
- [ ] Cost per hour of the cluster and per staged photo; `make destroy` leaves nothing behind

## Phase 3: v1.0

- [ ] All 11 areas of the production-grade checklist
- [ ] Results table in the README, demo video and write-up
