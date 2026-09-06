# Añadir un arma

1. Añadir su identificador a `WEAPON_TYPES` en `src/types.ts` y su definición a `WEAPONS` en `src/config/balance.ts`. Añadir el personaje a `DEFAULT_FIGHTERS` solo cuando se quiera ampliar el elenco real.
2. Definir progresión en `src/combat/combatLogic.ts` y representación en `src/weapons/OrbitWeapon.ts`. Reutilizar geometría/texturas cuando sea posible.
3. Para una interacción nueva, integrarla en el paso de combate de `BattleScene`. Usar `rivals` para objetivos y `dealDamage` para daño realmente aplicado; no llamar directamente a `Combatant.damage` desde nuevas armas. Invocaciones heredan equipo y registran su creador en `BattleLedger`.
4. Mantener las reglas de copia de Grimorio y duplicación; añadir pruebas del comportamiento y la progresión. Añadir la clave con cero a estadísticas para conservar compatibilidad con datos antiguos.
5. Ejecutar check, build y pruebas de navegador, incluidos equipos y una Copa. Selector y participantes de Copa se derivan del inventario existente. No añadir topes de entidades ni cambios de balance como optimización.
