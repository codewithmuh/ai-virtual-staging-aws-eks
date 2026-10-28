SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PY := services/api
WEB := services/web

.PHONY: help setup fmt lint test check scan build up down logs dev examples clean

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-8s\033[0m %s\n", $$1, $$2}'

setup: ## Install dependencies and the git hooks (needs uv, Node 22+, pre-commit)
	cd $(PY) && uv sync
	cd $(WEB) && npm ci --no-audit --no-fund
	pre-commit install

fmt: ## Format the code
	cd $(PY) && uv run ruff format . && uv run ruff check --fix .
	cd $(WEB) && npm run fmt

lint: ## Lint and type-check (same as CI)
	cd $(PY) && uv run ruff format --check . && uv run ruff check . && uv run mypy
	cd $(WEB) && npm run lint && npm run typecheck

test: ## Run the tests with the coverage gates (same as CI)
	cd $(PY) && uv run pytest
	cd $(WEB) && npm test

check: lint test ## Everything CI runs before building images
	@# next build and next dev share services/web/.next: restart `make dev` after this.
	cd $(WEB) && npm run build

scan: ## Secret and vulnerability scans (needs gitleaks and trivy)
	gitleaks git --redact --no-banner .
	trivy fs --scanners vuln,misconfig,secret --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 .

build: ## Build the container images
	docker compose build

up: ## Run the app locally: web on :3000, API on :8000
	docker compose up --build --detach --wait
	docker compose ps

down: ## Stop and remove local containers
	docker compose down --remove-orphans

logs: ## Follow the logs
	docker compose logs --follow

dev: ## Run the web app with hot reload on :3000 (the API must be running on :8000)
	cd $(WEB) && npm run dev

examples: ## Stage the home page's examples with the model in .env (ARGS="--help" for options)
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; \
	cd $(PY) && uv run python scripts/make_examples.py $(ARGS)

clean: ## Remove build, test and cache artifacts
	rm -rf $(PY)/.venv $(PY)/.pytest_cache $(PY)/.mypy_cache $(PY)/.ruff_cache $(PY)/.coverage
	rm -rf $(WEB)/node_modules $(WEB)/.next $(WEB)/coverage $(WEB)/tsconfig.tsbuildinfo
