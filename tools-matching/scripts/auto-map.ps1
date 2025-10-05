$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$bin = Join-Path $root 'vendor/poppler/poppler-23.11.0/Library/bin'
$pdf = Join-Path $root '2_ESO/Tools solved.pdf'
$tmp = Join-Path $root 'tools-matching/tmp'
$assetsRel = 'assets/tools'
$assets = Join-Path $root ('tools-matching/' + $assetsRel)
$outCsv = Join-Path $root 'tools-matching/data/mapping.csv'

if (-not (Test-Path $pdf)) { throw "PDF no encontrado: $pdf" }
New-Item -ItemType Directory -Force $tmp | Out-Null

$pdfimages = Join-Path $bin 'pdfimages.exe'
$pdftotext = Join-Path $bin 'pdftotext.exe'

# 1) Listado de imágenes con números de página
$imagesList = Join-Path $tmp 'images_list.txt'
& $pdfimages -list $pdf | Out-File -Encoding utf8 $imagesList

function Parse-ImagesList($path) {
  $lines = Get-Content $path
  $items = @()
  foreach ($ln in $lines) {
    # Expect rows like:  page   num  type   width height ...
    if ($ln -match '^(\s*)(?<page>\d+)\s+(?<num>\d+)\s+\S+\s+(?<w>\d+)\s+(?<h>\d+)') {
      $page = [int]$Matches.page
      $num = [int]$Matches.num
      $w = [int]$Matches.w
      $h = [int]$Matches.h
      $items += [PSCustomObject]@{ page=$page; num=$num; w=$w; h=$h; file=("tool-{0:d3}.png" -f $num) }
    }
  }
  # Filtrar imágenes pequeñas (probablemente iconos)
  $items | Where-Object { $_.w -ge 100 -and $_.h -ge 100 }
}

function Extract-Names-FromPage($txtPath) {
  $res = @()
  if (-not (Test-Path $txtPath)) { return $res }
  $lines = Get-Content $txtPath
  for ($i=0; $i -lt $lines.Count; $i++) {
    $l = ($lines[$i]).Trim()
    if ($l -eq '' ) { continue }
    if ($l -match 'GROUP' -or $l -match 'Use:') { continue }
    if ($l -match '^[_\s]+$') { continue }
    # Mira si las siguientes líneas contienen subrayados (indicio de huecos debajo de nombres)
    $hasUnder = $false
    for ($k=1; $k -le 2 -and ($i+$k) -lt $lines.Count; $k++) {
      if ($lines[$i+$k] -match '_{3,}') { $hasUnder = $true; break }
    }
    if (-not $hasUnder) { continue }

    # Divide por múltiples espacios para obtener varios nombres en la misma línea
    $parts = [regex]::Split($l, '\s{2,}') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
    foreach ($p in $parts) {
      # descarta títulos en mayúsculas
      if ($p -match '^[A-Z\s]+$') { continue }
      $res += $p
    }
  }
  $res
}

# 2) Páginas con imágenes
$imgs = Parse-ImagesList $imagesList
$pages = ($imgs | Select-Object -ExpandProperty page | Sort-Object -Unique)

# 3) Extraer texto por página y detectar nombres
$pageNames = @{}
foreach ($p in $pages) {
  $outTxt = Join-Path $tmp ("page-{0:d3}.txt" -f $p)
  & $pdftotext -layout -f $p -l $p $pdf $outTxt
  $pageNames[$p] = Extract-Names-FromPage $outTxt
}

# 4) Emparejar por página en orden
"image,label" | Out-File -Encoding utf8 $outCsv
foreach ($p in $pages) {
  $pImgs = $imgs | Where-Object { $_.page -eq $p } | Sort-Object num
  $names = @($pageNames[$p])
  for ($i=0; $i -lt $pImgs.Count; $i++) {
    $imgFile = $pImgs[$i].file
    $imgAbs = Join-Path $assets $imgFile
    if (-not (Test-Path $imgAbs)) { continue }
    $label = if ($i -lt $names.Count) { $names[$i] } else { [IO.Path]::GetFileNameWithoutExtension($imgFile) }
    # Limpia tokens indeseados
    if ($label -match '^_+$') { continue }
    $rel = "$assetsRel/$imgFile"
    "$rel,$label" | Out-File -Encoding utf8 -Append $outCsv
  }
}

Write-Host "mapping.csv generado:" $outCsv
