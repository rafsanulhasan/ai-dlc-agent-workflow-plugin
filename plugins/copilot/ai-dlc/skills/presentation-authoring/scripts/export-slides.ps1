#!/usr/bin/env pwsh
# export-slides.ps1 — render slides to PNG through installed PowerPoint (Windows), without a window.
#
#   pwsh -NoProfile -File export-slides.ps1 -Deck C:\path\deck.pptx -OutDir C:\path\out [-Slides 4,5,8]
#
# Writes s<N>.png (1600x900) per slide; all slides when -Slides is omitted. Use absolute paths.
# On macOS/Linux, render with LibreOffice instead: soffice --headless --convert-to pdf deck.pptx.
param(
    [Parameter(Mandatory)] [string] $Deck,
    [Parameter(Mandatory)] [string] $OutDir,
    [string] $Slides   # comma-separated slide numbers, e.g. "4,5,8"
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$app = New-Object -ComObject PowerPoint.Application
try {
    # ReadOnly, Untitled = false, WithWindow = false
    $p = $app.Presentations.Open((Resolve-Path $Deck).Path, $true, $false, $false)
    try {
        $targets = if ($Slides) { $Slides -split ',' | ForEach-Object { [int]$_.Trim() } } else { 1..$p.Slides.Count }
        foreach ($i in $targets) {
            $file = Join-Path $OutDir "s$i.png"
            $p.Slides.Item($i).Export($file, 'PNG', 1600, 900)
            Write-Output $file
        }
    } finally { $p.Close() }
} finally { $app.Quit() }
