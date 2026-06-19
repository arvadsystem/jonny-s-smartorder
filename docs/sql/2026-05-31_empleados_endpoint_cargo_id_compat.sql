-- Empleados endpoint compatibility patch (id_cargo + cargo texto)
-- Fecha: 2026-05-31
-- Objetivo:
-- 1) Permitir que el backend siga enviando cargo texto y/o id_cargo.
-- 2) Resolver automaticamente id_cargo desde texto cuando aplique.
-- 3) Mantener columna legacy empleados.cargo sincronizada con el catalogo.
-- 4) Exponer id_cargo/nombre_cargo en empleados_listar().

BEGIN;

-- ==========================================================
-- 1) UPSERT DE CARGO DESDE TEXTO
-- ==========================================================
CREATE OR REPLACE FUNCTION public.cargos_empleados_upsert_desde_texto(
  p_nombre_cargo TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_nombre TEXT;
  v_id_cargo BIGINT;
BEGIN
  v_nombre := NULLIF(TRIM(COALESCE(p_nombre_cargo, '')), '');
  IF v_nombre IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.cargos_empleados (nombre_cargo, estado)
  VALUES (v_nombre, true)
  ON CONFLICT ((LOWER(TRIM(nombre_cargo))))
  DO UPDATE
     SET estado = true,
         fecha_actualizacion = NOW()
  RETURNING id_cargo INTO v_id_cargo;

  RETURN v_id_cargo;
END;
$$;

-- ==========================================================
-- 2) TRIGGER PARA SINCRONIZAR empleados.id_cargo <-> empleados.cargo
-- ==========================================================
CREATE OR REPLACE FUNCTION public.empleados_sync_cargo_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_nombre_cargo TEXT;
BEGIN
  -- Prioridad 1: si llega id_cargo, forzar texto canonico desde catalogo.
  IF NEW.id_cargo IS NOT NULL THEN
    SELECT c.nombre_cargo
      INTO v_nombre_cargo
    FROM public.cargos_empleados c
    WHERE c.id_cargo = NEW.id_cargo;

    IF v_nombre_cargo IS NULL THEN
      RAISE EXCEPTION 'id_cargo % no existe en cargos_empleados', NEW.id_cargo;
    END IF;

    NEW.cargo := v_nombre_cargo;
    RETURN NEW;
  END IF;

  -- Prioridad 2: si llega texto y no llega id_cargo, crear/usar catalogo.
  IF NULLIF(TRIM(COALESCE(NEW.cargo, '')), '') IS NOT NULL THEN
    NEW.id_cargo := public.cargos_empleados_upsert_desde_texto(NEW.cargo);
    SELECT c.nombre_cargo
      INTO v_nombre_cargo
    FROM public.cargos_empleados c
    WHERE c.id_cargo = NEW.id_cargo;
    NEW.cargo := v_nombre_cargo;
    RETURN NEW;
  END IF;

  -- Si no llega ninguno, ambos quedan nulos.
  NEW.id_cargo := NULL;
  NEW.cargo := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_empleados_sync_cargo_fields ON public.empleados;
CREATE TRIGGER tr_empleados_sync_cargo_fields
BEFORE INSERT OR UPDATE OF id_cargo, cargo ON public.empleados
FOR EACH ROW
EXECUTE FUNCTION public.empleados_sync_cargo_fields();

