-- Planillas: formalizacion segura de periodo/quincena
-- Fecha: 2026-06-03
-- Objetivo: agregar soporte persistente mensual/quincenal sin romper datos legacy.

BEGIN;

-- 1) Columnas nuevas en planillas.
ALTER TABLE IF EXISTS public.planillas
  ADD COLUMN IF NOT EXISTS tipo_periodo VARCHAR(20) DEFAULT 'mensual';

ALTER TABLE IF EXISTS public.planillas
  ADD COLUMN IF NOT EXISTS quincena INTEGER NULL;

ALTER TABLE IF EXISTS public.planillas
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE NULL;

ALTER TABLE IF EXISTS public.planillas
  ADD COLUMN IF NOT EXISTS fecha_fin DATE NULL;

ALTER TABLE IF EXISTS public.planillas
  ADD COLUMN IF NOT EXISTS periodo VARCHAR(7) NULL;

ALTER TABLE IF EXISTS public.planillas
  ADD COLUMN IF NOT EXISTS observacion TEXT NULL;

-- 2) Columnas nuevas en movimiento_planilla.
ALTER TABLE IF EXISTS public.movimiento_planilla
  ADD COLUMN IF NOT EXISTS tipo_periodo VARCHAR(20) NULL;

ALTER TABLE IF EXISTS public.movimiento_planilla
  ADD COLUMN IF NOT EXISTS quincena INTEGER NULL;

ALTER TABLE IF EXISTS public.movimiento_planilla
  ADD COLUMN IF NOT EXISTS fecha_aplicacion DATE NULL;

-- 3) Columnas nuevas en adelanto_aplicacion.
ALTER TABLE IF EXISTS public.adelanto_aplicacion
  ADD COLUMN IF NOT EXISTS tipo_periodo VARCHAR(20) NULL;

ALTER TABLE IF EXISTS public.adelanto_aplicacion
  ADD COLUMN IF NOT EXISTS quincena INTEGER NULL;

-- 4) Backfill seguro legacy: todo lo viejo se interpreta como mensual.
UPDATE public.planillas
SET tipo_periodo = COALESCE(NULLIF(TRIM(tipo_periodo), ''), 'mensual')
WHERE tipo_periodo IS NULL OR NULLIF(TRIM(tipo_periodo), '') IS NULL;

UPDATE public.planillas
SET periodo = COALESCE(periodo, to_char(fecha_creacion, 'YYYY-MM'))
WHERE periodo IS NULL OR NULLIF(TRIM(periodo), '') IS NULL;

UPDATE public.planillas
SET fecha_inicio = COALESCE(fecha_inicio, date_trunc('month', fecha_creacion)::date)
WHERE fecha_inicio IS NULL;

UPDATE public.planillas
SET fecha_fin = COALESCE(
  fecha_fin,
  (date_trunc('month', fecha_creacion) + interval '1 month - 1 day')::date
)
WHERE fecha_fin IS NULL;

UPDATE public.planillas
SET quincena = NULL
WHERE UPPER(COALESCE(tipo_periodo, 'MENSUAL')) = 'MENSUAL';

UPDATE public.movimiento_planilla mp
SET tipo_periodo = COALESCE(NULLIF(TRIM(tipo_periodo), ''), COALESCE(p.tipo_periodo, 'mensual')),
    quincena = COALESCE(mp.quincena, p.quincena),
    fecha_aplicacion = COALESCE(mp.fecha_aplicacion, mp.fecha_registro::date, p.fecha_inicio)
FROM public.detalle_planilla dp
JOIN public.planillas p ON p.id_planilla = dp.id_planilla
WHERE dp.id_detalle_planilla = mp.id_detalle_planilla
  AND (
    mp.tipo_periodo IS NULL
    OR NULLIF(TRIM(mp.tipo_periodo), '') IS NULL
    OR mp.quincena IS NULL
    OR mp.fecha_aplicacion IS NULL
  );

