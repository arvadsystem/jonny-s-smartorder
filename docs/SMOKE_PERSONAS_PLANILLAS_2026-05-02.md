# Smoke Test Guiado - Personas y Planillas (2026-05-02)

## Alcance validado en esta ronda
- Permisos de rutas frontend (`permissions.js`) sin llaves duplicadas.
- Listado de `Usuarios` con paginacion fija de 9 por pagina.
- Fallback del filtro `estado` en `personasService` para compatibilidad con backends sin soporte.
- Lint del alcance `personas/planillas/permisos` en verde.
- Build de frontend exitoso.

## Pruebas ejecutadas por terminal (resultado real)
Comando rapido para repetir validaciones tecnicas:
- `npm run qa:personas-planillas:smoke`

1. `npx eslint src/utils/permissions.js src/services/personasService.js src/pages/dashboard/personas --max-warnings=0`
- Resultado: `OK`.

2. `npm run build`
- Resultado: `OK` (build completo sin errores de compilacion).

3. `GET /status` backend
- Resultado: `200` con `{ "status": "ok" }`.

4. `GET /personas?page=1&limit=9` sin sesion
- Resultado: `401` (ruta protegida correctamente).

5. `GET /usuarios/v2/list?page=1&limit=9` sin sesion
- Resultado: `401` (ruta protegida correctamente).

## Pruebas manuales en UI (ejecutar con sesion iniciada)

### A) Usuarios - 9 cards por pagina
1. Ir a `Personas > Usuarios`.
2. Cambiar a vista `cards`.
3. Verificar que pagina 1 muestre exactamente 9 cards.
4. Presionar `Siguiente` y validar que pagina 2 tambien respete maximo 9.

Resultado esperado:
- Nunca deben mostrarse 6/7 en pagina cuando hay suficientes registros.

### B) Usuarios - consistencia activos/inactivos en cards
1. En `Usuarios`, mantener vista `cards`.
2. Revisar conteos KPI: total, activos, inactivos.
3. Navegar paginas y confirmar que tambien se muestran registros inactivos en cards cuando existan.

Resultado esperado:
- Los datos de cards no deben desaparecer por estado.
- Los KPI deben coincidir con el conjunto listado.

### C) Clientes - RTN en card despues de editar persona
1. Abrir `Personas > Clientes`.
2. Editar persona vinculada de un cliente persona.
3. Cambiar complemento RTN y guardar.
4. Volver al listado de cards.

Resultado esperado:
- La card refresca y muestra `RTN = DNI + complemento`.
- Si no hay complemento, mostrar `RTN: ----`.

### D) Personas - filtro estado tolerante
1. Abrir `Personas` (listado general).
2. Aplicar filtro de estado (activo/inactivo).
3. Si el backend no soporta `estado` en cierto entorno, validar que el frontend recupere datos sin romper pantalla.

Resultado esperado:
- No debe quedar la vista en error por `estado no soportado`.
- El usuario debe seguir viendo resultados.

### E) Planillas - regresion rapida
1. Abrir `Personas > Planillas`.
2. Abrir modal de adelantos.
3. Cerrar y reabrir modal.

Resultado esperado:
- El modal debe reabrir limpio (campos reseteados sin residuos de estado anterior).

## Criterio de salida (Go / No-Go)
- `GO`: Todas las pruebas A-E pasan.
- `NO-GO`: Si falla A, B o C, no desplegar cambios de personas.
