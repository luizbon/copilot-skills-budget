#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$Repo     = 'luizbon/copilot-skills-budget'
$HooksDir = Join-Path $env:USERPROFILE '.copilot\hooks'
$HookFile = Join-Path $HooksDir 'skills-budget.json'

# ── helpers ───────────────────────────────────────────────────────────────────

function Write-Step  { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Fail  { param($msg) Write-Host "Error: $msg" -ForegroundColor Red; exit 1 }

function Install-CopilotPlugin {
    param($Name, $ZipName, $BaseUrl)
    $PluginDir = Join-Path $env:USERPROFILE ".copilot-$Name-plugin"
    $ZipUrl    = "$BaseUrl$ZipName"

    Write-Step "Downloading $ZipName..."
    $ZipPath = Join-Path $TmpDir $ZipName
    Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath -UseBasicParsing

    if (Test-Path $PluginDir) { Remove-Item $PluginDir -Recurse -Force }
    New-Item -ItemType Directory -Path $PluginDir | Out-Null
    Expand-Archive -Path $ZipPath -DestinationPath $PluginDir -Force

    copilot plugin uninstall $Name 2>$null
    copilot plugin install $PluginDir
    Write-Ok "$Name plugin installed"
}

# ── preflight ─────────────────────────────────────────────────────────────────

if (-not (Get-Command copilot -ErrorAction SilentlyContinue)) {
    Write-Fail "'copilot' CLI is required but was not found in PATH."
}

Write-Host ""
Write-Host "Installing skills-budget + skills-profile Copilot CLI plugins..." -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ""

# ── fetch latest release ──────────────────────────────────────────────────────

$ApiUrl  = "https://api.github.com/repos/$Repo/releases/latest"
$Headers = @{ Accept = 'application/vnd.github+json' }

Write-Step "Fetching latest release from $Repo..."

try {
    $Release = Invoke-RestMethod -Uri $ApiUrl -Headers $Headers -UseBasicParsing
} catch {
    Write-Fail "Could not reach GitHub API: $_`nMake sure the repo is public and has at least one tagged release."
}

$Version   = $Release.tag_name
$FirstAsset = $Release.assets | Select-Object -First 1
if (-not $Version -or -not $FirstAsset) {
    Write-Fail "Could not find release assets at https://github.com/$Repo/releases"
}
# Base URL is the directory portion of the first asset URL
$BaseUrl = $FirstAsset.browser_download_url -replace '[^/]+$', ''

Write-Step "Found: $Version"

$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $TmpDir | Out-Null

try {
    # ── install both plugins ──────────────────────────────────────────────────

    Install-CopilotPlugin -Name 'skills-budget'  -ZipName 'skills-budget-plugin.zip'  -BaseUrl $BaseUrl
    Install-CopilotPlugin -Name 'skills-profile' -ZipName 'skills-profile-plugin.zip' -BaseUrl $BaseUrl

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
Write-Host "Profile commands: /skills-profile:list, /skills-profile:save, /skills-profile:switch" -ForegroundColor Yellow
Write-Host ""
Write-Host "To uninstall:"
Write-Host "  copilot plugin uninstall skills-budget" -ForegroundColor Yellow
Write-Host "  copilot plugin uninstall skills-profile" -ForegroundColor Yellow
Write-Host "  Remove-Item $HookFile" -ForegroundColor Yellow
Write-Host ""
