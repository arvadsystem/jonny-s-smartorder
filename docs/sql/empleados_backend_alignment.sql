-- Empleados backend/SQL alignment patch
-- Scope:
-- 1) Keep empleados_actualizar(p_id_empleado, p_datos JSON) as the main update contract.
-- 2) Allow explicit clear for cargo/nombre_referencia/telefono_referencia when key is present with '' or null.
-- 3) Expose direccion in empleados_listar() alongside telefono/correo.

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
  v_cargo TEXT;
  v_nombre_ref TEXT;
  v_tel_ref TEXT;
BEGIN
  SELECT * INTO cur
  FROM empleados
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

  -- Explicit text-field semantics:
  -- - key absent  -> keep current value
  -- - key present with null/empty/blank -> set NULL
  -- - key present with non-empty text   -> update value
  IF (p_datos::jsonb ? 'cargo') THEN
    v_cargo := NULLIF(TRIM(COALESCE(p_datos->>'cargo', '')), '');
  ELSE
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

  UPDATE empleados SET
    fecha_ingreso = v_fecha_ingreso,
    salario_base = v_salario,
    estado = v_estado,
    id_sucursal = v_id_sucursal,
    id_persona = v_id_persona,
    cargo = v_cargo,
    nombre_referencia = v_nombre_ref,
    telefono_referencia = v_tel_ref
  WHERE id_empleado = p_id_empleado;
END;
$$;


CREATE OR REPLACE FUNCTION public.empleados_listar()
RETURNS TABLE (
  id_empleado INTEGER,
  fecha_ingreso TIMESTAMP,
  salario_base NUMERIC,
  estado BOOLEAN,
  id_sucursal INTEGER,
  id_persona INTEGER,
  cargo VARCHAR,
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
    e.cargo,
    e.nombre_referencia,
    e.telefono_referencia,
    p.nombre,
    p.apellido,
    TRIM(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellido, '')) AS nombre_completo,
    p.dni,
    p.genero,
    t.telefono,
    c.direccion_correo AS correo,
    d.direccion,
    s.nombre_sucursal AS sucursal
  FROM empleados e
  INNER JOIN personas p ON e.id_persona = p.id_persona
  LEFT JOIN telefonos t ON p.id_telefono = t.id_telefono
  LEFT JOIN correos c ON p.id_correo = c.id_correo
  LEFT JOIN direcciones d ON p.id_direccion = d.id_direccion
  LEFT JOIN sucursales s ON e.id_sucursal = s.id_sucursal
  ORDER BY e.id_empleado DESC;
END;
$$;
