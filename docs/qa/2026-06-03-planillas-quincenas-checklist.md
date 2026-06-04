# QA Planillas mensual y quincenal

## Auditoria inicial
- Verificar columnas nuevas en `planillas`, `movimiento_planilla` y `adelanto_aplicacion`.
- Ejecutar `docs/sql/2026-06-03-planillas-diagnostico.sql` y guardar resultados.

## Planilla mensual
1. Seleccionar sucursal.
2. Seleccionar periodo mensual.
3. Generar planilla mensual.
4. Confirmar que `tipo_periodo = mensual` y `quincena = null`.
5. Confirmar rango del mes completo.
6. Confirmar que `salario_base` y `neto_pagar` usan salario mensual completo.
7. Registrar bono mensual.
8. Registrar deduccion mensual.
9. Registrar adelanto mensual.
10. Recalcular y validar neto.
11. Pagar.
12. Cerrar.
13. Intentar recalcular cerrada/pagada y validar bloqueo limpio.

## Planilla quincenal
1. Seleccionar periodo quincenal Q1.
2. Generar quincena 1.
3. Confirmar `fecha_inicio = 1` y `fecha_fin = 15`.
4. Confirmar prorrateo de salario por factor real del mes.
5. Registrar bono solo a Q1.
6. Registrar deduccion solo a Q1.
7. Aplicar adelanto solo a Q1.
8. Pagar Q1.
9. Generar Q2 del mismo mes y sucursal.
10. Confirmar que no reutiliza movimientos exclusivos de Q1.
11. Confirmar `fecha_inicio = 16` y `fecha_fin = ultimo dia`.
12. Confirmar salario prorrateado correcto en Q2.
13. Pagar Q2.
14. Confirmar que no hay doble pago mensual completo.

## Estados
- Intentar pagar una planilla anulada.
- Intentar cambiar de estado una planilla anulada.
- Confirmar que estados se aplican a la fila de planilla/quincena correcta.

## Datos invalidos
- Intentar generar con empleados activos sin salario.
- Intentar generar con empleados activos sin cargo.
- Confirmar que el sistema no genera si no hay empleados validos.
- Confirmar que los invalidos se reportan sin error tecnico crudo.

## Seguridad
- Super Admin: acceso total.
- Usuario solo lectura: ve planillas, no genera ni paga.
- Usuario genera pero no paga: validar 403 correcto.
- Usuario paga pero no anula: validar 403 correcto.
- Confirmar que no hay 500 por `tipo_periodo` o `quincena`.

## Tecnico
- Ejecutar `node --check routers/planillas.js`.
- Ejecutar `npm run build` en frontend.
- Revisar consola del navegador.
- Revisar logs backend por errores SQL.
