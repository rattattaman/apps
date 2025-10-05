$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dataDir = Join-Path $root 'tools-matching/data'
$assetsDir = Join-Path $root 'tools-matching/assets/tools'
$outJson = Join-Path $dataDir 'items.json'

$mapping = Join-Path $dataDir 'mapping.csv'
if (-not (Test-Path $mapping)) { $mapping = Join-Path $dataDir 'mapping_template.csv' }
if (-not (Test-Path $mapping)) { throw "No existe mapping CSV en $dataDir" }

function To-Id($s) {
  if (-not $s -or $s.Trim() -eq '') { return $null }
  ($s -replace '[^A-Za-z0-9]+','-').Trim('-').ToLowerInvariant()
}

$csvRaw = Get-Content -Path $mapping -Raw -Encoding UTF8
$rows = $csvRaw | ConvertFrom-Csv
$items = @()
foreach ($r in $rows) {
  $img = $r.image
  $label = $r.label
  if (-not $img -or $img.Trim() -eq '') { continue }
  # Normalize paths: CSV might contain backslashes; browser needs '/'
  $imgWeb = ($img -replace '\\','/')
  $imgOs = ($imgWeb -replace '/','\\')
  $imgPath = Join-Path (Split-Path $dataDir -Parent) $imgOs
  if (-not (Test-Path $imgPath)) { Write-Warning "Imagen no encontrada: $img" }
  if (-not $label -or $label.Trim() -eq '') {
    # Usa el nombre de archivo como fallback
    $label = [IO.Path]::GetFileNameWithoutExtension($imgOs)
  }
  $id = To-Id $label
  if (-not $id) { continue }
  $items += [PSCustomObject]@{ id = $id; label = $label; image = $imgWeb }
}

$json = $items | ConvertTo-Json -Depth 3
Set-Content -Path $outJson -Value $json -Encoding UTF8
Write-Host "items.json generado:" $outJson

# También generamos items.js para carga offline (file://)
$outJs = Join-Path $dataDir 'items.js'
$js = "window.ITEMS = $json;"
Set-Content -Path $outJs -Value $js -Encoding UTF8
Write-Host "items.js generado:" $outJs
