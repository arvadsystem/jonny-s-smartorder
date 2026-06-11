-- Limpieza maestra segura de usuarios y empleados
-- Fecha: 2026-06-10
-- Objetivo:
--   1) conservar solo un conjunto puntual de usuarios,
--   2) eliminar empleados/usuarios no deseados,
--   3) limpiar relaciones dependientes sin romper integridad,
--   4) reiniciar secuencias al siguiente valor disponible.
--
-- Usuarios conservados por defecto:
--   - admin
--   - BCARBAJAL
--   - root
--   - PPANTALLA
--
-- Nota importante sobre el contador:
--   - Este script reinicia las secuencias al siguiente valor libre real.
--   - Si conservas IDs altos (ej. 30, 32), el siguiente ID sera 33.
--   - Para volver visualmente a 1..4 hay que renumerar PK/FK en cascada, lo cual
--     es otra fase mas riesgosa y no se ejecuta aqui.

BEGIN;

DO $$
DECLARE
  v_execute BOOLEAN := true;
  v_preserve_user_history BOOLEAN := true;
  v_preserve_employee_history BOOLEAN := true;
  v_delete_orphan_personas BOOLEAN := true;

  v_keep_count INTEGER := 0;
  v_delete_users_count INTEGER := 0;
  v_delete_employees_count INTEGER := 0;
  v_delete_personas_count INTEGER := 0;
  v_rows INTEGER := 0;

  v_fallback_user_id INTEGER := NULL;
  v_fallback_employee_id INTEGER := NULL;
  v_fk RECORD;
  v_seq_name TEXT;
