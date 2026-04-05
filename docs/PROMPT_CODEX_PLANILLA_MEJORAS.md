# Prompt Codex - Mejoras UX Planillas (Implementado)

## Alcance aplicado
- Frontend del modulo Planillas en `src/pages/dashboard/personas`.
- Sin cambios de endpoints backend.
- Sin librerias nuevas.

## Implementacion aplicada
1. Tabla premium
- `PlanillasTable` delega a `PayrollTable` + `EmployeeRow`.
- Header oscuro con gradiente, columnas en uppercase, neto destacado, footer total.

2. Cards de resumen
- `PlanillasResumenCards` ahora usa `SummaryCard`.
- Jerarquia tipografica y hover consistente.

3. Filtros avanzados
- Nuevo `PayrollFilters` con:
  - busqueda
  - sucursal
  - cargo
  - salario minimo y maximo
  - pills activas y limpiar filtros
- Filtro aplicado del lado cliente sobre detalle cargado.

4. Exportacion
- Nuevo `ExportModal` con formatos:
  - Excel (CSV descargable)
  - PDF (vista imprimible + dialogo de navegador)
  - Imprimir
- Toggle de opciones para incluir detalle, movimientos y correo.
- Boton `Exportar` visible en header cuando la planilla esta pagada.

5. Compatibilidad y flujo
- Se mantiene generar/recalcular/cerrar/pagar/anular.
- Se mantiene detalle, movimientos, adelantos y auditoria.
- Se elimina envio de `id_detalle` en aplicar adelanto (solo payload permitido).

## Archivos principales
- `src/pages/dashboard/personas/Planillas.jsx`
- `src/pages/dashboard/personas/components/planillas/PlanillasHeader.jsx`
- `src/pages/dashboard/personas/components/planillas/PlanillasTable.jsx`
- `src/pages/dashboard/personas/components/planillas/PayrollTable.jsx`
- `src/pages/dashboard/personas/components/planillas/EmployeeRow.jsx`
- `src/pages/dashboard/personas/components/planillas/PlanillasResumenCards.jsx`
- `src/pages/dashboard/personas/components/planillas/SummaryCard.jsx`
- `src/pages/dashboard/personas/components/planillas/PayrollFilters.jsx`
- `src/pages/dashboard/personas/components/planillas/ExportModal.jsx`
- `src/services/planillasService.js`
- `src/assets/styles/_personas.scss`
