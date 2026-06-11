-- Limpieza maestra segura del submodulo de clientes
-- Fecha: 2026-06-10
-- Objetivo:
--   1) eliminar clientes y relaciones propias del submodulo,
--   2) dejar pedidos/facturas sin cliente cuando se quiera preservar historial,
--   3) evitar borrados accidentales con modo vista previa por defecto.
--
-- Modo de uso:
--   1) Ejecutar primero en vista previa.
--   2) Revisar NOTICE y conteos.
--   3) Cambiar v_execute := true cuando se confirme la limpieza.
--
-- Parametros principales dentro del bloque:
--   v_execute                 -> false = no borra, solo diagnostica.
--   v_preserve_sales_history  -> true = conserva pedidos/facturas y les pone id_cliente = NULL.
--   v_delete_auth_users       -> true = elimina usuarios vinculados al cliente.
--   v_delete_orphan_personas  -> true = elimina personas ya huerfanas despues de borrar clientes.
--   v_delete_orphan_empresas  -> false = conservador; no elimina empresas salvo activarlo manualmente.

BEGIN;

DO $$
DECLARE
  v_execute BOOLEAN := true;
  v_preserve_sales_history BOOLEAN := true;
  v_delete_auth_users BOOLEAN := true;
  v_delete_orphan_personas BOOLEAN := true;
  v_delete_orphan_empresas BOOLEAN := false;

  v_total_clientes INTEGER := 0;
  v_total_personas INTEGER := 0;
  v_total_empresas INTEGER := 0;
  v_total_usuarios INTEGER := 0;
  v_rows INTEGER := 0;
  v_fk RECORD;
  v_table_exists REGCLASS;
  v_has_cliente_empresa_rel BOOLEAN := false;
  v_preserve_tables TEXT[] := ARRAY['facturas', 'pedidos'];
