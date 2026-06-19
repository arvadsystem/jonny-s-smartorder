-- Borrado selectivo seguro de clientes y empleados puntuales
-- Fecha: 2026-06-11
-- Objetivo:
--   1) eliminar solo los clientes CLI-116 y CLI-117,
--   2) eliminar solo los empleados EMP-27, EMP-28 y EMP-29,
--   3) limpiar usuarios/dependencias relacionados sin romper integridad,
--   4) preservar historial sensible cuando se configure asi.
--
-- Modo de uso:
--   1) Ejecuta primero con v_execute := false.
--   2) Revisa los NOTICE y valida los nombres reales resueltos.
--   3) Cambia v_execute := true para borrar definitivamente.

BEGIN;

DO $$
DECLARE
  v_execute BOOLEAN := false;
  v_preserve_sales_history BOOLEAN := true;
  v_preserve_user_history BOOLEAN := true;
  v_preserve_employee_history BOOLEAN := true;
  v_delete_auth_users BOOLEAN := true;
  v_delete_orphan_personas BOOLEAN := true;

  v_rows INTEGER := 0;
  v_clientes_count INTEGER := 0;
  v_empleados_count INTEGER := 0;
  v_usuarios_count INTEGER := 0;
  v_personas_count INTEGER := 0;
  v_missing_clientes INTEGER := 0;
  v_missing_empleados INTEGER := 0;

  v_fallback_user_id INTEGER := NULL;
  v_fallback_employee_id INTEGER := NULL;
  v_has_cliente_empresa_rel BOOLEAN := false;
  v_fk RECORD;
  v_seq_name TEXT;
