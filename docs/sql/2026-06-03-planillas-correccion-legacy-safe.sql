-- Planillas: correccion segura de contexto legacy y netos inconsistentes
-- Fecha: 2026-06-03
-- Objetivo:
-- 1) completar tipo_periodo/quincena/fecha_aplicacion en movimientos legacy
-- 2) corregir neto_pagar cuando no coincide con salario_base + bonos - deducciones
-- Regla: no borra datos, solo completa o corrige campos inconsistentes.

BEGIN;

-- 1) Completar contexto de movimientos legacy.
-- Prioridad:
--   a) si la observacion trae [QCTX:Q1] o [QCTX:Q2], usar quincena formal
--   b) si no, heredar el contexto de la planilla
--   c) fecha_aplicacion:
--      - Q1 => inicio del periodo
--      - Q2 => dia 16 del periodo
--      - mensual => fecha_registro o fecha_inicio de la planilla
UPDATE public.movimiento_planilla mp
SET tipo_periodo = CASE
      WHEN COALESCE(mp.observacion, '') ILIKE '%[QCTX:Q1]%' THEN 'quincenal'
      WHEN COALESCE(mp.observacion, '') ILIKE '%[QCTX:Q2]%' THEN 'quincenal'
      ELSE COALESCE(NULLIF(TRIM(mp.tipo_periodo), ''), COALESCE(p.tipo_periodo, 'mensual'))
    END,
    quincena = CASE
      WHEN COALESCE(mp.observacion, '') ILIKE '%[QCTX:Q1]%' THEN 1
      WHEN COALESCE(mp.observacion, '') ILIKE '%[QCTX:Q2]%' THEN 2
      WHEN UPPER(COALESCE(p.tipo_periodo, 'MENSUAL')) = 'QUINCENAL' THEN p.quincena
      ELSE NULL
    END,
    fecha_aplicacion = COALESCE(
      mp.fecha_aplicacion,
      CASE
        WHEN COALESCE(mp.observacion, '') ILIKE '%[QCTX:Q1]%' THEN COALESCE(p.fecha_inicio, date_trunc('month', p.fecha_creacion)::date)
        WHEN COALESCE(mp.observacion, '') ILIKE '%[QCTX:Q2]%' THEN COALESCE((date_trunc('month', p.fecha_creacion)::date + 15), p.fecha_inicio, mp.fecha_registro::date)
        ELSE COALESCE(mp.fecha_registro::date, p.fecha_inicio)
      END
    )
FROM public.detalle_planilla dp
JOIN public.planillas p
  ON p.id_planilla = dp.id_planilla
WHERE dp.id_detalle_planilla = mp.id_detalle_planilla
  AND (
    mp.tipo_periodo IS NULL
    OR NULLIF(TRIM(mp.tipo_periodo), '') IS NULL
    OR mp.fecha_aplicacion IS NULL
    OR (
      COALESCE(mp.observacion, '') ILIKE '%[QCTX:Q1]%'
      AND (
        UPPER(COALESCE(mp.tipo_periodo, '')) <> 'QUINCENAL'
        OR mp.quincena IS DISTINCT FROM 1
      )
    )
    OR (
      COALESCE(mp.observacion, '') ILIKE '%[QCTX:Q2]%'
      AND (
        UPPER(COALESCE(mp.tipo_periodo, '')) <> 'QUINCENAL'
        OR mp.quincena IS DISTINCT FROM 2
      )
    )
  );

-- 2) Corregir netos inconsistentes en detalle_planilla.
UPDATE public.detalle_planilla dp
SET neto_pagar = ROUND(
  COALESCE(dp.salario_base, 0)
  + COALESCE(dp.total_bonos, 0)
  - COALESCE(dp.total_deducciones, 0),
  2
)
WHERE ROUND(
  COALESCE(dp.salario_base, 0)
  + COALESCE(dp.total_bonos, 0)
  - COALESCE(dp.total_deducciones, 0),
  2
) IS DISTINCT FROM ROUND(COALESCE(dp.neto_pagar, 0), 2);

COMMIT;

-- Validaciones post-ejecucion.
SELECT
  COUNT(*) AS movimientos_sin_contexto
FROM public.movimiento_planilla
WHERE tipo_periodo IS NULL
   OR NULLIF(TRIM(tipo_periodo), '') IS NULL
   OR fecha_aplicacion IS NULL
   OR (UPPER(tipo_periodo) = 'QUINCENAL' AND quincena IS NULL);

SELECT
  COUNT(*) AS detalles_neto_inconsistente
FROM public.detalle_planilla
WHERE ROUND(
  COALESCE(salario_base, 0)
  + COALESCE(total_bonos, 0)
  - COALESCE(total_deducciones, 0),
  2
) IS DISTINCT FROM ROUND(COALESCE(neto_pagar, 0), 2);
