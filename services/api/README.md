# api

The FastAPI service: `/healthz` (liveness), `/readyz` (readiness), `/metrics` (Prometheus). JSON logs with request
IDs, graceful shutdown, runs as a non-root user. `/v1/hello` is the template's sample route until the first real
endpoint replaces it. See the repository README for how to run it.