-- ==========================================================
-- 3) PATCH FUNCION empleados_actualizar (compatibilidad dual)
-- ==========================================================
CREATE OR REPLACE FUNCTION public.empleados_actualizar(
  p_id_empleado INTEGER,
  p_datos JSON
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  cur RECORD;

  v_fecha_ingreso TIMESTAMP;
  v_salario NUMERIC;
  v_estado BOOLEAN;
  v_id_sucursal INTEGER;
  v_id_persona INTEGER;
  v_id_cargo BIGINT;
  v_cargo TEXT;
  v_nombre_ref TEXT;
  v_tel_ref TEXT;
BEGIN
  SELECT * INTO cur
  FROM public.empleados
  WHERE id_empleado = p_id_empleado;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado % no existe', p_id_empleado;
  END IF;

  v_fecha_ingreso := COALESCE(
    NULLIF(TRIM(p_datos->>'fecha_ingreso'), '')::timestamp,
    cur.fecha_ingreso
  );

  v_salario := COALESCE(
    NULLIF(TRIM(p_datos->>'salario_base'), '')::numeric,
    cur.salario_base
  );

  v_estado := COALESCE(
    NULLIF(TRIM(p_datos->>'estado'), '')::boolean,
    cur.estado
  );

  v_id_sucursal := COALESCE(
    NULLIF(TRIM(p_datos->>'id_sucursal'), '')::integer,
    cur.id_sucursal
  );

  v_id_persona := COALESCE(
    NULLIF(TRIM(p_datos->>'id_persona'), '')::integer,
    cur.id_persona
  );

  -- Reglas cargo:
  -- - id_cargo presente -> se usa ese id (si viene vacio/null explicito => NULL)
  -- - si no viene id_cargo pero viene cargo texto -> upsert y asigna id
  -- - si no viene ninguno -> conserva actual
  IF (p_datos::jsonb ? 'id_cargo') THEN
    v_id_cargo := NULLIF(TRIM(COALESCE(p_datos->>'id_cargo', '')), '')::bigint;
    v_cargo := NULL;
  ELSIF (p_datos::jsonb ? 'cargo') THEN
    v_cargo := NULLIF(TRIM(COALESCE(p_datos->>'cargo', '')), '');
    v_id_cargo := public.cargos_empleados_upsert_desde_texto(v_cargo);
  ELSE
    v_id_cargo := cur.id_cargo;
    v_cargo := cur.cargo;
  END IF;

  IF (p_datos::jsonb ? 'nombre_referencia') THEN
    v_nombre_ref := NULLIF(TRIM(COALESCE(p_datos->>'nombre_referencia', '')), '');
  ELSE
    v_nombre_ref := cur.nombre_referencia;
  END IF;

  IF (p_datos::jsonb ? 'telefono_referencia') THEN
    v_tel_ref := NULLIF(TRIM(COALESCE(p_datos->>'telefono_referencia', '')), '');
  ELSE
    v_tel_ref := cur.telefono_referencia;
  END IF;

  UPDATE public.empleados SET
    fecha_ingreso = v_fecha_ingreso,
    salario_base = v_salario,
    estado = v_estado,
    id_sucursal = v_id_sucursal,
    id_persona = v_id_persona,
    id_cargo = v_id_cargo,
    cargo = v_cargo,
    nombre_referencia = v_nombre_ref,
    telefono_referencia = v_tel_ref
  WHERE id_empleado = p_id_empleado;
END;
$$;

-- ==========================================================
-- 4) PATCH empleados_listar para exponer id_cargo y nombre_cargo
-- ==========================================================
CREATE OR REPLACE FUNCTION public.empleados_listar()
RETURNS TABLE (
  id_empleado INTEGER,
  fecha_ingreso TIMESTAMP,
  salario_base NUMERIC,
  estado BOOLEAN,
  id_sucursal INTEGER,
  id_persona INTEGER,
  id_cargo BIGINT,
  cargo VARCHAR,
  nombre_cargo VARCHAR,
  nombre_referencia VARCHAR,
  telefono_referencia VARCHAR,
  nombre VARCHAR,
  apellido VARCHAR,
  nombre_completo TEXT,
  dni VARCHAR,
  genero CHAR,
  telefono VARCHAR,
  correo VARCHAR,
  direccion VARCHAR,
  sucursal VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id_empleado,
    e.fecha_ingreso,
    e.salario_base,
    e.estado,
    e.id_sucursal,
    e.id_persona,
    e.id_cargo,
    COALESCE(c.nombre_cargo, e.cargo)::varchar AS cargo,
    c.nombre_cargo::varchar AS nombre_cargo,
    e.nombre_referencia,
    e.telefono_referencia,
    p.nombre,
    p.apellido,
    TRIM(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellido, '')) AS nombre_completo,
    p.dni,
    p.genero,
    t.telefono,
    cc.direccion_correo AS correo,
    d.direccion,
    s.nombre_sucursal AS sucursal
  FROM public.empleados e
  INNER JOIN public.personas p ON e.id_persona = p.id_persona
  LEFT JOIN public.cargos_empleados c ON c.id_cargo = e.id_cargo
  LEFT JOIN public.telefonos t ON p.id_telefono = t.id_telefono
  LEFT JOIN public.correos cc ON p.id_correo = cc.id_correo
  LEFT JOIN public.direcciones d ON p.id_direccion = d.id_direccion
  LEFT JOIN public.sucursales s ON e.id_sucursal = s.id_sucursal
  ORDER BY e.id_empleado DESC;
END;
$$;

COMMIT;

-- ==========================================================
-- VERIFICACION RAPIDA
-- ==========================================================
-- SELECT id_cargo, nombre_cargo, estado FROM public.cargos_empleados ORDER BY nombre_cargo;
-- SELECT id_empleado, cargo, id_cargo FROM public.empleados ORDER BY id_empleado DESC LIMIT 20;
-- SELECT * FROM public.empleados_listar() LIMIT 20;
