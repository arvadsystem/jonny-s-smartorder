-- Diagnostico integral QA de planillas.
-- Solo lectura. No ejecutar en Produccion sin aprobacion explicita.

-- 1) Estados existentes y sus IDs.
SELECT
  ep.id_estado_planilla,
  ep.descripcion
FROM public.estado_planilla ep
ORDER BY ep.id_estado_planilla;

-- 2) Planillas quincenales con salario base distinto al 50% del salario mensual actual.
-- Nota: si el salario del empleado cambio despues de generar la planilla, revisar manualmente antes de corregir.
SELECT
  p.id_planilla,
  p.id_sucursal,
  p.periodo,
  p.tipo_periodo,
  p.quincena,
  dp.id_detalle_planilla,
  dp.id_empleado,
  e.salario_base AS salario_mensual_actual,
  dp.salario_base AS salario_base_planilla,
  ROUND((COALESCE(e.salario_base, 0) * 0.5)::numeric, 2) AS salario_quincenal_esperado,
  ROUND((COALESCE(dp.salario_base, 0) - (COALESCE(e.salario_base, 0) * 0.5))::numeric, 2) AS diferencia
FROM public.planillas p
JOIN public.detalle_planilla dp
  ON dp.id_planilla = p.id_planilla
JOIN public.empleados e
  ON e.id_empleado = dp.id_empleado
WHERE UPPER(COALESCE(p.tipo_periodo, 'MENSUAL')) = 'QUINCENAL'
  AND ROUND(COALESCE(dp.salario_base, 0)::numeric, 2)
      <> ROUND((COALESCE(e.salario_base, 0) * 0.5)::numeric, 2)
ORDER BY p.id_planilla DESC, dp.id_detalle_planilla;

-- 3) Planillas sin tipo_periodo.
SELECT id_planilla, id_sucursal, fecha_creacion, periodo, tipo_periodo, quincena
FROM public.planillas
WHERE tipo_periodo IS NULL OR NULLIF(TRIM(tipo_periodo), '') IS NULL
ORDER BY id_planilla DESC;

-- 4) Planillas quincenales sin numero de quincena.
SELECT id_planilla, id_sucursal, periodo, tipo_periodo, quincena
FROM public.planillas
WHERE UPPER(COALESCE(tipo_periodo, 'MENSUAL')) = 'QUINCENAL'
  AND quincena IS NULL
ORDER BY id_planilla DESC;

-- 5) Fechas de periodo inconsistentes.
SELECT id_planilla, id_sucursal, periodo, tipo_periodo, quincena, fecha_inicio, fecha_fin
FROM public.planillas
WHERE fecha_inicio IS NULL
   OR fecha_fin IS NULL
   OR fecha_inicio > fecha_fin
   OR (
     UPPER(COALESCE(tipo_periodo, 'MENSUAL')) = 'QUINCENAL'
     AND quincena = 1
     AND EXTRACT(DAY FROM fecha_inicio) <> 1
   )
   OR (
     UPPER(COALESCE(tipo_periodo, 'MENSUAL')) = 'QUINCENAL'
     AND quincena = 1
     AND EXTRACT(DAY FROM fecha_fin) <> 15
   )
   OR (
     UPPER(COALESCE(tipo_periodo, 'MENSUAL')) = 'QUINCENAL'
     AND quincena = 2
     AND EXTRACT(DAY FROM fecha_inicio) <> 16
   )
   OR (
     UPPER(COALESCE(tipo_periodo, 'MENSUAL')) = 'MENSUAL'
     AND quincena IS NOT NULL
   )
ORDER BY id_planilla DESC;

-- 6) Duplicados logicos por sucursal, periodo, tipo_periodo y quincena.
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

-- 7) Movimientos anulados todavia incluidos en totales del detalle.
WITH movimientos_vigentes AS (
  SELECT
    mp.id_detalle_planilla,
    SUM(CASE WHEN UPPER(TRIM(mp.tipo_movimiento)) = 'BONO' AND COALESCE(mp.estado, TRUE) THEN mp.monto ELSE 0 END) AS bonos_vigentes,
    SUM(CASE WHEN UPPER(TRIM(mp.tipo_movimiento)) = 'DEDUCCION' AND COALESCE(mp.estado, TRUE) THEN mp.monto ELSE 0 END) AS deducciones_vigentes
  FROM public.movimiento_planilla mp
  GROUP BY mp.id_detalle_planilla
)
SELECT
  dp.id_detalle_planilla,
  dp.id_planilla,
  dp.total_bonos,
  COALESCE(mv.bonos_vigentes, 0) AS bonos_vigentes,
  dp.total_deducciones,
  COALESCE(mv.deducciones_vigentes, 0) AS deducciones_vigentes
FROM public.detalle_planilla dp
LEFT JOIN movimientos_vigentes mv
  ON mv.id_detalle_planilla = dp.id_detalle_planilla
WHERE ROUND(COALESCE(dp.total_bonos, 0)::numeric, 2) <> ROUND(COALESCE(mv.bonos_vigentes, 0)::numeric, 2)
   OR ROUND(COALESCE(dp.total_deducciones, 0)::numeric, 2) <> ROUND(COALESCE(mv.deducciones_vigentes, 0)::numeric, 2)
ORDER BY dp.id_planilla DESC, dp.id_detalle_planilla;

-- 8) Neto inconsistente.
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

-- 9) Planillas no cerradas aunque exista auditoria de cierre.
SELECT
  p.id_planilla,
  p.id_sucursal,
  p.periodo,
  p.tipo_periodo,
  p.quincena,
  ep.descripcion AS estado_actual
FROM public.planillas p
JOIN public.estado_planilla ep
  ON ep.id_estado_planilla = p.id_estado_planilla
WHERE UPPER(COALESCE(ep.descripcion, '')) <> 'CERRADA'
  AND EXISTS (
    SELECT 1
    FROM public.auditoria_planilla a
    WHERE (
      a.id_referencia = p.id_planilla
      OR COALESCE(a.descripcion, '') ILIKE '%' || p.id_planilla::text || '%'
    )
      AND UPPER(COALESCE(a.descripcion, '') || ' ' || COALESCE(a.accion, '')) LIKE '%CERRAD%'
  )
ORDER BY p.id_planilla DESC;
