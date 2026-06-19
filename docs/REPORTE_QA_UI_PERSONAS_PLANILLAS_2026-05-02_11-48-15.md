# Reporte QA UI - Personas y Planillas

Fecha: 2026-05-02T17:48:15.279Z
Base URL: http://localhost:5173
Resultado global: PASS

| ID | Prueba | Resultado | Evidencia |
|---|---|---|---|
| A | Usuarios muestra 9 cards por pagina | PASS | cards_en_pagina=9 |
| B | Usuarios inactivos se muestran correctamente en cards | PASS | badges=5 textos=INACTIVO,INACTIVO,INACTIVO,INACTIVO,INACTIVO |
| C | Clientes refresca RTN en card tras editar persona | PASS | antes="RTN: 8767-5632-548907" despues="RTN: 8767-5632-548909" |
| D | Filtro estado no rompe pantalla | PASS | Sin errores de filtro estado |
| E | Modal de adelantos reabre limpio | PASS | fallback_global valor_reabrir="" |

