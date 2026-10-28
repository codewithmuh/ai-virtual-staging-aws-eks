# api

The staging API (FastAPI). Endpoints, the request flow and the settings are in the repository
[README](../../README.md); the design is in [docs/scope.md](../../docs/scope.md) and the ADRs.

Runtime contract: `/healthz` (liveness), `/readyz` (readiness), `/metrics` (Prometheus, labelled by route
template), JSON logs with request IDs, graceful shutdown, non-root and read-only.

Tests run against moto (S3 and DynamoDB in memory) and fixture responses in each AI provider's format, so
`make check` never calls AWS or a paid API.
