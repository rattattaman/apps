$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$assetsDir = Join-Path $root 'signs-matching/assets/signs'
$outCsv = Join-Path $root 'signs-matching/data/mapping_template.csv'

if (-not (Test-Path $assetsDir)) { throw "No se encuentra el directorio de imágenes: $assetsDir" }
$files = Get-ChildItem $assetsDir -File | Sort-Object Name

"image,label" | Out-File -Encoding utf8 $outCsv
foreach ($f in $files) {
  $rel = "assets/signs/" + $f.Name
  "$rel," | Out-File -Encoding utf8 -Append $outCsv
}

Write-Host "Plantilla creada:" $outCsv
