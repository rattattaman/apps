$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dataDir = Join-Path $root 'signs-matching/data'
$outJson = Join-Path $dataDir 'items.json'
$outJs = Join-Path $dataDir 'items.js'

$mapping = Join-Path $dataDir 'mapping.csv'
if (-not (Test-Path $mapping)) { $mapping = Join-Path $dataDir 'mapping_template.csv' }
if (-not (Test-Path $mapping)) { throw "No existe mapping CSV en $dataDir" }

function To-Id($s) { if (-not $s -or $s.Trim() -eq '') { return $null }; ($s -replace '[^A-Za-z0-9]+','-').Trim('-').ToLowerInvariant() }

$csvRaw = Get-Content -Path $mapping -Raw -Encoding UTF8
$rows = $csvRaw | ConvertFrom-Csv
$items = @()
foreach ($r in $rows) {
  $img = $r.image; $label = $r.label
  if (-not $img -or $img.Trim() -eq '') { continue }
  $imgWeb = ($img -replace '\\','/'); $imgOs = ($imgWeb -replace '/','\\')
  $imgPath = Join-Path (Split-Path $dataDir -Parent) $imgOs
  if (-not (Test-Path $imgPath)) { Write-Warning "Imagen no encontrada: $img" }
  if (-not $label -or $label.Trim() -eq '') { $label = [IO.Path]::GetFileNameWithoutExtension($imgOs) }
  $id = To-Id $label; if (-not $id) { continue }
  $items += [PSCustomObject]@{ id = $id; label = $label; image = $imgWeb }
}

$json = $items | ConvertTo-Json -Depth 3
Set-Content -Path $outJson -Value $json -Encoding UTF8
Set-Content -Path $outJs -Value ("window.ITEMS = $json;") -Encoding UTF8
Write-Host "items.json generado:" $outJson
Write-Host "items.js generado:" $outJs

