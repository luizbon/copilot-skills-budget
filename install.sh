#!/usr/bin/env bash
set -euo pipefail

REPO="luizbon/copilot-skills-budget"
HOOKS_DIR="${HOME}/.copilot/hooks"
HOOK_FILE="${HOOKS_DIR}/skills-budget.json"

# ── helpers ───────────────────────────────────────────────────────────────────

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

require() {
  command -v "$1" &>/dev/null || { red "Error: '$1' is required but not found."; exit 1; }
}

install_plugin() {
  local name="$1" zip_name="$2"
  local plugin_dir="${HOME}/.copilot-${name}-plugin"

  echo "Downloading ${zip_name}..."
  curl -fsSL -o "${TMPDIR}/${zip_name}" "${BASE_URL}/${zip_name}"

  mkdir -p "$plugin_dir"
  unzip -o "${TMPDIR}/${zip_name}" -d "$plugin_dir" > /dev/null

  copilot plugin uninstall "$name" 2>/dev/null || true
  copilot plugin install "$plugin_dir"
  green "✅ ${name} plugin installed"
}

# ── preflight ─────────────────────────────────────────────────────────────────

require curl
require unzip
require copilot

bold "Installing skills-budget + skills-profile Copilot CLI plugins..."
echo ""

# ── fetch latest release ──────────────────────────────────────────────────────

API_URL="https://api.github.com/repos/${REPO}/releases/latest"
echo "Fetching latest release from ${REPO}..."

RELEASE_JSON=$(curl -fsSL -H "Accept: application/vnd.github+json" "${API_URL}")
VERSION=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
BASE_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | head -1 | sed 's/.*"browser_download_url": *"\([^"]*\/\)[^"]*".*/\1/')

if [[ -z "$VERSION" || -z "$BASE_URL" ]]; then
  red "Error: Could not find a release at https://github.com/${REPO}/releases"
  exit 1
fi

echo "Found: ${VERSION}"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# ── install both plugins ──────────────────────────────────────────────────────

install_plugin "skills-budget"  "skills-budget-plugin.zip"
install_plugin "skills-profile" "skills-profile-plugin.zip"

# ── create user-level startup hook ───────────────────────────────────────────
# The type:prompt sessionStart hook must live in ~/.copilot/hooks/ —
# Copilot only reads startup prompts from that dir, not from plugin dirs.

mkdir -p "$HOOKS_DIR"
cat > "$HOOK_FILE" << 'HOOK'
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "type": "prompt",
        "prompt": "Check my skills context budget and report any warnings"
      }
    ]
  }
}
HOOK
green "✅ Startup hook created at ${HOOK_FILE}"

# ── done ──────────────────────────────────────────────────────────────────────

echo ""
bold "Done! Start a new Copilot session — the budget check will appear automatically."
echo ""
echo "Profile commands: /skills-profile:list, /skills-profile:save, /skills-profile:switch"
echo ""
echo "To uninstall:"
echo "  copilot plugin uninstall skills-budget"
echo "  copilot plugin uninstall skills-profile"
echo "  rm ${HOOK_FILE}"