BEGIN
  IF to_regclass('public.clientes') IS NULL AND to_regclass('public.empleados') IS NULL THEN
    RAISE NOTICE 'No existen public.clientes ni public.empleados. Se cancela el script.';
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_input_clientes (
    id_cliente INTEGER PRIMARY KEY,
    nombre_esperado TEXT
  ) ON COMMIT DROP;

  INSERT INTO tmp_input_clientes (id_cliente, nombre_esperado)
  VALUES
    (116, 'Juan Perez'),
    (117, 'Jose Miguel Angel');

  CREATE TEMP TABLE tmp_input_empleados (
    id_empleado INTEGER PRIMARY KEY,
    nombre_esperado TEXT
  ) ON COMMIT DROP;

  INSERT INTO tmp_input_empleados (id_empleado, nombre_esperado)
  VALUES
    (27, 'Fernando Pineda'),
    (28, 'Bryan Eduardo Chirinos'),
    (29, 'Daniel Chirinos');

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'id_empresa_cliente'
  )
  INTO v_has_cliente_empresa_rel;

  IF v_has_cliente_empresa_rel THEN
    EXECUTE '
      CREATE TEMP TABLE tmp_target_clientes ON COMMIT DROP AS
      SELECT
        c.id_cliente,
        c.id_persona,
        c.id_empresa,
        c.id_empresa_cliente,
        COALESCE(
          NULLIF(TRIM(p.nombre || '' '' || p.apellido), ''''),
          ''Cliente #'' || c.id_cliente
        ) AS nombre_resuelto
      FROM public.clientes c
      LEFT JOIN public.personas p ON p.id_persona = c.id_persona
      WHERE c.id_cliente IN (SELECT id_cliente FROM tmp_input_clientes)
    ';
  ELSE
    EXECUTE '
      CREATE TEMP TABLE tmp_target_clientes ON COMMIT DROP AS
      SELECT
        c.id_cliente,
        c.id_persona,
        c.id_empresa,
        NULL::INTEGER AS id_empresa_cliente,
        COALESCE(
          NULLIF(TRIM(p.nombre || '' '' || p.apellido), ''''),
          ''Cliente #'' || c.id_cliente
        ) AS nombre_resuelto
      FROM public.clientes c
      LEFT JOIN public.personas p ON p.id_persona = c.id_persona
      WHERE c.id_cliente IN (SELECT id_cliente FROM tmp_input_clientes)
    ';
  END IF;

  CREATE TEMP TABLE tmp_target_empleados ON COMMIT DROP AS
  SELECT
    e.id_empleado,
    e.id_persona,
    e.id_sucursal,
    COALESCE(
      NULLIF(TRIM(p.nombre || ' ' || p.apellido), ''),
      'Empleado #' || e.id_empleado
    ) AS nombre_resuelto
  FROM public.empleados e
  LEFT JOIN public.personas p ON p.id_persona = e.id_persona
  WHERE e.id_empleado IN (SELECT id_empleado FROM tmp_input_empleados);

  SELECT COUNT(*) INTO v_missing_clientes
  FROM tmp_input_clientes ic
  WHERE NOT EXISTS (
    SELECT 1
    FROM tmp_target_clientes tc
    WHERE tc.id_cliente = ic.id_cliente
  );

  SELECT COUNT(*) INTO v_missing_empleados
  FROM tmp_input_empleados ie
  WHERE NOT EXISTS (
    SELECT 1
    FROM tmp_target_empleados te
    WHERE te.id_empleado = ie.id_empleado
  );

  CREATE TEMP TABLE tmp_target_personas (
    id_persona INTEGER PRIMARY KEY
  ) ON COMMIT DROP;

  INSERT INTO tmp_target_personas (id_persona)
  SELECT DISTINCT id_persona
  FROM (
    SELECT id_persona FROM tmp_target_clientes
    UNION ALL
    SELECT id_persona FROM tmp_target_empleados
  ) x
  WHERE id_persona IS NOT NULL
  ON CONFLICT (id_persona) DO NOTHING;

  CREATE TEMP TABLE tmp_target_users (
    id_usuario INTEGER PRIMARY KEY
  ) ON COMMIT DROP;

  IF to_regclass('public.usuarios') IS NOT NULL THEN
    INSERT INTO tmp_target_users (id_usuario)
    SELECT DISTINCT u.id_usuario
    FROM public.usuarios u
    WHERE u.id_empleado IN (SELECT id_empleado FROM tmp_target_empleados)
       OR u.id_cliente IN (SELECT id_cliente FROM tmp_target_clientes)
    ON CONFLICT (id_usuario) DO NOTHING;
  END IF;

  IF to_regclass('public.usuarios_clientes') IS NOT NULL THEN
    INSERT INTO tmp_target_users (id_usuario)
    SELECT DISTINCT uc.id_usuario
    FROM public.usuarios_clientes uc
    WHERE uc.id_cliente IN (SELECT id_cliente FROM tmp_target_clientes)
    ON CONFLICT (id_usuario) DO NOTHING;
  END IF;

  SELECT COUNT(*) INTO v_clientes_count FROM tmp_target_clientes;
  SELECT COUNT(*) INTO v_empleados_count FROM tmp_target_empleados;
  SELECT COUNT(*) INTO v_usuarios_count FROM tmp_target_users;
  SELECT COUNT(*) INTO v_personas_count FROM tmp_target_personas;

  RAISE NOTICE 'Clientes objetivo resueltos -> %', v_clientes_count;
  RAISE NOTICE 'Empleados objetivo resueltos -> %', v_empleados_count;
  RAISE NOTICE 'Usuarios vinculados -> %', v_usuarios_count;
  RAISE NOTICE 'Personas candidatas -> %', v_personas_count;
  RAISE NOTICE 'Clientes faltantes -> %', v_missing_clientes;
  RAISE NOTICE 'Empleados faltantes -> %', v_missing_empleados;

  RAISE NOTICE 'Detalle clientes:';
  FOR v_fk IN
    SELECT tc.id_cliente AS id_ref, tc.nombre_resuelto AS nombre_ref
    FROM tmp_target_clientes tc
    ORDER BY tc.id_cliente
  LOOP
    RAISE NOTICE '  CLI-% -> %', v_fk.id_ref, v_fk.nombre_ref;
  END LOOP;

  RAISE NOTICE 'Detalle empleados:';
  FOR v_fk IN
    SELECT te.id_empleado AS id_ref, te.nombre_resuelto AS nombre_ref
    FROM tmp_target_empleados te
    ORDER BY te.id_empleado
  LOOP
    RAISE NOTICE '  EMP-% -> %', v_fk.id_ref, v_fk.nombre_ref;
  END LOOP;

  IF v_clientes_count = 0 AND v_empleados_count = 0 THEN
    RAISE NOTICE 'No se resolvio ningun registro objetivo.';
    RETURN;
  END IF;

  IF to_regclass('public.pedidos') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_rows
    FROM public.pedidos
    WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
    RAISE NOTICE 'Diagnostico pedidos ligados a clientes -> % filas', v_rows;
  END IF;

  IF to_regclass('public.facturas') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_rows
    FROM public.facturas
    WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
    RAISE NOTICE 'Diagnostico facturas ligadas a clientes -> % filas', v_rows;
  END IF;

  IF to_regclass('public.usuarios') IS NOT NULL THEN
    SELECT u.id_usuario, u.id_empleado
    INTO v_fallback_user_id, v_fallback_employee_id
    FROM public.usuarios u
    WHERE LOWER(COALESCE(u.nombre_usuario, '')) IN ('root', 'admin')
    ORDER BY CASE WHEN LOWER(COALESCE(u.nombre_usuario, '')) = 'root' THEN 0 ELSE 1 END, u.id_usuario
    LIMIT 1;
  END IF;

  RAISE NOTICE 'Usuario fallback -> id_usuario=% id_empleado=%', v_fallback_user_id, v_fallback_employee_id;

  IF NOT v_execute THEN
    RAISE NOTICE 'Vista previa completada. Para ejecutar, cambia v_execute := true.';
    RETURN;
  END IF;

  IF v_missing_clientes > 0 OR v_missing_empleados > 0 THEN
    RAISE EXCEPTION 'Hay objetivos faltantes. Revisa la vista previa antes de ejecutar.';
  END IF;

  -- 1) Dependencias directas de usuarios
  IF v_delete_auth_users AND to_regclass('public.verificacion_cuentas_tokens') IS NOT NULL THEN
    DELETE FROM public.verificacion_cuentas_tokens
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'verificacion_cuentas_tokens eliminados -> % filas', v_rows;
  END IF;

  IF v_delete_auth_users AND to_regclass('public.sesiones_activas') IS NOT NULL THEN
    DELETE FROM public.sesiones_activas
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'sesiones_activas eliminadas -> % filas', v_rows;
  END IF;

  IF v_delete_auth_users AND to_regclass('public.roles_usuarios') IS NOT NULL THEN
    DELETE FROM public.roles_usuarios
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'roles_usuarios eliminados -> % filas', v_rows;
  END IF;

  IF v_delete_auth_users AND to_regclass('public.identidades_auth') IS NOT NULL THEN
    DELETE FROM public.identidades_auth
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'identidades_auth eliminadas -> % filas', v_rows;
  END IF;

  IF to_regclass('public.usuarios_sucursales') IS NOT NULL THEN
    DELETE FROM public.usuarios_sucursales
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'usuarios_sucursales eliminados -> % filas', v_rows;
  END IF;

  IF to_regclass('public.usuarios_clientes') IS NOT NULL THEN
    DELETE FROM public.usuarios_clientes
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_users)
       OR id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'usuarios_clientes eliminados -> % filas', v_rows;
  END IF;

  IF to_regclass('public.usuarios_password_history') IS NOT NULL THEN
    DELETE FROM public.usuarios_password_history
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'usuarios_password_history eliminados -> % filas', v_rows;
  END IF;

  -- 2) Otras FK -> usuarios
  IF to_regclass('public.usuarios') IS NOT NULL THEN
    FOR v_fk IN
      SELECT
        ns.nspname AS schema_name,
        cls.relname AS table_name,
        att.attname AS column_name
      FROM pg_constraint con
      INNER JOIN pg_class cls ON cls.oid = con.conrelid
      INNER JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      INNER JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = con.conkey[1]
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

      IF v_preserve_user_history AND v_fallback_user_id IS NOT NULL THEN
        EXECUTE format(
          'UPDATE %I.%I t
           SET %I = $1
           WHERE t.%I IN (SELECT id_usuario FROM tmp_target_users)',
          v_fk.schema_name,
          v_fk.table_name,
          v_fk.column_name,
          v_fk.column_name
        )
        USING v_fallback_user_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE NOTICE 'FK->usuarios reasignada en %.% -> % filas', v_fk.schema_name, v_fk.table_name, v_rows;
      ELSE
        EXECUTE format(
          'DELETE FROM %I.%I t
           WHERE t.%I IN (SELECT id_usuario FROM tmp_target_users)',
          v_fk.schema_name,
          v_fk.table_name,
          v_fk.column_name
        );
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE NOTICE 'FK->usuarios eliminada en %.% -> % filas', v_fk.schema_name, v_fk.table_name, v_rows;
      END IF;
    END LOOP;

    DELETE FROM public.usuarios
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'usuarios eliminados -> % filas', v_rows;
  END IF;

  -- 3) Dependencias directas de clientes
  IF to_regclass('public.clientes_sucursales') IS NOT NULL THEN
    DELETE FROM public.clientes_sucursales
    WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'clientes_sucursales eliminados -> % filas', v_rows;
  END IF;

  IF to_regclass('public.pedidos') IS NOT NULL THEN
    IF v_preserve_sales_history THEN
      UPDATE public.pedidos
      SET id_cliente = NULL
      WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'pedidos.id_cliente limpiado -> % filas', v_rows;
    END IF;
  END IF;

  IF to_regclass('public.facturas') IS NOT NULL THEN
    IF v_preserve_sales_history THEN
      UPDATE public.facturas
      SET id_cliente = NULL
      WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'facturas.id_cliente limpiado -> % filas', v_rows;
    END IF;
  END IF;

  -- 4) Otras FK -> clientes
  IF to_regclass('public.clientes') IS NOT NULL THEN
    FOR v_fk IN
      SELECT
        ns.nspname AS schema_name,
        cls.relname AS table_name,
        att.attname AS column_name
      FROM pg_constraint con
      INNER JOIN pg_class cls ON cls.oid = con.conrelid
      INNER JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      INNER JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.confrelid = 'public.clientes'::regclass
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      IF v_fk.schema_name = 'public'
         AND v_fk.table_name IN ('clientes_sucursales', 'usuarios_clientes', 'usuarios', 'pedidos', 'facturas', 'clientes') THEN
        CONTINUE;
      END IF;

      IF v_preserve_sales_history THEN
        EXECUTE format(
          'UPDATE %I.%I t
           SET %I = NULL
           WHERE t.%I IN (SELECT id_cliente FROM tmp_target_clientes)',
          v_fk.schema_name,
          v_fk.table_name,
          v_fk.column_name,
          v_fk.column_name
        );
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE NOTICE 'FK->clientes limpiada en %.% -> % filas', v_fk.schema_name, v_fk.table_name, v_rows;
      ELSE
        EXECUTE format(
          'DELETE FROM %I.%I t
           WHERE t.%I IN (SELECT id_cliente FROM tmp_target_clientes)',
          v_fk.schema_name,
          v_fk.table_name,
          v_fk.column_name
        );
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE NOTICE 'FK->clientes eliminada en %.% -> % filas', v_fk.schema_name, v_fk.table_name, v_rows;
      END IF;
    END LOOP;

    DELETE FROM public.clientes
    WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'clientes eliminados -> % filas', v_rows;
  END IF;

  -- 5) Dependencias directas de empleados
  IF to_regclass('public.empleados_sucursales') IS NOT NULL THEN
    DELETE FROM public.empleados_sucursales
    WHERE id_empleado IN (SELECT id_empleado FROM tmp_target_empleados);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'empleados_sucursales eliminados -> % filas', v_rows;
  END IF;

  -- 6) Otras FK -> empleados
  IF to_regclass('public.empleados') IS NOT NULL THEN
    FOR v_fk IN
      SELECT
        ns.nspname AS schema_name,
        cls.relname AS table_name,
        att.attname AS column_name
      FROM pg_constraint con
      INNER JOIN pg_class cls ON cls.oid = con.conrelid
      INNER JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      INNER JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.confrelid = 'public.empleados'::regclass
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      IF v_fk.schema_name = 'public'
         AND v_fk.table_name IN ('usuarios', 'empleados_sucursales', 'empleados') THEN
        CONTINUE;
      END IF;

      IF v_preserve_employee_history AND v_fallback_employee_id IS NOT NULL THEN
        EXECUTE format(
          'UPDATE %I.%I t
           SET %I = $1
           WHERE t.%I IN (SELECT id_empleado FROM tmp_target_empleados)',
          v_fk.schema_name,
          v_fk.table_name,
          v_fk.column_name,
          v_fk.column_name
        )
        USING v_fallback_employee_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE NOTICE 'FK->empleados reasignada en %.% -> % filas', v_fk.schema_name, v_fk.table_name, v_rows;
      ELSE
        EXECUTE format(
          'DELETE FROM %I.%I t
           WHERE t.%I IN (SELECT id_empleado FROM tmp_target_empleados)',
          v_fk.schema_name,
          v_fk.table_name,
          v_fk.column_name
        );
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE NOTICE 'FK->empleados eliminada en %.% -> % filas', v_fk.schema_name, v_fk.table_name, v_rows;
      END IF;
    END LOOP;

    DELETE FROM public.empleados
    WHERE id_empleado IN (SELECT id_empleado FROM tmp_target_empleados);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'empleados eliminados -> % filas', v_rows;
  END IF;

  -- 7) Personas huerfanas de clientes/empleados
  IF v_delete_orphan_personas AND to_regclass('public.personas') IS NOT NULL THEN
    CREATE TEMP TABLE tmp_orphan_personas ON COMMIT DROP AS
    SELECT tp.id_persona
    FROM tmp_target_personas tp
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.id_persona = tp.id_persona
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.empleados e
      WHERE e.id_persona = tp.id_persona
    );

    CREATE TEMP TABLE tmp_orphan_correos (
      id_correo INTEGER PRIMARY KEY
    ) ON COMMIT DROP;

    CREATE TEMP TABLE tmp_orphan_telefonos (
      id_telefono INTEGER PRIMARY KEY
    ) ON COMMIT DROP;

    CREATE TEMP TABLE tmp_orphan_direcciones (
      id_direccion INTEGER PRIMARY KEY
    ) ON COMMIT DROP;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'id_correo'
    ) THEN
      INSERT INTO tmp_orphan_correos (id_correo)
      SELECT DISTINCT p.id_correo
      FROM public.personas p
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
        AND p.id_correo IS NOT NULL
      ON CONFLICT (id_correo) DO NOTHING;

      UPDATE public.personas p
      SET id_correo = NULL
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
        AND p.id_correo IS NOT NULL;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'personas.id_correo limpiado -> % filas', v_rows;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'id_telefono'
    ) THEN
      INSERT INTO tmp_orphan_telefonos (id_telefono)
      SELECT DISTINCT p.id_telefono
      FROM public.personas p
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
        AND p.id_telefono IS NOT NULL
      ON CONFLICT (id_telefono) DO NOTHING;

      UPDATE public.personas p
      SET id_telefono = NULL
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
        AND p.id_telefono IS NOT NULL;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'personas.id_telefono limpiado -> % filas', v_rows;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'id_direccion'
    ) THEN
      INSERT INTO tmp_orphan_direcciones (id_direccion)
      SELECT DISTINCT p.id_direccion
      FROM public.personas p
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
        AND p.id_direccion IS NOT NULL
      ON CONFLICT (id_direccion) DO NOTHING;

      UPDATE public.personas p
      SET id_direccion = NULL
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
        AND p.id_direccion IS NOT NULL;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'personas.id_direccion limpiado -> % filas', v_rows;
    END IF;

    IF to_regclass('public.correos') IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'correos' AND column_name = 'id_persona'
       ) THEN
      UPDATE public.correos c
      SET id_persona = NULL
      WHERE c.id_persona IN (SELECT id_persona FROM tmp_orphan_personas);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'correos.id_persona limpiado -> % filas', v_rows;

      DELETE FROM public.correos
      WHERE id_correo IN (SELECT id_correo FROM tmp_orphan_correos)
        AND NOT EXISTS (
          SELECT 1
          FROM public.personas p
          WHERE p.id_correo = correos.id_correo
        );
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'correos eliminados -> % filas', v_rows;
    END IF;

    IF to_regclass('public.telefonos') IS NOT NULL THEN
      DELETE FROM public.telefonos
      WHERE id_telefono IN (SELECT id_telefono FROM tmp_orphan_telefonos)
        AND NOT EXISTS (
          SELECT 1
          FROM public.personas p
          WHERE p.id_telefono = telefonos.id_telefono
        );
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'telefonos eliminados -> % filas', v_rows;
    END IF;

    IF to_regclass('public.direcciones') IS NOT NULL THEN
      DELETE FROM public.direcciones
      WHERE id_direccion IN (SELECT id_direccion FROM tmp_orphan_direcciones)
        AND NOT EXISTS (
          SELECT 1
          FROM public.personas p
          WHERE p.id_direccion = direcciones.id_direccion
        );
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'direcciones eliminadas -> % filas', v_rows;
    END IF;

    FOR v_fk IN
      SELECT
        ns.nspname AS schema_name,
        cls.relname AS table_name,
        att.attname AS column_name
      FROM pg_constraint con
      INNER JOIN pg_class cls ON cls.oid = con.conrelid
      INNER JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      INNER JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = con.conkey[1]
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
        'DELETE FROM %I.%I t
         WHERE t.%I IN (SELECT id_persona FROM tmp_orphan_personas)',
        v_fk.schema_name,
        v_fk.table_name,
        v_fk.column_name
      );
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'FK->personas eliminada en %.% -> % filas', v_fk.schema_name, v_fk.table_name, v_rows;
    END LOOP;

    DELETE FROM public.personas p
    WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_personas);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'personas eliminadas -> % filas', v_rows;
  END IF;

  -- 8) Reseed de secuencias
  IF to_regclass('public.usuarios') IS NOT NULL THEN
    SELECT pg_get_serial_sequence('public.usuarios', 'id_usuario') INTO v_seq_name;
    IF v_seq_name IS NOT NULL THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(id_usuario) FROM public.usuarios), 0), 1), true)',
        v_seq_name
      );
      RAISE NOTICE 'Secuencia usuarios reseedeada.';
    END IF;
  END IF;

  IF to_regclass('public.empleados') IS NOT NULL THEN
    SELECT pg_get_serial_sequence('public.empleados', 'id_empleado') INTO v_seq_name;
    IF v_seq_name IS NOT NULL THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(id_empleado) FROM public.empleados), 0), 1), true)',
        v_seq_name
      );
      RAISE NOTICE 'Secuencia empleados reseedeada.';
    END IF;
  END IF;

  IF to_regclass('public.clientes') IS NOT NULL THEN
    SELECT pg_get_serial_sequence('public.clientes', 'id_cliente') INTO v_seq_name;
    IF v_seq_name IS NOT NULL THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(id_cliente) FROM public.clientes), 0), 1), true)',
        v_seq_name
      );
      RAISE NOTICE 'Secuencia clientes reseedeada.';
    END IF;
  END IF;

  IF to_regclass('public.personas') IS NOT NULL THEN
    SELECT pg_get_serial_sequence('public.personas', 'id_persona') INTO v_seq_name;
    IF v_seq_name IS NOT NULL THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(id_persona) FROM public.personas), 0), 1), true)',
        v_seq_name
      );
      RAISE NOTICE 'Secuencia personas reseedeada.';
    END IF;
  END IF;

  RAISE NOTICE 'Borrado selectivo de clientes y empleados finalizado correctamente.';
END $$;

COMMIT;

DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF to_regclass('public.clientes') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.clientes;
    RAISE NOTICE 'clientes_restantes = %', v_count;
  END IF;

  IF to_regclass('public.empleados') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.empleados;
    RAISE NOTICE 'empleados_restantes = %', v_count;
  END IF;

  IF to_regclass('public.usuarios') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.usuarios;
    RAISE NOTICE 'usuarios_restantes = %', v_count;
  END IF;

  IF to_regclass('public.personas') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.personas;
    RAISE NOTICE 'personas_restantes = %', v_count;
  END IF;
END $$;

-- Verificacion manual sugerida:
-- SELECT id_cliente, id_persona FROM public.clientes WHERE id_cliente IN (116, 117);
-- SELECT id_empleado, id_persona FROM public.empleados WHERE id_empleado IN (27, 28, 29);
-- SELECT id_usuario, nombre_usuario, id_empleado, id_cliente FROM public.usuarios
-- WHERE id_empleado IN (27, 28, 29) OR id_cliente IN (116, 117);
