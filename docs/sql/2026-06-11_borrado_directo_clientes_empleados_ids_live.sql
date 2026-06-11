-- Borrado directo de clientes y empleados por IDs reales de la base viva
-- Fecha: 2026-06-11
-- Objetivo:
--   - Clientes: 116, 117
--   - Empleados: 27, 28, 29
--   - Personas asociadas confirmadas en la base viva: 111, 112, 113, 114, 115
--
-- Importante:
--   1) Este script NO usa modo preview.
--   2) Ejecuta en una transaccion.
--   3) Preserva historial de ventas dejando id_cliente = NULL si existen referencias.

BEGIN;

DO $$
DECLARE
  v_rows INTEGER := 0;
  v_fk RECORD;
  v_fallback_user_id INTEGER := NULL;
  v_fallback_employee_id INTEGER := NULL;
BEGIN
  CREATE TEMP TABLE tmp_target_clientes (id_cliente INTEGER PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO tmp_target_clientes (id_cliente) VALUES (116), (117);

  CREATE TEMP TABLE tmp_target_empleados (id_empleado INTEGER PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO tmp_target_empleados (id_empleado) VALUES (27), (28), (29);

  CREATE TEMP TABLE tmp_target_personas (id_persona INTEGER PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO tmp_target_personas (id_persona) VALUES (111), (112), (113), (114), (115);

  CREATE TEMP TABLE tmp_target_usuarios (id_usuario INTEGER PRIMARY KEY) ON COMMIT DROP;

  IF to_regclass('public.usuarios') IS NOT NULL THEN
    INSERT INTO tmp_target_usuarios (id_usuario)
    SELECT DISTINCT u.id_usuario
    FROM public.usuarios u
    WHERE u.id_cliente IN (SELECT id_cliente FROM tmp_target_clientes)
       OR u.id_empleado IN (SELECT id_empleado FROM tmp_target_empleados)
    ON CONFLICT (id_usuario) DO NOTHING;
  END IF;

  IF to_regclass('public.usuarios_clientes') IS NOT NULL THEN
    INSERT INTO tmp_target_usuarios (id_usuario)
    SELECT DISTINCT uc.id_usuario
    FROM public.usuarios_clientes uc
    WHERE uc.id_cliente IN (SELECT id_cliente FROM tmp_target_clientes)
    ON CONFLICT (id_usuario) DO NOTHING;
  END IF;

  IF to_regclass('public.usuarios') IS NOT NULL THEN
    SELECT u.id_usuario, u.id_empleado
    INTO v_fallback_user_id, v_fallback_employee_id
    FROM public.usuarios u
    WHERE LOWER(COALESCE(u.nombre_usuario, '')) IN ('root', 'admin')
    ORDER BY CASE WHEN LOWER(COALESCE(u.nombre_usuario, '')) = 'root' THEN 0 ELSE 1 END, u.id_usuario
    LIMIT 1;
  END IF;

  RAISE NOTICE 'Fallback usuario=% empleado=%', v_fallback_user_id, v_fallback_employee_id;

  -- 1) Dependencias directas de usuarios
  IF to_regclass('public.verificacion_cuentas_tokens') IS NOT NULL THEN
    DELETE FROM public.verificacion_cuentas_tokens
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
  END IF;

  IF to_regclass('public.sesiones_activas') IS NOT NULL THEN
    DELETE FROM public.sesiones_activas
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
  END IF;

  IF to_regclass('public.roles_usuarios') IS NOT NULL THEN
    DELETE FROM public.roles_usuarios
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
  END IF;

  IF to_regclass('public.identidades_auth') IS NOT NULL THEN
    DELETE FROM public.identidades_auth
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
  END IF;

  IF to_regclass('public.usuarios_sucursales') IS NOT NULL THEN
    DELETE FROM public.usuarios_sucursales
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
  END IF;

  IF to_regclass('public.usuarios_clientes') IS NOT NULL THEN
    DELETE FROM public.usuarios_clientes
    WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes)
       OR id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
  END IF;

  IF to_regclass('public.usuarios_password_history') IS NOT NULL THEN
    DELETE FROM public.usuarios_password_history
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
  END IF;

  -- 2) Otras FK hacia usuarios
  IF to_regclass('public.usuarios') IS NOT NULL THEN
    FOR v_fk IN
      SELECT
        ns.nspname AS schema_name,
        cls.relname AS table_name,
        att.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.confrelid = 'public.usuarios'::regclass
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      IF v_fk.schema_name = 'public'
         AND v_fk.table_name IN (
           'verificacion_cuentas_tokens',
           'sesiones_activas',
           'roles_usuarios',
           'identidades_auth',
           'usuarios_sucursales',
           'usuarios_clientes',
           'usuarios_password_history',
           'usuarios'
         ) THEN
        CONTINUE;
      END IF;

      IF v_fallback_user_id IS NOT NULL THEN
        EXECUTE format(
          'UPDATE %I.%I SET %I = $1 WHERE %I IN (SELECT id_usuario FROM tmp_target_usuarios)',
          v_fk.schema_name, v_fk.table_name, v_fk.column_name, v_fk.column_name
        ) USING v_fallback_user_id;
      ELSE
        EXECUTE format(
          'DELETE FROM %I.%I WHERE %I IN (SELECT id_usuario FROM tmp_target_usuarios)',
          v_fk.schema_name, v_fk.table_name, v_fk.column_name
        );
      END IF;
    END LOOP;

    DELETE FROM public.usuarios
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'usuarios eliminados -> %', v_rows;
  END IF;

  -- 3) Dependencias directas de clientes
  IF to_regclass('public.clientes_sucursales') IS NOT NULL THEN
    DELETE FROM public.clientes_sucursales
    WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
  END IF;

  IF to_regclass('public.pedidos') IS NOT NULL THEN
    UPDATE public.pedidos
    SET id_cliente = NULL
    WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
  END IF;

  IF to_regclass('public.facturas') IS NOT NULL THEN
    UPDATE public.facturas
    SET id_cliente = NULL
    WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
  END IF;

  IF to_regclass('public.clientes') IS NOT NULL THEN
    FOR v_fk IN
      SELECT
        ns.nspname AS schema_name,
        cls.relname AS table_name,
        att.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.confrelid = 'public.clientes'::regclass
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      IF v_fk.schema_name = 'public'
         AND v_fk.table_name IN ('clientes_sucursales', 'usuarios_clientes', 'usuarios', 'pedidos', 'facturas', 'clientes') THEN
        CONTINUE;
      END IF;

      EXECUTE format(
        'DELETE FROM %I.%I WHERE %I IN (SELECT id_cliente FROM tmp_target_clientes)',
        v_fk.schema_name, v_fk.table_name, v_fk.column_name
      );
    END LOOP;

    DELETE FROM public.clientes
    WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'clientes eliminados -> %', v_rows;
  END IF;

  -- 4) Dependencias directas de empleados
  IF to_regclass('public.empleados_sucursales') IS NOT NULL THEN
    DELETE FROM public.empleados_sucursales
    WHERE id_empleado IN (SELECT id_empleado FROM tmp_target_empleados);
  END IF;

  IF to_regclass('public.empleados') IS NOT NULL THEN
    FOR v_fk IN
      SELECT
        ns.nspname AS schema_name,
        cls.relname AS table_name,
        att.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.confrelid = 'public.empleados'::regclass
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      IF v_fk.schema_name = 'public'
         AND v_fk.table_name IN ('usuarios', 'empleados_sucursales', 'empleados') THEN
        CONTINUE;
      END IF;

      IF v_fallback_employee_id IS NOT NULL THEN
        EXECUTE format(
          'UPDATE %I.%I SET %I = $1 WHERE %I IN (SELECT id_empleado FROM tmp_target_empleados)',
          v_fk.schema_name, v_fk.table_name, v_fk.column_name, v_fk.column_name
        ) USING v_fallback_employee_id;
      ELSE
        EXECUTE format(
          'DELETE FROM %I.%I WHERE %I IN (SELECT id_empleado FROM tmp_target_empleados)',
          v_fk.schema_name, v_fk.table_name, v_fk.column_name
        );
      END IF;
    END LOOP;

    DELETE FROM public.empleados
    WHERE id_empleado IN (SELECT id_empleado FROM tmp_target_empleados);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'empleados eliminados -> %', v_rows;
  END IF;

  -- 5) Limpiar y borrar personas huerfanas confirmadas
  IF to_regclass('public.personas') IS NOT NULL THEN
    DELETE FROM tmp_target_personas tp
    WHERE EXISTS (SELECT 1 FROM public.clientes c WHERE c.id_persona = tp.id_persona)
       OR EXISTS (SELECT 1 FROM public.empleados e WHERE e.id_persona = tp.id_persona);

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'id_correo'
    ) THEN
      UPDATE public.personas
      SET id_correo = NULL
      WHERE id_persona IN (SELECT id_persona FROM tmp_target_personas);
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'id_telefono'
    ) THEN
      UPDATE public.personas
      SET id_telefono = NULL
      WHERE id_persona IN (SELECT id_persona FROM tmp_target_personas);
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'id_direccion'
    ) THEN
      UPDATE public.personas
      SET id_direccion = NULL
      WHERE id_persona IN (SELECT id_persona FROM tmp_target_personas);
    END IF;

    IF to_regclass('public.correos') IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'correos' AND column_name = 'id_persona'
       ) THEN
      UPDATE public.correos
      SET id_persona = NULL
      WHERE id_persona IN (SELECT id_persona FROM tmp_target_personas);
    END IF;

    FOR v_fk IN
      SELECT
        ns.nspname AS schema_name,
        cls.relname AS table_name,
        att.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.confrelid = 'public.personas'::regclass
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      IF v_fk.schema_name = 'public'
         AND v_fk.table_name IN ('empleados', 'clientes', 'personas', 'correos', 'telefonos', 'direcciones') THEN
        CONTINUE;
      END IF;

      EXECUTE format(
        'DELETE FROM %I.%I WHERE %I IN (SELECT id_persona FROM tmp_target_personas)',
        v_fk.schema_name, v_fk.table_name, v_fk.column_name
      );
    END LOOP;

    DELETE FROM public.personas
    WHERE id_persona IN (SELECT id_persona FROM tmp_target_personas);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'personas eliminadas -> %', v_rows;
  END IF;
END $$;

COMMIT;

-- Verificacion posterior
-- SELECT 'clientes' AS tipo, id_cliente AS id, id_persona FROM public.clientes WHERE id_cliente IN (116,117)
-- UNION ALL
-- SELECT 'empleados' AS tipo, id_empleado AS id, id_persona FROM public.empleados WHERE id_empleado IN (27,28,29)
-- UNION ALL
-- SELECT 'personas' AS tipo, id_persona AS id, NULL::INTEGER AS id_persona FROM public.personas WHERE id_persona IN (111,112,113,114,115);
