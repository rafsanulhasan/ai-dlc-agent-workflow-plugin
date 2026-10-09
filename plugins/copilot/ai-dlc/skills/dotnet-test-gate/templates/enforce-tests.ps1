#!/usr/bin/env pwsh
# enforce-tests.ps1 — AI-DLC .NET test gate (Claude Code "Stop" / Copilot "agentStop" hook).
# Installed into a .NET repository by the ai-dlc `dotnet-test-gate` skill (run by /ai-dlc:init).
# Blocks the agent from finishing while `dotnet test` fails, but only when runtime code,
# test code, runtime configuration or build logic changed (artifact-only changes are exempt).
#
# Configuration (first match wins):
#   Test target : AI_DLC_TEST_TARGET | *.Testing.slnx / *.Tests.sln* at repo root | `dotnet test` in repo root
#   Disable     : AI_DLC_ENFORCE_TESTS=false

$ErrorActionPreference = 'Stop'

function Write-Block([string]$reason) {
    # Top-level decision/reason is the Stop-hook contract for Claude Code and the
    # agentStop decision-control contract for Copilot CLI.
    @{ decision = 'block'; reason = $reason } | ConvertTo-Json -Compress | Write-Output
    exit 0
}

# --- read hook payload from stdin (both platforms send JSON) ----------------
$payload = $null
try {
    $raw = [Console]::In.ReadToEnd()
    if ($raw) { $payload = $raw | ConvertFrom-Json -ErrorAction Stop }
} catch { $payload = $null }

# Avoid infinite loops: if we are already continuing because of this hook, let it pass.
if ($payload -and ($payload.stop_hook_active -eq $true -or $payload.stopHookActive -eq $true)) { exit 0 }

# --- opt-out ----------------------------------------------------------------
$enforce = $env:AI_DLC_ENFORCE_TESTS
if ($enforce -and $enforce.ToString().ToLowerInvariant() -in @('false', '0', 'no', 'off')) { exit 0 }

# --- locate the project -----------------------------------------------------
$projectDir = $env:CLAUDE_PROJECT_DIR
if (-not $projectDir -and $payload -and $payload.cwd) { $projectDir = $payload.cwd }
if (-not $projectDir) { $projectDir = (Get-Location).Path }
Set-Location -LiteralPath $projectDir

$gitRoot = $null
try { $gitRoot = (& git rev-parse --show-toplevel 2>$null) } catch { }
if ($LASTEXITCODE -eq 0 -and $gitRoot) { $repoRoot = $gitRoot.Trim() } else { $repoRoot = $projectDir; $gitRoot = $null }

# Not a .NET repository → nothing to gate.
$dotnetFiles = Get-ChildItem -LiteralPath $repoRoot -Recurse -Depth 4 -File -Include *.sln, *.slnx, *.csproj -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '[\\/](bin|obj|node_modules|\.git)[\\/]' } | Select-Object -First 1
if (-not $dotnetFiles) { exit 0 }

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    [Console]::Error.WriteLine('ai-dlc test gate: dotnet SDK not found on PATH; skipping.')
    exit 0
}

# --- artifact-only exemption ------------------------------------------------
if ($gitRoot) {
    $changed = & git -C $repoRoot status --porcelain --untracked-files=all 2>$null |
        ForEach-Object { ($_.Substring(3) -split ' -> ')[-1].Trim('"') }
    if (-not $changed) { exit 0 }   # nothing changed this session
    $artifactOnly = '^(\.claude/|\.github/(agents|skills|prompts|instructions|hooks)/|docs/|AGENTS\.md$|CLAUDE\.md$)|\.md$'
    $runtime = $changed | Where-Object { $_ -notmatch $artifactOnly }
    if (-not $runtime) { exit 0 }
}

# --- choose the test target ---------------------------------------------------
$target = $env:AI_DLC_TEST_TARGET
if (-not $target) {
    $preferred = Get-ChildItem -LiteralPath $repoRoot -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '\.(Testing|Tests)\.slnx?$' } | Select-Object -First 1
    if ($preferred) { $target = $preferred.FullName }
}

$testArgs = @('test')
if ($target) { $testArgs += $target }
$testArgs += @('--nologo')

Push-Location -LiteralPath $repoRoot
try {
    $output = & dotnet @testArgs 2>&1 | Out-String
    $code = $LASTEXITCODE
} finally { Pop-Location }

if ($code -ne 0) {
    $tail = ($output -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 40) -join "`n"
    Write-Block ("dotnet test failed (exit $code). Fix all test failures before finishing. Last output:`n" + $tail)
}
exit 0
