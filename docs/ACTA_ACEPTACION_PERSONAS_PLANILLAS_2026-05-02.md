# Acta de Aceptacion QA - Personas y Planillas

Fecha: `2026-05-02`  
Proyecto: `jonny-s-smartorder`  
Ambito: `Personas (clientes, empleados, usuarios) + Planillas`

Referencia de ejecucion:
- [SMOKE_PERSONAS_PLANILLAS_2026-05-02.md](/d:/TareasBryan/Implementacion_de_sistemas/Proyectos/jonny-s-smartorder/docs/SMOKE_PERSONAS_PLANILLAS_2026-05-02.md)
- [REPORTE_QA_TECNICO_PERSONAS_PLANILLAS_2026-05-02_10-59-53.md](/d:/TareasBryan/Implementacion_de_sistemas/Proyectos/jonny-s-smartorder/docs/REPORTE_QA_TECNICO_PERSONAS_PLANILLAS_2026-05-02_10-59-53.md)

## 1) Resultado por prueba

Marca una opcion por fila: `PASS` o `FAIL`.

| ID | Prueba | Resultado | Evidencia | Observacion |
|---|---|---|---|---|
| A | Usuarios muestra 9 cards por pagina | ☐ PASS ☐ FAIL | | |
| B | Usuarios muestra activos/inactivos correctamente en cards | ☐ PASS ☐ FAIL | | |
| C | Clientes refresca RTN en card tras editar persona | ☐ PASS ☐ FAIL | | |
| D | Filtro `estado` en personas no rompe pantalla | ☐ PASS ☐ FAIL | | |
| E | Modal de adelantos abre limpio al reabrir | ☐ PASS ☐ FAIL | | |

## 2) Validaciones tecnicas

| ID | Validacion | Resultado | Evidencia |
|---|---|---|---|
| T1 | `eslint` alcance personas/permisos | PASS | `npx eslint src/utils/permissions.js src/services/personasService.js src/pages/dashboard/personas --max-warnings=0` |
| T2 | `npm run build` frontend | PASS | `vite build` exitoso |
| T3 | `GET /status` responde `200` | PASS | `{"status":"ok", ...}` |
| T4 | `GET /personas` sin sesion responde `401` | PASS | respuesta `HTTP 401` |
| T5 | `GET /usuarios/v2/list` sin sesion responde `401` | PASS | respuesta `HTTP 401` |

## 3) Criterio de liberacion

- `GO`: todas las pruebas `A-E` en `PASS`.
- `NO-GO`: si cualquiera de `A-E` esta en `FAIL`.

## 4) Decisiones y acciones

Pendientes detectados:
-  

Acciones correctivas:
-  

## 5) Cierre y aprobacion

Estado final: `☐ GO` / `☐ NO-GO`  
Responsable QA:  
Responsable funcional:  
Responsable tecnico:  
Fecha y hora de cierre:
