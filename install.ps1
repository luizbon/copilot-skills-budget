#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$Repo      = 'luizbon/copilot-skills-profile'
$PluginDir = Join-Path $env:USERPROFILE '.copilot-skills-profile-plugin'
$HooksDir  = Join-Path $env:USERPROFILE '.copilot\hooks'
$HookFile  = Join-Path $HooksDir 'skills-profile.json'

# ── helpers ───────────────────────────────────────────────────────────────────

function Write-Step  { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Fail  { param($msg) Write-Host "Error: $msg" -ForegroundColor Red; exit 1 }

# ── preflight ─────────────────────────────────────────────────────────────────

if (-not (Get-Command copilot -ErrorAction SilentlyContinue)) {
    Write-Fail "'copilot' CLI is required but was not found in PATH."
}

Write-Host ""
Write-Host "Installing skills-profile Copilot CLI plugin..." -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ""

# ── fetch latest release ──────────────────────────────────────────────────────

$ApiUrl = "https://api.github.com/repos/$Repo/releases/latest"

Write-Step "Fetching latest release from $Repo..."

$Headers = @{ Accept = 'application/vnd.github+json' }

try {
    $Release = Invoke-RestMethod -Uri $ApiUrl -Headers $Headers -UseBasicParsing
} catch {
    Write-Fail "Could not reach GitHub API: $_`nMake sure the repo is public and has at least one tagged release."
}

$Version = $Release.tag_name
$ZipAsset = $Release.assets | Where-Object { $_.name -eq 'skills-profile-plugin.zip' } | Select-Object -First 1

if (-not $Version -or -not $ZipAsset) {
    Write-Fail "Could not find skills-profile-plugin.zip in the latest release at https://github.com/$Repo/releases"
}

Write-Step "Found: $Version"
Write-Step "Downloading: $($ZipAsset.browser_download_url)"

$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $TmpDir | Out-Null

try {
    $ZipPath = Join-Path $TmpDir 'skills-profile-plugin.zip'
    Invoke-WebRequest -Uri $ZipAsset.browser_download_url -OutFile $ZipPath -UseBasicParsing

    # ── extract ───────────────────────────────────────────────────────────────

    if (Test-Path $PluginDir) { Remove-Item $PluginDir -Recurse -Force }
    New-Item -ItemType Directory -Path $PluginDir | Out-Null
    Expand-Archive -Path $ZipPath -DestinationPath $PluginDir -Force
    Write-Ok "Plugin extracted to $PluginDir"

    # ── install via Copilot CLI ───────────────────────────────────────────────

    copilot plugin uninstall skills-profile 2>$null
    copilot plugin install $PluginDir
    Write-Ok "Plugin installed ($Version)"

    # ── create user-level startup hook ────────────────────────────────────────
    # The type:prompt sessionStart hook must live in ~/.copilot/hooks/ —
    # Copilot only reads startup prompts from that dir, not from plugin dirs.

    if (-not (Test-Path $HooksDir)) { New-Item -ItemType Directory -Path $HooksDir | Out-Null }

    @'
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
'@ | Set-Content -Path $HookFile -Encoding UTF8
    Write-Ok "Startup hook created at $HookFile"

} finally {
    Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
}

# ── done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Done! Start a new Copilot session — the budget check will appear automatically." -ForegroundColor Green
Write-Host ""
Write-Host "To disable a skill that is using too many tokens, add its name to"
Write-Host '"disabledSkills" in ~/.copilot/settings.json:'
Write-Host ""
Write-Host '  {"disabledSkills": ["skill-name"]}' -ForegroundColor Yellow
Write-Host ""
Write-Host "To uninstall:"
Write-Host "  copilot plugin uninstall skills-profile" -ForegroundColor Yellow
Write-Host "  Remove-Item $HookFile" -ForegroundColor Yellow
Write-Host ""
