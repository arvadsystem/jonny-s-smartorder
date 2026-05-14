# Mejoras Aplicadas - Planillas

## Checklist

## Tabla principal
- [x] Componente `PayrollTable` integrado.
- [x] Filas separadas con `EmployeeRow`.
- [x] Header con gradiente oscuro.
- [x] Alineacion numerica derecha y `tabular-nums`.
- [x] Neto destacado con hover.

## Resumen financiero
- [x] `SummaryCard` reutilizable en `PlanillasResumenCards`.
- [x] Variantes visuales por tipo (default/success/warning).
- [x] Card de neto con jerarquia mas alta.

## Filtros avanzados
- [x] Componente `PayrollFilters` integrado antes de tabla.
- [x] Busqueda, sucursal, cargo, salario min y max.
- [x] Pills de filtros activos.
- [x] Boton limpiar filtros.

## Exportacion
- [x] `ExportModal` con selector de formato.
- [x] Excel via CSV real descargable.
- [x] PDF/Imprimir por vista imprimible + print dialog.
- [x] Opcion de incluir movimientos/correo.
- [x] Loading state durante export.

## Ajustes de servicio
- [x] `registrarMovimientoPlanilla` envia solo campos permitidos.
- [x] `anularMovimientoPlanilla` envia payload restringido.
- [x] Aplicar adelanto ya no envia `id_detalle`.

## Estilos y UX
- [x] Estilos SCSS nuevos para tabla/cards/filtros/export.
- [x] Paleta marron/beige/crema respetada.
- [x] Microinteracciones de hover y feedback visual.

## No regresion (objetivo)
- [x] Sin cambios de endpoints.
- [x] Sin cambios en backend.
- [x] Sin nuevas dependencias.
