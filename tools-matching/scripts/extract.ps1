param(
  [string]$PdfPath = "..\..\2_ESO\Tools solved.pdf"
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$vendorBin = Join-Path $root 'vendor/poppler/poppler-23.11.0/Library/bin'
$imagesOut = Join-Path $root 'tools-matching/assets/tools'
$tmpDir = Join-Path $root 'tools-matching/tmp'

New-Item -ItemType Directory -Force $imagesOut | Out-Null
New-Item -ItemType Directory -Force $tmpDir | Out-Null

$pdfImages = Join-Path $vendorBin 'pdfimages.exe'
$pdfToText = Join-Path $vendorBin 'pdftotext.exe'

& $pdfImages -png $PdfPath (Join-Path $imagesOut 'tool')
& $pdfToText -layout -nopgbrk $PdfPath (Join-Path $tmpDir 'tools.txt')

Write-Host "--- Extracted images ---"
Get-ChildItem $imagesOut | Select-Object Name, Length | Format-Table -AutoSize

Write-Host "--- Text sample (first 40 lines) ---"
Get-Content (Join-Path $tmpDir 'tools.txt') -TotalCount 40

