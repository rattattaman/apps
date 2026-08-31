# Orb Arena

Simulador automático de combates 2D para dos a cuatro orbes. El espectador configura el encuentro y Matter Physics resuelve el movimiento, los rebotes y el resultado.

## Reglas

- Cada orbe se mueve y rebota automáticamente, conservando una velocidad mínima.
- Las armas cuerpo a cuerpo orbitan a su dueño. Arma contra orbe causa daño; arma contra arma produce una parada sin daño.
- Los proyectiles dañan orbes y pueden ser desviados por cualquier arma rival.
- Un mismo atacante no puede aplicar daño continuamente al mismo objetivo: cada pareja tiene una breve recarga.
- Al llegar a cero de vida, el orbe queda eliminado. El último orbe vivo gana.
- Al cabo de dos minutos se activa muerte súbita y la arena comienza a cerrarse para impedir empates interminables.

## Armas

- **Espada:** comienza con 1 de daño y suma 1 tras cada impacto.
- **Daga:** es la más corta y rápida; gana mucha velocidad de giro tras cada impacto.
- **Lanza:** comienza con 1 de daño, aplica mucho retroceso y suma 0,5 de daño y 3 de alcance.
- **Arco:** dispara periódicamente; cada impacto añade una flecha escalonada a sus próximas ráfagas.

## Controles

- La pantalla inicial permite elegir 2–4 combatientes, sus armas, la vida, la semilla y el Modo Caos.
- Durante la batalla: pausa, reinicio, nueva batalla, velocidad ×0,5/×1/×2, sonido y partículas.
- Teclado opcional: `P` pausa, `R` reinicia y `M` silencia.
- Todos los controles son botones táctiles y la arena se escala para móvil, tableta y escritorio.

## Modo Caos

Los modificadores viven en `src/modifiers/ChaosController.ts` como una lista modular y determinista. Incluye arena menguante, gravedad temporal intensa, crecimiento de armas, duplicación de flechas, giro inverso, curación al rebotar, muerte súbita y aceleración global. Fuera de este modificador, la arena conserva gravedad cero.

## Estructura

- `src/scenes`: ciclo y coordinación de la batalla.
- `src/combat`: combatientes, progresión y recargas.
- `src/weapons`: representación y órbita de armas.
- `src/projectiles`: flechas controladas por Matter.
- `src/modifiers`: catálogo modular del Modo Caos.
- `src/config`: valores de balance centralizados.
- `src/audio`, `src/storage`, `src/utils`: sonido generativo, estadísticas locales y lógica comprobable.
- `dev/index.html`: plantilla de desarrollo. La compilación genera `index.html` y `assets/` en la raíz para GitHub Pages.

## Comandos

```bash
npm install
npm run dev
npm run check
npm run build
```

La configuración de Vite usa la base `/apps/orb-arena/`. `npm run build` conserva en la raíz los archivos estáticos que publica GitHub Pages.
