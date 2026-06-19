-- Diagnostico seguro de planillas mensual/quincenal.
-- No corrige datos. Solo muestra hallazgos.

-- 1) Planillas sin tipo_periodo.
SELECT id_planilla, id_sucursal, fecha_creacion, tipo_periodo
FROM public.planillas
WHERE tipo_periodo IS NULL OR NULLIF(TRIM(tipo_periodo), '') IS NULL
ORDER BY id_planilla DESC;

-- 2) Planillas quincenales sin quincena.
SELECT id_planilla, id_sucursal, periodo, tipo_periodo, quincena
FROM public.planillas
WHERE UPPER(COALESCE(tipo_periodo, 'MENSUAL')) = 'QUINCENAL'
  AND quincena IS NULL
ORDER BY id_planilla DESC;

-- 3) Planillas mensuales con quincena asignada.
SELECT id_planilla, id_sucursal, periodo, tipo_periodo, quincena
FROM public.planillas
WHERE UPPER(COALESCE(tipo_periodo, 'MENSUAL')) = 'MENSUAL'
  AND quincena IS NOT NULL
ORDER BY id_planilla DESC;

-- 4) Planillas sin fecha_inicio o fecha_fin.
SELECT id_planilla, id_sucursal, periodo, tipo_periodo, quincena, fecha_inicio, fecha_fin
FROM public.planillas
WHERE fecha_inicio IS NULL OR fecha_fin IS NULL
ORDER BY id_planilla DESC;

-- 5) Duplicados por sucursal, periodo, tipo_periodo y quincena.
SELECT
  id_sucursal,
  COALESCE(periodo, to_char(fecha_creacion, 'YYYY-MM')) AS periodo_resuelto,
  UPPER(COALESCE(tipo_periodo, 'MENSUAL')) AS tipo_periodo_resuelto,
  COALESCE(quincena, 0) AS quincena_resuelta,
  COUNT(*) AS total_planillas,
  array_agg(id_planilla ORDER BY id_planilla) AS planillas
FROM public.planillas
GROUP BY 1, 2, 3, 4
HAVING COUNT(*) > 1
ORDER BY total_planillas DESC, id_sucursal, periodo_resuelto;

-- 6) Detalles donde neto no coincide con salario + bonos - deducciones.
SELECT
  dp.id_detalle_planilla,
  dp.id_planilla,
  dp.id_empleado,
  dp.salario_base,
  dp.total_bonos,
  dp.total_deducciones,
  dp.neto_pagar,
  ROUND((COALESCE(dp.salario_base, 0) + COALESCE(dp.total_bonos, 0) - COALESCE(dp.total_deducciones, 0))::numeric, 2) AS neto_esperado
FROM public.detalle_planilla dp
WHERE ROUND(COALESCE(dp.neto_pagar, 0)::numeric, 2)
    <> ROUND((COALESCE(dp.salario_base, 0) + COALESCE(dp.total_bonos, 0) - COALESCE(dp.total_deducciones, 0))::numeric, 2)
ORDER BY dp.id_detalle_planilla DESC;

-- 7) Empleados activos sin salario.
SELECT id_empleado, id_sucursal, id_cargo, cargo, salario_base
FROM public.empleados
WHERE COALESCE(estado, FALSE) = TRUE
  AND COALESCE(salario_base, 0) <= 0
ORDER BY id_empleado;

-- 8) Empleados activos sin cargo.
SELECT id_empleado, id_sucursal, id_cargo, cargo, salario_base
FROM public.empleados
WHERE COALESCE(estado, FALSE) = TRUE
  AND id_cargo IS NULL
  AND COALESCE(NULLIF(TRIM(cargo), ''), '') = ''
ORDER BY id_empleado;

-- 9) Empleados activos sin sucursal.
SELECT id_empleado, id_sucursal, id_cargo, cargo, salario_base
FROM public.empleados
WHERE COALESCE(estado, FALSE) = TRUE
  AND id_sucursal IS NULL
ORDER BY id_empleado;

-- 10) Adelantos aplicados sin periodo/quincena.
SELECT aa.id_adelanto_aplicacion, aa.id_planilla, aa.id_adelanto_salario, aa.tipo_periodo, aa.quincena, aa.monto_aplicado
FROM public.adelanto_aplicacion aa
WHERE aa.tipo_periodo IS NULL
   OR NULLIF(TRIM(aa.tipo_periodo), '') IS NULL
   OR (UPPER(COALESCE(aa.tipo_periodo, 'MENSUAL')) = 'QUINCENAL' AND aa.quincena IS NULL)
ORDER BY aa.id_adelanto_aplicacion DESC;

-- 11) Movimientos sin periodo/quincena.
SELECT id_movimiento_planilla, id_detalle_planilla, tipo_movimiento, concepto, tipo_periodo, quincena, fecha_aplicacion
FROM public.movimiento_planilla
WHERE tipo_periodo IS NULL
   OR NULLIF(TRIM(tipo_periodo), '') IS NULL
   OR fecha_aplicacion IS NULL
   OR (UPPER(COALESCE(tipo_periodo, 'MENSUAL')) = 'QUINCENAL' AND quincena IS NULL)
ORDER BY id_movimiento_planilla DESC;

-- 12) Planillas pagadas con totales inconsistentes.
SELECT
  p.id_planilla,
  p.id_sucursal,
  p.periodo,
  p.tipo_periodo,
  p.quincena,
  ep.descripcion AS estado_planilla,
  ROUND(SUM(COALESCE(dp.salario_base, 0) + COALESCE(dp.total_bonos, 0) - COALESCE(dp.total_deducciones, 0))::numeric, 2) AS neto_esperado,
  ROUND(SUM(COALESCE(dp.neto_pagar, 0))::numeric, 2) AS neto_guardado
FROM public.planillas p
JOIN public.estado_planilla ep ON ep.id_estado_planilla = p.id_estado_planilla
LEFT JOIN public.detalle_planilla dp ON dp.id_planilla = p.id_planilla
WHERE UPPER(COALESCE(ep.descripcion, '')) = 'PAGADA'
GROUP BY p.id_planilla, p.id_sucursal, p.periodo, p.tipo_periodo, p.quincena, ep.descripcion
HAVING ROUND(SUM(COALESCE(dp.salario_base, 0) + COALESCE(dp.total_bonos, 0) - COALESCE(dp.total_deducciones, 0))::numeric, 2)
    <> ROUND(SUM(COALESCE(dp.neto_pagar, 0))::numeric, 2)
ORDER BY p.id_planilla DESC;
