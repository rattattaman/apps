$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pptx = Join-Path $root '2_ESO/signs_solved.pptx'
$work = Join-Path $root 'signs-matching/tmp'
$media = Join-Path $work 'ppt/media'
$assets = Join-Path $root 'signs-matching/assets/signs'
$textOut = Join-Path $root 'signs-matching/tmp/signs.txt'

if (-not (Test-Path $pptx)) { throw "PPTX no encontrado: $pptx" }
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Force $work | Out-Null
New-Item -ItemType Directory -Force $assets | Out-Null

# Descomprimir PPTX (es un ZIP)
Expand-Archive -Path $pptx -DestinationPath $work -Force

# Copiar imágenes a assets/signs con nombres normalizados
$i = 0
Get-ChildItem $media -File | Sort-Object Name | ForEach-Object {
  $ext = $_.Extension
  $name = ('sign-{0:d3}{1}' -f $i, $ext)
  Copy-Item $_.FullName (Join-Path $assets $name) -Force
  $i++
}

# Extraer texto simple de slides
Remove-Item -ErrorAction SilentlyContinue $textOut
Get-ChildItem (Join-Path $work 'ppt/slides') -Filter '*.xml' | Sort-Object Name | ForEach-Object {
  # Capturar contenido dentro de <a:t>...</a:t>
  $xml = Get-Content $_.FullName -Raw
  [regex]$re = '<a:t>(.*?)</a:t>'
  $matches = $re.Matches($xml)
  foreach ($m in $matches) { ($m.Groups[1].Value) | Out-File -Append -Encoding utf8 $textOut }
  "`n----`n" | Out-File -Append -Encoding utf8 $textOut
}

Write-Host 'Imágenes copiadas a' $assets
if (Test-Path $textOut) { Write-Host 'Texto en' $textOut }