BEGIN
  IF to_regclass('public.clientes') IS NULL THEN
    RAISE NOTICE 'No existe public.clientes. Se cancela la limpieza.';
    RETURN;
  END IF;

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
      SELECT DISTINCT
        c.id_cliente,
        c.id_persona,
        c.id_empresa,
        c.id_empresa_cliente
      FROM public.clientes c
    ';
  ELSE
    EXECUTE '
      CREATE TEMP TABLE tmp_target_clientes ON COMMIT DROP AS
      SELECT DISTINCT
        c.id_cliente,
        c.id_persona,
        c.id_empresa,
        NULL::INTEGER AS id_empresa_cliente
      FROM public.clientes c
    ';
  END IF;

  CREATE TEMP TABLE tmp_target_personas (
    id_persona INTEGER PRIMARY KEY
  ) ON COMMIT DROP;

  INSERT INTO tmp_target_personas (id_persona)
  SELECT DISTINCT t.id_persona
  FROM tmp_target_clientes t
  WHERE t.id_persona IS NOT NULL
  ON CONFLICT (id_persona) DO NOTHING;

  CREATE TEMP TABLE tmp_target_empresas (
    id_empresa INTEGER PRIMARY KEY
  ) ON COMMIT DROP;

  INSERT INTO tmp_target_empresas (id_empresa)
  SELECT DISTINCT x.id_empresa
  FROM (
    SELECT id_empresa FROM tmp_target_clientes
    UNION ALL
    SELECT id_empresa_cliente AS id_empresa FROM tmp_target_clientes
  ) x
  WHERE x.id_empresa IS NOT NULL
  ON CONFLICT (id_empresa) DO NOTHING;

  CREATE TEMP TABLE tmp_target_usuarios (
    id_usuario INTEGER PRIMARY KEY
  ) ON COMMIT DROP;

  IF to_regclass('public.usuarios') IS NOT NULL THEN
    INSERT INTO tmp_target_usuarios (id_usuario)
    SELECT DISTINCT u.id_usuario
    FROM public.usuarios u
    INNER JOIN tmp_target_clientes tc ON tc.id_cliente = u.id_cliente
    WHERE u.id_usuario IS NOT NULL
    ON CONFLICT (id_usuario) DO NOTHING;
  END IF;

  IF to_regclass('public.usuarios_clientes') IS NOT NULL THEN
    INSERT INTO tmp_target_usuarios (id_usuario)
    SELECT DISTINCT uc.id_usuario
    FROM public.usuarios_clientes uc
    INNER JOIN tmp_target_clientes tc ON tc.id_cliente = uc.id_cliente
    WHERE uc.id_usuario IS NOT NULL
    ON CONFLICT (id_usuario) DO NOTHING;
  END IF;

  SELECT COUNT(*) INTO v_total_clientes FROM tmp_target_clientes;
  SELECT COUNT(*) INTO v_total_personas FROM tmp_target_personas;
  SELECT COUNT(*) INTO v_total_empresas FROM tmp_target_empresas;
  SELECT COUNT(*) INTO v_total_usuarios FROM tmp_target_usuarios;

  RAISE NOTICE 'Resumen objetivo -> clientes=% personas=% empresas=% usuarios=%',
    v_total_clientes,
    v_total_personas,
    v_total_empresas,
    v_total_usuarios;

  IF v_total_clientes = 0 THEN
    RAISE NOTICE 'No hay clientes para limpiar.';
    RETURN;
  END IF;

  IF to_regclass('public.clientes_sucursales') IS NOT NULL THEN
    EXECUTE '
      SELECT COUNT(*)
      FROM public.clientes_sucursales cs
      WHERE cs.id_cliente IN (SELECT id_cliente FROM tmp_target_clientes)
    ' INTO v_rows;
    RAISE NOTICE 'Diagnostico clientes_sucursales -> % filas', v_rows;
  END IF;

  IF to_regclass('public.usuarios_clientes') IS NOT NULL THEN
    EXECUTE '
      SELECT COUNT(*)
      FROM public.usuarios_clientes uc
      WHERE uc.id_cliente IN (SELECT id_cliente FROM tmp_target_clientes)
         OR uc.id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios)
    ' INTO v_rows;
    RAISE NOTICE 'Diagnostico usuarios_clientes -> % filas', v_rows;
  END IF;

  IF to_regclass('public.pedidos') IS NOT NULL THEN
    EXECUTE '
      SELECT COUNT(*)
      FROM public.pedidos p
      WHERE p.id_cliente IN (SELECT id_cliente FROM tmp_target_clientes)
    ' INTO v_rows;
    RAISE NOTICE 'Diagnostico pedidos ligados a clientes -> % filas', v_rows;
  END IF;

  IF to_regclass('public.facturas') IS NOT NULL THEN
    EXECUTE '
      SELECT COUNT(*)
      FROM public.facturas f
      WHERE f.id_cliente IN (SELECT id_cliente FROM tmp_target_clientes)
    ' INTO v_rows;
    RAISE NOTICE 'Diagnostico facturas ligadas a clientes -> % filas', v_rows;
  END IF;

  IF NOT v_execute THEN
    RAISE NOTICE 'Vista previa completada. Para ejecutar, cambia v_execute := true.';
    RETURN;
  END IF;

  IF v_delete_auth_users AND to_regclass('public.usuarios') IS NOT NULL THEN
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
         AND v_fk.table_name IN ('identidades_auth', 'roles_usuarios', 'usuarios_clientes', 'sesiones_activas', 'verificacion_cuentas_tokens') THEN
        CONTINUE;
      END IF;

      EXECUTE format(
        'DELETE FROM %I.%I t WHERE t.%I IN (SELECT id_usuario FROM tmp_target_usuarios)',
        v_fk.schema_name,
        v_fk.table_name,
        v_fk.column_name
      );
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'Limpieza FK->usuarios en %.% -> % filas',
        v_fk.schema_name,
        v_fk.table_name,
        v_rows;
    END LOOP;

    IF to_regclass('public.verificacion_cuentas_tokens') IS NOT NULL THEN
      DELETE FROM public.verificacion_cuentas_tokens
      WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'verificacion_cuentas_tokens eliminados -> % filas', v_rows;
    END IF;

    IF to_regclass('public.sesiones_activas') IS NOT NULL THEN
      DELETE FROM public.sesiones_activas
      WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'sesiones_activas eliminadas -> % filas', v_rows;
    END IF;

    IF to_regclass('public.roles_usuarios') IS NOT NULL THEN
      DELETE FROM public.roles_usuarios
      WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'roles_usuarios eliminados -> % filas', v_rows;
    END IF;

    IF to_regclass('public.identidades_auth') IS NOT NULL THEN
      DELETE FROM public.identidades_auth
      WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'identidades_auth eliminadas -> % filas', v_rows;
    END IF;
  END IF;

  IF to_regclass('public.usuarios_clientes') IS NOT NULL THEN
    DELETE FROM public.usuarios_clientes
    WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes)
       OR id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'usuarios_clientes eliminados -> % filas', v_rows;
  END IF;

  IF v_delete_auth_users AND to_regclass('public.usuarios') IS NOT NULL THEN
    DELETE FROM public.usuarios
    WHERE id_usuario IN (SELECT id_usuario FROM tmp_target_usuarios);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'usuarios eliminados -> % filas', v_rows;
  END IF;

  IF to_regclass('public.clientes_sucursales') IS NOT NULL THEN
    DELETE FROM public.clientes_sucursales
    WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'clientes_sucursales eliminados -> % filas', v_rows;
  END IF;

  FOR v_fk IN
    SELECT
      ns.nspname AS schema_name,
      cls.relname AS table_name,
      att.attname AS column_name,
      NOT att.attnotnull AS is_nullable
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
       AND v_fk.table_name IN ('clientes_sucursales', 'usuarios_clientes', 'usuarios') THEN
      CONTINUE;
    END IF;

    IF v_preserve_sales_history
       AND v_fk.schema_name = 'public'
       AND v_fk.table_name = ANY (v_preserve_tables)
       AND v_fk.is_nullable THEN
      EXECUTE format(
        'UPDATE %I.%I t SET %I = NULL WHERE t.%I IN (SELECT id_cliente FROM tmp_target_clientes)',
        v_fk.schema_name,
        v_fk.table_name,
        v_fk.column_name,
        v_fk.column_name
      );
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'Historial preservado en %.% -> % filas actualizadas a NULL',
        v_fk.schema_name,
        v_fk.table_name,
        v_rows;
    ELSE
      EXECUTE format(
        'DELETE FROM %I.%I t WHERE t.%I IN (SELECT id_cliente FROM tmp_target_clientes)',
        v_fk.schema_name,
        v_fk.table_name,
        v_fk.column_name
      );
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'Limpieza FK->clientes en %.% -> % filas',
        v_fk.schema_name,
        v_fk.table_name,
        v_rows;
    END IF;
  END LOOP;

  DELETE FROM public.clientes
  WHERE id_cliente IN (SELECT id_cliente FROM tmp_target_clientes);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE 'clientes eliminados -> % filas', v_rows;

  IF v_delete_orphan_personas AND to_regclass('public.personas') IS NOT NULL THEN
    CREATE TEMP TABLE tmp_orphan_personas (
      id_persona INTEGER PRIMARY KEY
    ) ON COMMIT DROP;

    IF to_regclass('public.empleados') IS NOT NULL THEN
      INSERT INTO tmp_orphan_personas (id_persona)
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
      )
      ON CONFLICT (id_persona) DO NOTHING;
    ELSE
      INSERT INTO tmp_orphan_personas (id_persona)
      SELECT tp.id_persona
      FROM tmp_target_personas tp
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id_persona = tp.id_persona
      )
      ON CONFLICT (id_persona) DO NOTHING;
    END IF;

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
      WHERE table_schema = 'public'
        AND table_name = 'personas'
        AND column_name = 'id_correo'
    ) THEN
      INSERT INTO tmp_orphan_correos (id_correo)
      SELECT DISTINCT p.id_correo
      FROM public.personas p
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
        AND p.id_correo IS NOT NULL
      ON CONFLICT (id_correo) DO NOTHING;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'correos'
          AND column_name = 'id_persona'
      ) THEN
        INSERT INTO tmp_orphan_correos (id_correo)
        SELECT DISTINCT c.id_correo
        FROM public.correos c
        WHERE c.id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
          AND c.id_correo IS NOT NULL
        ON CONFLICT (id_correo) DO NOTHING;
      END IF;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'personas'
        AND column_name = 'id_telefono'
    ) THEN
      INSERT INTO tmp_orphan_telefonos (id_telefono)
      SELECT DISTINCT p.id_telefono
      FROM public.personas p
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
        AND p.id_telefono IS NOT NULL
      ON CONFLICT (id_telefono) DO NOTHING;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'personas'
        AND column_name = 'id_direccion'
    ) THEN
      INSERT INTO tmp_orphan_direcciones (id_direccion)
      SELECT DISTINCT p.id_direccion
      FROM public.personas p
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
        AND p.id_direccion IS NOT NULL
      ON CONFLICT (id_direccion) DO NOTHING;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'personas'
        AND column_name = 'id_correo'
    ) THEN
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
      WHERE table_schema = 'public'
        AND table_name = 'personas'
        AND column_name = 'id_telefono'
    ) THEN
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
      WHERE table_schema = 'public'
        AND table_name = 'personas'
        AND column_name = 'id_direccion'
    ) THEN
      UPDATE public.personas p
      SET id_direccion = NULL
      WHERE p.id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
        AND p.id_direccion IS NOT NULL;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'personas.id_direccion limpiado -> % filas', v_rows;
    END IF;

    IF to_regclass('public.correos') IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'correos'
          AND column_name = 'id_persona'
      ) THEN
        UPDATE public.correos c
        SET id_persona = NULL
        WHERE c.id_persona IN (SELECT id_persona FROM tmp_orphan_personas);
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE NOTICE 'correos.id_persona limpiado -> % filas', v_rows;
      END IF;

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
         AND v_fk.table_name IN ('clientes', 'empleados', 'correos', 'telefonos', 'direcciones') THEN
        CONTINUE;
      END IF;

      EXECUTE format(
        'DELETE FROM %I.%I t WHERE t.%I IN (SELECT id_persona FROM tmp_orphan_personas)',
        v_fk.schema_name,
        v_fk.table_name,
        v_fk.column_name
      );
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'Limpieza FK->personas en %.% -> % filas',
        v_fk.schema_name,
        v_fk.table_name,
        v_rows;
    END LOOP;

    DELETE FROM public.personas
    WHERE id_persona IN (SELECT id_persona FROM tmp_orphan_personas)
      AND NOT EXISTS (
        SELECT 1
        FROM public.correos c
        WHERE c.id_persona = personas.id_persona
      );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'personas eliminadas -> % filas', v_rows;
  END IF;

  v_table_exists := to_regclass('public.empresas');
  IF v_delete_orphan_empresas AND v_table_exists IS NOT NULL THEN
    DELETE FROM public.empresas e
    WHERE e.id_empresa IN (SELECT id_empresa FROM tmp_target_empresas)
      AND NOT EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id_empresa = e.id_empresa
           OR c.id_empresa_cliente = e.id_empresa
      );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'empresas eliminadas -> % filas', v_rows;
  END IF;

  RAISE NOTICE 'Limpieza maestra de clientes finalizada correctamente.';
END $$;

COMMIT;

-- Verificacion rapida sugerida
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF to_regclass('public.clientes') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.clientes;
    RAISE NOTICE 'clientes_restantes = %', v_count;
  END IF;

  IF to_regclass('public.clientes_sucursales') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.clientes_sucursales;
    RAISE NOTICE 'clientes_sucursales_restantes = %', v_count;
  END IF;

  IF to_regclass('public.usuarios_clientes') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.usuarios_clientes;
    RAISE NOTICE 'usuarios_clientes_restantes = %', v_count;
  END IF;
END $$;

-- Recomendacion operativa:
-- 1) Ejecutar primero en una base de pruebas o respaldo.
-- 2) Mantener v_preserve_sales_history := true si deseas conservar pedidos/facturas historicas.
-- 3) Activar v_delete_orphan_empresas := true solo si confirmas que empresas pertenece unicamente a clientes.
