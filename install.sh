#!/usr/bin/env bash
set -euo pipefail

REPO="luizbon/copilot-skills-profile"
PLUGIN_DIR="${HOME}/.copilot-skills-profile-plugin"
HOOKS_DIR="${HOME}/.copilot/hooks"
HOOK_FILE="${HOOKS_DIR}/skills-profile.json"

# ── helpers ───────────────────────────────────────────────────────────────────

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

require() {
  command -v "$1" &>/dev/null || { red "Error: '$1' is required but not found."; exit 1; }
}

# ── preflight ─────────────────────────────────────────────────────────────────

require curl
require unzip
require copilot

bold "Installing skills-profile Copilot CLI plugin..."
echo ""

# ── fetch latest release zip ──────────────────────────────────────────────────

API_URL="https://api.github.com/repos/${REPO}/releases/latest"

echo "Fetching latest release from ${REPO}..."

RELEASE_JSON=$(curl -fsSL \
  -H "Accept: application/vnd.github+json" \
  "${API_URL}")

VERSION=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
ZIP_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep 'skills-profile-plugin\.zip' | head -1 | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')

if [[ -z "$VERSION" || -z "$ZIP_URL" ]]; then
  red "Error: Could not find a release at https://github.com/${REPO}/releases"
  red "Make sure the repo is public and has at least one tagged release."
  exit 1
fi

echo "Found: ${VERSION}"
echo "Downloading: ${ZIP_URL}"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

curl -fsSL -o "${TMPDIR}/skills-profile-plugin.zip" "${ZIP_URL}"

# ── extract ───────────────────────────────────────────────────────────────────

mkdir -p "$PLUGIN_DIR"
unzip -o "${TMPDIR}/skills-profile-plugin.zip" -d "$PLUGIN_DIR" > /dev/null
green "✅ Plugin extracted to ${PLUGIN_DIR}"

# ── install via Copilot CLI ───────────────────────────────────────────────────

copilot plugin uninstall skills-profile 2>/dev/null || true
copilot plugin install "$PLUGIN_DIR"
green "✅ Plugin installed (${VERSION})"

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
echo "To disable a skill that is using too many tokens, add its name to"
echo "\"disabledSkills\" in ~/.copilot/settings.json:"
echo ""
echo "  {\"disabledSkills\": [\"skill-name\"]}"
echo ""
echo "To uninstall:"
echo "  copilot plugin uninstall skills-profile"
echo "  rm ${HOOK_FILE}"
