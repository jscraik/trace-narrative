#!/usr/bin/env bash

# Codex preflight policy:
# Must-do: preflight_repo runs Local Memory checks in required mode by default.
# Project adjustments: override bins/paths/mode via args (off | optional | required)
# without changing the must-do local-memory probe implementation.

if [[ -n "${ZSH_VERSION:-}" && -z "${BASH_VERSION:-}" ]]; then
	_CODEX_PREFLIGHT_SOURCE="$(eval 'printf "%s" "${(%):-%x}"')"
	_CODEX_PREFLIGHT_SCRIPT="$(
		cd "$(dirname -- "${_CODEX_PREFLIGHT_SOURCE}")" && pwd -P
	)/$(basename -- "${_CODEX_PREFLIGHT_SOURCE}")"

	preflight_repo() {
		command bash "${_CODEX_PREFLIGHT_SCRIPT}" "$@"
	}

	preflight_js() {
		preflight_repo "${1:-}" "${2:-git,bash,sed,rg,fd,jq,curl,node,npm,python3}" "${3:-AGENTS.md,package.json,docs,docs/plans}" "${4:-required}"
	}

	preflight_rust() {
		preflight_repo "${1:-}" "${2:-git,bash,sed,rg,fd,jq,curl,python3,cargo}" "${3:-AGENTS.md,Cargo.toml,docs,docs/plans}" "${4:-required}"
	}

	preflight_py() {
		preflight_repo "${1:-}" "${2:-git,bash,sed,rg,fd,jq,curl,python3}" "${3:-AGENTS.md,pyproject.toml,docs,docs/plans}" "${4:-required}"
	}

	preflight_repo_local_memory() {
		preflight_repo "${1:-}" "${2:-git,bash,sed,rg,fd,jq,curl,python3}" "${3:-AGENTS.md,docs,docs/plans}" "required"
	}

	return 0 2>/dev/null || exit 0
fi

