-- Catalogo de cargos para empleados + migracion desde texto
-- Fecha: 2026-05-31
-- Objetivo:
-- 1) Crear tabla catalogo public.cargos_empleados
-- 2) Agregar empleados.id_cargo y relacionarlo por FK
-- 3) Migrar datos existentes desde empleados.cargo (texto) a empleados.id_cargo
-- 4) Mantener compatibilidad temporal con columna empleados.cargo

BEGIN;

-- ==========================================================
-- 1) TABLA CATALOGO DE CARGOS
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.cargos_empleados (
  id_cargo BIGSERIAL PRIMARY KEY,
  nombre_cargo VARCHAR(120) NOT NULL,
  descripcion VARCHAR(255),
  estado BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Evita duplicados por diferencias de mayusculas/espacios.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cargos_empleados_nombre_norm
  ON public.cargos_empleados ((LOWER(TRIM(nombre_cargo))));

-- ==========================================================
-- 2) AJUSTE TABLA EMPLEADOS
-- ==========================================================
ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS id_cargo BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_empleados_id_cargo'
  ) THEN
    ALTER TABLE public.empleados
      ADD CONSTRAINT fk_empleados_id_cargo
      FOREIGN KEY (id_cargo)
      REFERENCES public.cargos_empleados(id_cargo)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Index para consultas por cargo.
CREATE INDEX IF NOT EXISTS ix_empleados_id_cargo
  ON public.empleados (id_cargo);

-- ==========================================================
-- 3) MIGRAR CARGOS EXISTENTES DESDE TEXTO
-- ==========================================================
INSERT INTO public.cargos_empleados (nombre_cargo)
SELECT DISTINCT TRIM(e.cargo) AS nombre_cargo
FROM public.empleados e
WHERE NULLIF(TRIM(e.cargo), '') IS NOT NULL
ON CONFLICT ((LOWER(TRIM(nombre_cargo)))) DO NOTHING;

UPDATE public.empleados e
SET id_cargo = c.id_cargo
FROM public.cargos_empleados c
WHERE e.id_cargo IS NULL
  AND NULLIF(TRIM(e.cargo), '') IS NOT NULL
  AND LOWER(TRIM(e.cargo)) = LOWER(TRIM(c.nombre_cargo));

-- ==========================================================
-- 4) FUNCION AUXILIAR PARA fecha_actualizacion
-- ==========================================================
CREATE OR REPLACE FUNCTION public.set_fecha_actualizacion_cargos_empleados()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fecha_actualizacion := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_set_fecha_actualizacion_cargos_empleados ON public.cargos_empleados;
CREATE TRIGGER tr_set_fecha_actualizacion_cargos_empleados
BEFORE UPDATE ON public.cargos_empleados
FOR EACH ROW
EXECUTE FUNCTION public.set_fecha_actualizacion_cargos_empleados();

COMMIT;

-- ==========================================================
-- CONSULTAS DE VERIFICACION
-- ==========================================================
-- 1) Catalogo generado
-- SELECT id_cargo, nombre_cargo, estado
-- FROM public.cargos_empleados
-- ORDER BY nombre_cargo;

-- 2) Empleados con mapeo id_cargo
-- SELECT
--   e.id_empleado,
--   e.cargo AS cargo_texto_legacy,
--   e.id_cargo,
--   c.nombre_cargo AS cargo_catalogo
-- FROM public.empleados e
-- LEFT JOIN public.cargos_empleados c ON c.id_cargo = e.id_cargo
-- ORDER BY e.id_empleado DESC;
