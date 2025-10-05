$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$imagesDir = Join-Path $root 'tools-matching/assets/tools'
$outCsv = Join-Path $root 'tools-matching/data/mapping_template.csv'

if (-not (Test-Path $imagesDir)) { throw "No se encuentra el directorio de imágenes: $imagesDir" }
$files = Get-ChildItem $imagesDir -File | Sort-Object Name

"image,label" | Out-File -Encoding utf8 $outCsv
foreach ($f in $files) {
  $rel = "assets/tools/" + $f.Name
  # label se deja vacío para que el usuario lo rellene
  "$rel," | Out-File -Encoding utf8 -Append $outCsv
}

Write-Host "Plantilla creada:" $outCsv