UPDATE public.adelanto_aplicacion aa
SET tipo_periodo = COALESCE(NULLIF(TRIM(aa.tipo_periodo), ''), COALESCE(p.tipo_periodo, 'mensual')),
    quincena = COALESCE(aa.quincena, p.quincena)
FROM public.planillas p
WHERE p.id_planilla = aa.id_planilla
  AND (
    aa.tipo_periodo IS NULL
    OR NULLIF(TRIM(aa.tipo_periodo), '') IS NULL
    OR aa.quincena IS NULL
  );

-- 5) Indices de consulta seguros.
CREATE INDEX IF NOT EXISTS idx_planillas_periodo_scope
  ON public.planillas (id_sucursal, periodo, tipo_periodo, quincena);

CREATE INDEX IF NOT EXISTS idx_movimiento_planilla_periodo_scope
  ON public.movimiento_planilla (tipo_periodo, quincena, fecha_aplicacion);

CREATE INDEX IF NOT EXISTS idx_adelanto_aplicacion_periodo_scope
  ON public.adelanto_aplicacion (id_planilla, tipo_periodo, quincena);

-- 6) Intento seguro de unicidad solo si no hay duplicados detectados.
DO $$
DECLARE
  dup_mensual INTEGER;
  dup_quincenal INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_mensual
  FROM (
    SELECT id_sucursal, periodo
    FROM public.planillas
    WHERE UPPER(COALESCE(tipo_periodo, 'MENSUAL')) = 'MENSUAL'
      AND quincena IS NULL
    GROUP BY id_sucursal, periodo
    HAVING COUNT(*) > 1
  ) t;

  SELECT COUNT(*) INTO dup_quincenal
  FROM (
    SELECT id_sucursal, periodo, quincena
    FROM public.planillas
    WHERE UPPER(COALESCE(tipo_periodo, 'MENSUAL')) = 'QUINCENAL'
      AND quincena IN (1, 2)
    GROUP BY id_sucursal, periodo, quincena
    HAVING COUNT(*) > 1
  ) t;

  IF dup_mensual = 0 THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_planillas_scope_mensual ON public.planillas (id_sucursal, periodo) WHERE UPPER(COALESCE(tipo_periodo, ''MENSUAL'')) = ''MENSUAL'' AND quincena IS NULL';
  ELSE
    RAISE NOTICE 'No se creo ux_planillas_scope_mensual porque existen duplicados legacy.';
  END IF;

  IF dup_quincenal = 0 THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_planillas_scope_quincenal ON public.planillas (id_sucursal, periodo, quincena) WHERE UPPER(COALESCE(tipo_periodo, ''MENSUAL'')) = ''QUINCENAL'' AND quincena IN (1,2)';
  ELSE
    RAISE NOTICE 'No se creo ux_planillas_scope_quincenal porque existen duplicados legacy.';
  END IF;
END $$;

COMMIT;

-- 7) Validaciones post-ejecucion.
SELECT id_planilla, id_sucursal, tipo_periodo, quincena, periodo, fecha_inicio, fecha_fin
FROM public.planillas
ORDER BY id_planilla DESC
LIMIT 30;

SELECT id_movimiento_planilla, tipo_periodo, quincena, fecha_aplicacion
FROM public.movimiento_planilla
ORDER BY id_movimiento_planilla DESC
LIMIT 30;

SELECT id_adelanto_aplicacion, id_planilla, tipo_periodo, quincena
FROM public.adelanto_aplicacion
ORDER BY id_adelanto_aplicacion DESC
LIMIT 30;

-- Rollback manual no destructivo sugerido:
-- 1) Dejar de usar las columnas nuevas desde la aplicacion.
-- 2) No borrar columnas en caliente.
-- 3) Si es necesario revertir comportamiento, mantener columnas y limpiar solo valores nuevos con UPDATE controlado.