BEGIN
  IF to_regclass('public.usuarios') IS NULL THEN
    RAISE NOTICE 'No existe public.usuarios. Se cancela el script.';
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_keep_usernames (
    nombre_usuario TEXT PRIMARY KEY
  ) ON COMMIT DROP;

  INSERT INTO tmp_keep_usernames (nombre_usuario)
  VALUES
    ('admin'),
    ('BCARBAJAL'),
    ('root'),
    ('PPANTALLA');

  CREATE TEMP TABLE tmp_keep_users ON COMMIT DROP AS
  SELECT
    u.id_usuario,
    u.nombre_usuario,
    u.id_empleado,
    e.id_persona
  FROM public.usuarios u
  LEFT JOIN public.empleados e ON e.id_empleado = u.id_empleado
  WHERE EXISTS (
    SELECT 1
    FROM tmp_keep_usernames k
    WHERE LOWER(k.nombre_usuario) = LOWER(u.nombre_usuario)
  );

  SELECT COUNT(*) INTO v_keep_count FROM tmp_keep_users;
  IF v_keep_count <> 4 THEN
    RAISE EXCEPTION 'Se esperaban 4 usuarios a conservar y se resolvieron %.', v_keep_count;
  END IF;

  SELECT ku.id_usuario, ku.id_empleado
  INTO v_fallback_user_id, v_fallback_employee_id
  FROM tmp_keep_users ku
  WHERE LOWER(ku.nombre_usuario) = 'root'
  LIMIT 1;

  IF v_fallback_user_id IS NULL THEN
    SELECT ku.id_usuario, ku.id_empleado
    INTO v_fallback_user_id, v_fallback_employee_id
    FROM tmp_keep_users ku
    WHERE LOWER(ku.nombre_usuario) = 'admin'
    LIMIT 1;
  END IF;

  IF v_fallback_user_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver usuario fallback (root/admin).';
  END IF;

  CREATE TEMP TABLE tmp_delete_users ON COMMIT DROP AS
  SELECT
    u.id_usuario,
    u.nombre_usuario,
    u.id_empleado
  FROM public.usuarios u
  WHERE NOT EXISTS (
    SELECT 1
    FROM tmp_keep_users ku
    WHERE ku.id_usuario = u.id_usuario
  );

  CREATE TEMP TABLE tmp_delete_empleados ON COMMIT DROP AS
  SELECT
    e.id_empleado,
    e.id_persona
  FROM public.empleados e
  WHERE NOT EXISTS (
    SELECT 1
    FROM tmp_keep_users ku
    WHERE ku.id_empleado = e.id_empleado
  );

  CREATE TEMP TABLE tmp_delete_personas ON COMMIT DROP AS
  SELECT DISTINCT de.id_persona
  FROM tmp_delete_empleados de
  WHERE de.id_persona IS NOT NULL;

  SELECT COUNT(*) INTO v_delete_users_count FROM tmp_delete_users;
  SELECT COUNT(*) INTO v_delete_employees_count FROM tmp_delete_empleados;
  SELECT COUNT(*) INTO v_delete_personas_count FROM tmp_delete_personas;

  RAISE NOTICE 'Usuarios conservados -> %', v_keep_count;
  RAISE NOTICE 'Usuarios a eliminar -> %', v_delete_users_count;
  RAISE NOTICE 'Empleados a eliminar -> %', v_delete_employees_count;
  RAISE NOTICE 'Personas candidatas a eliminar -> %', v_delete_personas_count;
  RAISE NOTICE 'Usuario fallback -> id_usuario=% id_empleado=%', v_fallback_user_id, v_fallback_employee_id;

  IF NOT v_execute THEN
    RAISE NOTICE 'Vista previa completada. Para ejecutar, cambia v_execute := true.';
    RETURN;
  END IF;

  -- 1) Dependencias directas de usuarios: tablas puramente asociativas o de autenticacion.
  IF to_regclass('public.verificacion_cuentas_tokens') IS NOT NULL THEN
    DELETE FROM public.verificacion_cuentas_tokens
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_delete_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'verificacion_cuentas_tokens eliminados -> % filas', v_rows;
  END IF;

  IF to_regclass('public.sesiones_activas') IS NOT NULL THEN
    DELETE FROM public.sesiones_activas
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_delete_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'sesiones_activas eliminadas -> % filas', v_rows;
  END IF;

  IF to_regclass('public.roles_usuarios') IS NOT NULL THEN
    DELETE FROM public.roles_usuarios
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_delete_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'roles_usuarios eliminados -> % filas', v_rows;
  END IF;

  IF to_regclass('public.identidades_auth') IS NOT NULL THEN
    DELETE FROM public.identidades_auth
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_delete_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'identidades_auth eliminadas -> % filas', v_rows;
  END IF;

  IF to_regclass('public.usuarios_sucursales') IS NOT NULL THEN
    DELETE FROM public.usuarios_sucursales
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_delete_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'usuarios_sucursales eliminados -> % filas', v_rows;
  END IF;

  IF to_regclass('public.usuarios_clientes') IS NOT NULL THEN
    DELETE FROM public.usuarios_clientes
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_delete_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'usuarios_clientes eliminados -> % filas', v_rows;
  END IF;

  IF to_regclass('public.usuarios_password_history') IS NOT NULL THEN
    DELETE FROM public.usuarios_password_history
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_delete_users);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'usuarios_password_history eliminados -> % filas', v_rows;
  END IF;

  -- 2) Otras FK -> usuarios.
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

    IF v_preserve_user_history THEN
      EXECUTE format(
        'UPDATE %I.%I t
         SET %I = $1
         WHERE t.%I IN (SELECT id_usuario FROM tmp_delete_users)',
        v_fk.schema_name,
        v_fk.table_name,
        v_fk.column_name,
        v_fk.column_name
      )
      USING v_fallback_user_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'FK->usuarios reasignada en %.% -> % filas',
        v_fk.schema_name,
        v_fk.table_name,
        v_rows;
    ELSE
      EXECUTE format(
        'DELETE FROM %I.%I t
         WHERE t.%I IN (SELECT id_usuario FROM tmp_delete_users)',
        v_fk.schema_name,
        v_fk.table_name,
        v_fk.column_name
      );
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'FK->usuarios eliminada en %.% -> % filas',
        v_fk.schema_name,
        v_fk.table_name,
        v_rows;
    END IF;
  END LOOP;

  -- 3) Eliminar usuarios no conservados.
  DELETE FROM public.usuarios
  WHERE id_usuario IN (SELECT id_usuario FROM tmp_delete_users);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE 'usuarios eliminados -> % filas', v_rows;

  -- 4) Dependencias directas de empleados.
  IF to_regclass('public.empleados_sucursales') IS NOT NULL THEN
    DELETE FROM public.empleados_sucursales
    WHERE id_empleado IN (SELECT id_empleado FROM tmp_delete_empleados);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'empleados_sucursales eliminados -> % filas', v_rows;
  END IF;

  -- 5) Otras FK -> empleados.
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
           WHERE t.%I IN (SELECT id_empleado FROM tmp_delete_empleados)',
          v_fk.schema_name,
          v_fk.table_name,
          v_fk.column_name,
          v_fk.column_name
        )
        USING v_fallback_employee_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE NOTICE 'FK->empleados reasignada en %.% -> % filas',
          v_fk.schema_name,
          v_fk.table_name,
          v_rows;
      ELSE
        EXECUTE format(
          'DELETE FROM %I.%I t
           WHERE t.%I IN (SELECT id_empleado FROM tmp_delete_empleados)',
          v_fk.schema_name,
          v_fk.table_name,
          v_fk.column_name
        );
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE NOTICE 'FK->empleados eliminada en %.% -> % filas',
          v_fk.schema_name,
          v_fk.table_name,
          v_rows;
      END IF;
    END LOOP;
  END IF;

  -- 6) Eliminar empleados no conservados.
  DELETE FROM public.empleados
  WHERE id_empleado IN (SELECT id_empleado FROM tmp_delete_empleados);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE 'empleados eliminados -> % filas', v_rows;

  -- 7) Personas huerfanas de empleados.
  IF v_delete_orphan_personas
     AND to_regclass('public.personas') IS NOT NULL THEN
    CREATE TEMP TABLE tmp_orphan_employee_personas ON COMMIT DROP AS
    SELECT dp.id_persona
    FROM tmp_delete_personas dp
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.empleados e
      WHERE e.id_persona = dp.id_persona
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.id_persona = dp.id_persona
    );

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'id_correo'
    ) THEN
      UPDATE public.personas p
      SET id_correo = NULL
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_employee_personas);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'personas.id_correo limpiado -> % filas', v_rows;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'id_telefono'
    ) THEN
      UPDATE public.personas p
      SET id_telefono = NULL
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_employee_personas);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'personas.id_telefono limpiado -> % filas', v_rows;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'id_direccion'
    ) THEN
      UPDATE public.personas p
      SET id_direccion = NULL
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_employee_personas);
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
      WHERE c.id_persona IN (SELECT id_persona FROM tmp_orphan_employee_personas);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'correos.id_persona limpiado -> % filas', v_rows;
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
         AND v_fk.table_name IN ('empleados', 'clientes', 'personas', 'correos') THEN
        CONTINUE;
      END IF;

      EXECUTE format(
        'DELETE FROM %I.%I t
         WHERE t.%I IN (SELECT id_persona FROM tmp_orphan_employee_personas)',
        v_fk.schema_name,
        v_fk.table_name,
        v_fk.column_name
      );
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'FK->personas eliminada en %.% -> % filas',
        v_fk.schema_name,
        v_fk.table_name,
        v_rows;
    END LOOP;

    DELETE FROM public.personas p
    WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_employee_personas)
      AND NOT EXISTS (
        SELECT 1
        FROM public.correos c
        WHERE c.id_persona = p.id_persona
      );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'personas eliminadas -> % filas', v_rows;
  END IF;

  -- 8) Reseed de secuencias al siguiente valor disponible.
  SELECT pg_get_serial_sequence('public.usuarios', 'id_usuario') INTO v_seq_name;
  IF v_seq_name IS NOT NULL THEN
    EXECUTE format(
      'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(id_usuario) FROM public.usuarios), 0), 1), true)',
      v_seq_name
    );
    RAISE NOTICE 'Secuencia usuarios reseedeada usando MAX(id_usuario).';
  END IF;

  IF to_regclass('public.empleados') IS NOT NULL THEN
    SELECT pg_get_serial_sequence('public.empleados', 'id_empleado') INTO v_seq_name;
    IF v_seq_name IS NOT NULL THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(id_empleado) FROM public.empleados), 0), 1), true)',
        v_seq_name
      );
      RAISE NOTICE 'Secuencia empleados reseedeada usando MAX(id_empleado).';
    END IF;
  END IF;

  IF to_regclass('public.personas') IS NOT NULL THEN
    SELECT pg_get_serial_sequence('public.personas', 'id_persona') INTO v_seq_name;
    IF v_seq_name IS NOT NULL THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(id_persona) FROM public.personas), 0), 1), true)',
        v_seq_name
      );
      RAISE NOTICE 'Secuencia personas reseedeada usando MAX(id_persona).';
    END IF;
  END IF;

  RAISE NOTICE 'Limpieza de usuarios y empleados finalizada correctamente.';
END $$;

COMMIT;

DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF to_regclass('public.usuarios') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.usuarios;
    RAISE NOTICE 'usuarios_restantes = %', v_count;
  END IF;

  IF to_regclass('public.empleados') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.empleados;
    RAISE NOTICE 'empleados_restantes = %', v_count;
  END IF;

  IF to_regclass('public.personas') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.personas;
    RAISE NOTICE 'personas_restantes = %', v_count;
  END IF;
END $$;

-- Verificacion manual sugerida:
-- SELECT id_usuario, nombre_usuario, id_empleado FROM public.usuarios ORDER BY id_usuario;
-- SELECT id_empleado, id_persona, id_sucursal FROM public.empleados ORDER BY id_empleado;