if [[ -n "${BASH_VERSION:-}" ]] && [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	set -euo pipefail
fi

extract_last_json_line() {
	local raw="${1:-}"
	printf '%s\n' "${raw}" | awk '/^\{/{line=$0} END{if (line != "") print line}'
}

preflight_repo() {
	local expected_repo="${1:-}"
	local bins_csv="${2:-git,bash,sed,rg,fd,jq,curl,python3}"
	local paths_csv="${3:-AGENTS.md,docs,docs/plans}"
	local local_memory_mode="${4:-required}" # off | optional | required

	echo "== Codex Preflight =="
	echo "pwd: $(pwd)"

	if ! command -v git >/dev/null 2>&1; then
		echo "❌ missing binary: git" >&2
		return 2
	fi

	local root
	if ! root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
		echo "❌ not inside a git repo (git rev-parse failed)" >&2
		return 2
	fi

	if [[ -z "${root}" ]]; then
		echo "❌ git rev-parse returned empty root" >&2
		return 2
	fi

	root="$(cd "${root}" && pwd -P)"
	local workspace_root
	workspace_root="$(cd "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
	echo "repo root: ${root}"

	if [[ "${root}" != "${workspace_root}" ]]; then
		echo "❌ script workspace mismatch: expected ${workspace_root}" >&2
		return 2
	fi

	if [[ -n "${expected_repo}" ]] && [[ "${root}" != *"${expected_repo}"* ]]; then
		echo "❌ repo mismatch: expected fragment '${expected_repo}' in '${root}'" >&2
		return 2
	fi

	cd "${root}"

	local -a bins=()
	local -a missing_bins=()
	IFS=',' read -r -a bins <<< "${bins_csv}"
	local b
	for b in "${bins[@]}"; do
		[[ -z "${b}" ]] && continue
		if ! command -v "${b}" >/dev/null 2>&1; then
			missing_bins+=("${b}")
		fi
	done

	if (( ${#missing_bins[@]} > 0 )); then
		echo "❌ missing binaries: ${missing_bins[*]}" >&2
		return 2
	fi
	echo "✅ binaries ok: ${bins_csv}"

	local -a paths=()
	IFS=',' read -r -a paths <<< "${paths_csv}"
	local p
	for p in "${paths[@]}"; do
		[[ -z "${p}" ]] && continue

		local -a matches=()
		shopt -s nullglob
		for match in ${p}; do
			matches+=("${match}")
		done
		shopt -u nullglob

		if (( ${#matches[@]} == 0 )); then
			matches+=("${p}")
		fi

		local found=0
		local match abs
		for match in "${matches[@]}"; do
			if [[ -e "${match}" ]]; then
				found=1
				if ! abs="$(python3 -c "import os, sys; print(os.path.realpath(sys.argv[1]))" "${match}")"; then
					echo "❌ failed to resolve path: ${match}" >&2
					return 2
				fi
				if [[ "${abs}" != "${root}" && "${abs}" != "${root}"/* ]]; then
					echo "❌ path escapes repo root: ${match} -> ${abs}" >&2
					return 2
				fi
			fi
		done

		if (( found == 0 )); then
			echo "❌ missing path: ${p}" >&2
			return 2
		fi
	done
	echo "✅ paths ok: ${paths_csv}"

	echo "git branch: $(git rev-parse --abbrev-ref HEAD)"
	echo "clean?: $(git status --porcelain | wc -l | tr -d ' ') changes"

	if [[ "${local_memory_mode}" != "off" ]]; then
		if ! preflight_local_memory_gold; then
			if [[ "${local_memory_mode}" == "required" ]]; then
				echo "❌ local-memory preflight failed (required mode)" >&2
				return 2
			fi
			echo "⚠️ local-memory preflight failed (optional mode)"
		fi
	fi

	echo "✅ preflight passed"
}

preflight_local_memory_gold() {
	echo "== Local Memory Preflight =="

	if ! command -v local-memory >/dev/null 2>&1; then
		echo "❌ missing binary: local-memory" >&2
		return 1
	fi
	if ! command -v jq >/dev/null 2>&1; then
		echo "❌ missing binary: jq (required for local-memory checks)" >&2
		return 1
	fi
	if ! command -v curl >/dev/null 2>&1; then
		echo "❌ missing binary: curl (required for REST checks)" >&2
		return 1
	fi

	local version
	version="$(local-memory --version 2>/dev/null | tr -d '\r')"
	echo "local-memory version: ${version}"

	local status_json
	if ! status_json="$(local-memory status --json 2>/dev/null)"; then
		echo "❌ local-memory status failed" >&2
		return 1
	fi
	status_json="$(extract_last_json_line "${status_json}")"
	if [[ -z "${status_json}" ]]; then
		echo "❌ local-memory status returned no JSON payload" >&2
		return 1
	fi
	local running
	running="$(echo "${status_json}" | jq -r '.data.running // .running // false')"
	if [[ "${running}" != "true" ]]; then
		echo "❌ local-memory daemon is not running" >&2
		return 1
	fi

	local rest_port
	rest_port="$(echo "${status_json}" | jq -r '.data.rest_api_port // .rest_api_port // 3002')"
	if [[ ! "${rest_port}" =~ ^[0-9]+$ ]]; then
		echo "❌ invalid rest_api_port from status: ${rest_port}" >&2
		return 1
	fi

	local lm_config_path="${LOCAL_MEMORY_CONFIG_PATH:-${HOME}/.local-memory/config.yaml}"
	if [[ ! -f "${lm_config_path}" ]]; then
		echo "❌ local-memory config missing: ${lm_config_path}" >&2
		echo "   Set LOCAL_MEMORY_CONFIG_PATH if your config lives elsewhere." >&2
		return 1
	fi

	if ! rg -q '^[[:space:]]*host:[[:space:]]*"?127\.0\.0\.1"?([[:space:]]*#.*)?$' "${lm_config_path}"; then
		echo "❌ local-memory config host policy failed: expected host: 127.0.0.1" >&2
		echo "   file: ${lm_config_path}" >&2
		return 1
	fi
	if ! rg -q '^[[:space:]]*auto_port:[[:space:]]*false([[:space:]]*#.*)?$' "${lm_config_path}"; then
		echo "❌ local-memory config auto_port policy failed: expected auto_port: false" >&2
		echo "   file: ${lm_config_path}" >&2
		return 1
	fi
	echo "✅ config host/auto_port policy ok: ${lm_config_path}"

	local health_url="http://127.0.0.1:${rest_port}/api/v1/health"
	local health_json
	if ! health_json="$(curl -fsS "${health_url}")"; then
		echo "❌ REST health endpoint unreachable at ${health_url}" >&2
		return 1
	fi
	if [[ "$(echo "${health_json}" | jq -r '.success // false')" != "true" ]]; then
		echo "❌ REST health endpoint returned success=false" >&2
		return 1
	fi
	echo "✅ REST health ok: ${health_url}"

	# Smoke write/read/relate/search cycle.
	local probe
	probe="LM-PREFLIGHT-$(date +%Y%m%d-%H%M%S)-$$"
	local content_a="Preflight anchor ${probe}"
	local content_b="Preflight evidence ${probe}"

	local observe_a_json
	local observe_b_json
	observe_a_json="$(local-memory observe "${content_a}" --domain "coding-harness" --tags "preflight,local-memory" --source "codex_preflight" --json 2>/dev/null)" || {
		echo "❌ observe A failed" >&2
		return 1
	}
	observe_b_json="$(local-memory observe "${content_b}" --domain "coding-harness" --tags "preflight,local-memory" --source "codex_preflight" --json 2>/dev/null)" || {
		echo "❌ observe B failed" >&2
		return 1
	}
	observe_a_json="$(extract_last_json_line "${observe_a_json}")"
	observe_b_json="$(extract_last_json_line "${observe_b_json}")"

	local id_a
	local id_b
	id_a="$(echo "${observe_a_json}" | jq -r '.id // .data.id // .memory_id // .data.memory_id // empty')"
	id_b="$(echo "${observe_b_json}" | jq -r '.id // .data.id // .memory_id // .data.memory_id // empty')"
	if [[ -z "${id_a}" || -z "${id_b}" ]]; then
		echo "❌ observe returned no memory IDs" >&2
		return 1
	fi

	local relate_json
	relate_json="$(local-memory relate "${id_a}" "${id_b}" --type "references" --strength 0.8 --confirm --json 2>/dev/null)" || {
		echo "❌ relate failed" >&2
		return 1
	}
	relate_json="$(extract_last_json_line "${relate_json}")"
	local relationship_id
	relationship_id="$(echo "${relate_json}" | jq -r '.id // .data.id // .relationship_id // .data.relationship_id // empty')"
	local relate_ok
	relate_ok="$(echo "${relate_json}" | jq -r '.success // true')"
	if [[ "${relate_ok}" != "true" ]]; then
		echo "❌ relate reported failure" >&2
		return 1
	fi

	local search_json
	search_json="$(local-memory search "${probe}" --limit 10 --json 2>/dev/null)" || {
		echo "❌ search failed" >&2
		return 1
	}
	search_json="$(extract_last_json_line "${search_json}")"
	local search_hits
	search_hits="$(echo "${search_json}" | jq -r '
		if type == "array" then length
		elif .results then (.results | length)
		elif .data.results then (.data.results | length)
		elif .data then (.data | length)
		else 0 end
	')"
	if [[ "${search_hits}" -lt 1 ]]; then
		echo "❌ search returned no results for probe ${probe}" >&2
		return 1
	fi
	echo "✅ smoke cycle ok: ids ${id_a}, ${id_b}; relationship ${relationship_id}"

	# Malformed payload check via REST.
	local malformed_output
	malformed_output="$(mktemp -t local-memory-preflight-malformed.XXXXXX.json)"
	local malformed_code
	malformed_code="$(curl -sS -o "${malformed_output}" -w "%{http_code}" \
		-H 'Content-Type: application/json' \
		-d '{"level":"observation"}' \
		"http://127.0.0.1:${rest_port}/api/v1/observe")"
	if [[ "${malformed_code}" -lt 400 ]]; then
		echo "❌ malformed payload did not return an error (HTTP ${malformed_code})" >&2
		return 1
	fi
	echo "✅ malformed payload rejected: HTTP ${malformed_code}"

	# Duplicate write behavior snapshot (informational).
	local dup_payload
	dup_payload="$(jq -nc --arg c "${content_a}" '{content:$c,domain:"coding-harness",source:"codex_preflight",tags:["preflight","duplicate-check"]}')"
	local dup_output_1
	local dup_output_2
	dup_output_1="$(mktemp -t local-memory-preflight-dup1.XXXXXX.json)"
	dup_output_2="$(mktemp -t local-memory-preflight-dup2.XXXXXX.json)"
	local dup_code_1
	local dup_code_2
	dup_code_1="$(curl -sS -o "${dup_output_1}" -w "%{http_code}" \
		-H 'Content-Type: application/json' \
		-d "${dup_payload}" \
		"http://127.0.0.1:${rest_port}/api/v1/observe")"
	dup_code_2="$(curl -sS -o "${dup_output_2}" -w "%{http_code}" \
		-H 'Content-Type: application/json' \
		-d "${dup_payload}" \
		"http://127.0.0.1:${rest_port}/api/v1/observe")"
	echo "ℹ️ duplicate behavior snapshot: first=${dup_code_1}, second=${dup_code_2}"

	local daemon_log="${HOME}/.local-memory/daemon.log"
	if [[ -f "${daemon_log}" ]]; then
		local migration_line
		migration_line="$(tail -n 300 "${daemon_log}" | rg -n '"pending_migrations"|"target_version"|"current_version"' -m 1 || true)"
		if [[ -n "${migration_line}" ]]; then
			echo "ℹ️ migration status signal found in daemon log"
		else
			echo "⚠️ no migration status signal found in recent daemon log tail"
		fi
	else
		echo "⚠️ daemon log not found at ${daemon_log}"
	fi

	echo "✅ local-memory preflight passed"
}

preflight_js() {
	preflight_repo "${1:-}" "${2:-git,bash,sed,rg,fd,jq,curl,node,npm,python3}" "${3:-AGENTS.md,package.json,docs,docs/plans}" "${4:-required}"
}

preflight_rust() {
	preflight_repo "${1:-}" "${2:-git,bash,sed,rg,fd,jq,curl,python3,cargo}" "${3:-AGENTS.md,Cargo.toml,docs,docs/plans}" "${4:-required}"
}

preflight_py() {
	preflight_repo "${1:-}" "${2:-git,bash,sed,rg,fd,jq,curl,python3}" "${3:-AGENTS.md,pyproject.toml,docs,docs/plans}" "${4:-required}"
}

preflight_repo_local_memory() {
	preflight_repo "${1:-}" "${2:-git,bash,sed,rg,fd,jq,curl,python3}" "${3:-AGENTS.md,docs,docs/plans}" "required"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	preflight_repo "$@"
fi
