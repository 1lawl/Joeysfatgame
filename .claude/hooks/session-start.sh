#!/bin/bash
# Cloud-session setup for REA (rea-agents): registers the REA MCP server and
# skill with Claude Code, and installs the Ghidra and Hopper analysis engines
# when the environment's network policy allows their download hosts.
# Every step is idempotent, and a blocked download never fails the session.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REA_VERSION="6.4.0"
GHIDRA_VERSION="12.1.4"
GHIDRA_DIR="/opt/ghidra_${GHIDRA_VERSION}"
log() { printf '[rea-setup] %s\n' "$*" >&2; }

# Ghidra: official NSA release from GitHub, SHA-256 checked against the
# digest GitHub publishes for the release asset.
if [ ! -f "$GHIDRA_DIR/Ghidra/application.properties" ]; then
  tmp="$(mktemp -d)"
  if curl -fsSL "https://api.github.com/repos/NationalSecurityAgency/ghidra/releases/tags/Ghidra_${GHIDRA_VERSION}_build" -o "$tmp/release.json" 2>/dev/null; then
    read -r url digest < <(python3 -I -c '
import json, sys
for a in json.load(open(sys.argv[1]))["assets"]:
    if a["name"].endswith(".zip") and "_PUBLIC_" in a["name"]:
        print(a["browser_download_url"], (a.get("digest") or "").removeprefix("sha256:")); break
' "$tmp/release.json")
    if [ -n "${url:-}" ] && curl -fsSL "$url" -o "$tmp/ghidra.zip"; then
      if [ -z "${digest:-}" ] || echo "$digest  $tmp/ghidra.zip" | sha256sum -c --quiet -; then
        mkdir -p "$tmp/x" && unzip -q "$tmp/ghidra.zip" -d "$tmp/x" \
          && mv "$tmp/x"/ghidra_* "$GHIDRA_DIR" && log "Installed Ghidra $GHIDRA_VERSION"
      else
        log "Ghidra download failed its SHA-256 check; not installed"
      fi
    else
      log "Ghidra download failed (is github.com allowed by the network policy?)"
    fi
  else
    log "GitHub API unreachable; skipping Ghidra (allow api.github.com and github.com)"
  fi
  rm -rf "$tmp"
fi

setup_args=(--client claude_code --yes)
if [ -f "$GHIDRA_DIR/Ghidra/application.properties" ]; then
  export GHIDRA_INSTALL_DIR="$GHIDRA_DIR"
  export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
  echo "export GHIDRA_INSTALL_DIR=\"$GHIDRA_DIR\"" >> "${CLAUDE_ENV_FILE:-/dev/null}"
fi

# Hopper: REA downloads the official Linux demo package from hopperapp.com and
# verifies its size and SHA-1 before installing.
if ! command -v hopper >/dev/null 2>&1 && [ ! -x /opt/hopper/bin/Hopper ] \
   && curl -fsS -o /dev/null -r 0-0 https://www.hopperapp.com/ 2>/dev/null; then
  setup_args+=(--install-hopper)
else
  command -v hopper >/dev/null 2>&1 || log "hopperapp.com unreachable; skipping Hopper"
fi

# Registers the MCP server (forwarding GHIDRA_INSTALL_DIR / HOPPER_LAUNCHER_PATH
# into its environment) and installs the REA skill.
if npx -y "rea-agents@${REA_VERSION}" setup "${setup_args[@]}" >/tmp/rea-setup.log 2>&1; then
  log "REA ${REA_VERSION} MCP server and skill configured"
else
  log "REA setup reported a problem; see /tmp/rea-setup.log"
fi
exit 0
