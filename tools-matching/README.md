2ESO Tools Matching

- Abre `index.html` directamente en el navegador.
- Los datos están en `data/items.json`.
- Imágenes en `assets/tools/` (extraídas del PDF).

Extracción desde `2_ESO/Tools solved.pdf`
- Poppler ya está descargado localmente en `vendor/poppler/`.
- Ejecuta: `powershell -ExecutionPolicy Bypass -File scripts/extract2.ps1`
  - Extrae imágenes a `assets/tools/tool-XXX.png`.
  - Extrae texto a `tmp/tools.txt`.

Crear mapeo imagen → nombre (en inglés)
- Genera plantilla: `powershell -ExecutionPolicy Bypass -File scripts/generate-mapping.ps1`
- Abre y rellena `data/mapping_template.csv` (columna `label`).
- (Opcional) Guarda como `data/mapping.csv` para conservar tu versión.

Construir `data/items.json`
- `powershell -ExecutionPolicy Bypass -File scripts/build.ps1`
  - Usa `data/mapping.csv` si existe, si no `data/mapping_template.csv`.
  - Genera `data/items.json` para el juego (imagen ↔ etiqueta).

Probar
- Abre `index.html` en el navegador (doble clic). 
