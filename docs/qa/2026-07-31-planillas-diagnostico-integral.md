# Diagnostico integral de planillas - QA

Fecha: 2026-07-31

## Estado

- Repositorio frontend revisado en rama `dev`.
- Repositorio backend revisado en rama `dev`.
- Produccion no fue consultada ni modificada.
- QA SQL pendiente de ejecucion autorizada con `docs/sql/2026-07-31-planillas-diagnostico-integral-qa.sql`.

## Hallazgos de codigo confirmados

- Frontend enviaba `CALCULADA` al cerrar una planilla desde `handleChangeEstado`.
- Backend convertia `CERRADA` a `CALCULADA` en `normalizeEstadoAlias`.
- El flujo de anulacion de bonos/deducciones usaba `skipReload: true` y luego `void refreshPlanillaData()`.
- La generacion oficial actual esta implementada en Node.js con transaccion y factor quincenal `0.5`.
- La funcion mensual legacy quedaba referenciada como contrato interno aunque no se usaba para generar.
- Habia textos mojibake en fuente del modulo de planillas.

## Evidencia pendiente de QA

Ejecutar el SQL de diagnostico en el proyecto QA `cluideiojeikzcmmizhe` y adjuntar resultados para:

- Estados y IDs en `estado_planilla`.
- Planillas quincenales con salario base distinto al 50%.
- Planillas sin `tipo_periodo` o quincena requerida.
- Fechas de periodo inconsistentes.
- Duplicados logicos por sucursal/periodo/tipo/quincena.
- Movimientos anulados todavia incluidos en totales.
- Detalles con neto inconsistente.
- Planillas no cerradas con auditoria de cierre.

## Riesgos

- La comparacion contra salario mensual actual puede marcar falsos positivos si el salario del empleado cambio despues de generar una planilla historica.
- No debe aplicarse ningun script correctivo automatico hasta validar registros afectados en QA.
