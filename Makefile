# Harness Development Makefile
# Run `make help` to see available commands

.PHONY: help install dev build test lint fmt typecheck check clean hooks setup

# Default target
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# === Setup ===

install: ## Install dependencies
	pnpm install

setup: install hooks ## Full setup: install deps and configure git hooks

hooks: ## Setup git hooks
	pnpm exec simple-git-hooks

# === Development ===

dev: ## Start development server
	pnpm dev

build: ## Build for production
	pnpm build

# === Quality ===

lint: ## Run linter
	pnpm lint

fmt: ## Format code with Biome
	pnpm exec biome format --write .

typecheck: ## Run TypeScript type checking
	pnpm typecheck

test: ## Run tests
	pnpm test

check: lint typecheck test ## Run all checks (lint, typecheck, test)

# === Security ===

audit: ## Run security audit
	pnpm audit

secrets: ## Scan for secrets with gitleaks
	@gitleaks detect --source . --verbose || (echo "Install gitleaks: brew install gitleaks" && exit 1)

security: audit secrets ## Run all security checks

# === Maintenance ===

clean: ## Clean build artifacts and caches
	rm -rf dist coverage artifacts .test-traces* .traces
	rm -rf node_modules/.cache

reset: clean ## Full reset: clean and reinstall
	pnpm install

# === CI ===

ci: check audit ## Run CI checks (check + audit)

# === Diagrams ===

diagrams: ## Generate architecture diagrams
	pnpm exec diagram all . --output-dir AI/diagrams

# === Environment ===

env-check: ## Check local project environment and harness wiring
	@bash ./scripts/check-environment.sh
