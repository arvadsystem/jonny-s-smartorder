-- Limpieza maestra segura del modulo de planillas
-- Fecha: 2026-06-10
-- Objetivo:
--   1) vaciar planillas y su detalle/movimientos,
--   2) limpiar aplicaciones de adelantos relacionadas,
--   3) opcionalmente limpiar adelantos_salario para dejar el modulo totalmente en cero,
--   4) reseedear secuencias al siguiente valor disponible.

BEGIN;

DO $$
DECLARE
  v_execute BOOLEAN := true;
  v_delete_adelantos_salario BOOLEAN := true;

  v_rows INTEGER := 0;
  v_total_planillas INTEGER := 0;
  v_total_detalles INTEGER := 0;
  v_total_movimientos INTEGER := 0;
  v_total_adelanto_aplicacion INTEGER := 0;
  v_total_adelantos_salario INTEGER := 0;

  v_fk RECORD;
  v_seq_name TEXT;
BEGIN
  IF to_regclass('public.planillas') IS NULL THEN
    RAISE NOTICE 'No existe public.planillas. Se cancela la limpieza.';
    RETURN;
  END IF;

  IF to_regclass('public.planillas') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.planillas' INTO v_total_planillas;
  END IF;

  IF to_regclass('public.detalle_planilla') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.detalle_planilla' INTO v_total_detalles;
  END IF;

  IF to_regclass('public.movimiento_planilla') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.movimiento_planilla' INTO v_total_movimientos;
  END IF;

  IF to_regclass('public.adelanto_aplicacion') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.adelanto_aplicacion' INTO v_total_adelanto_aplicacion;
  END IF;

  IF to_regclass('public.adelantos_salario') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.adelantos_salario' INTO v_total_adelantos_salario;
  END IF;

  RAISE NOTICE 'Planillas -> % registros', v_total_planillas;
  RAISE NOTICE 'Detalle planilla -> % registros', v_total_detalles;
  RAISE NOTICE 'Movimiento planilla -> % registros', v_total_movimientos;
  RAISE NOTICE 'Adelanto aplicacion -> % registros', v_total_adelanto_aplicacion;
  RAISE NOTICE 'Adelantos salario -> % registros', v_total_adelantos_salario;

  IF NOT v_execute THEN
    RAISE NOTICE 'Vista previa completada. Para ejecutar, cambia v_execute := true.';
    RETURN;
  END IF;

  -- 1) FK hijas de movimiento_planilla
  IF to_regclass('public.movimiento_planilla') IS NOT NULL THEN
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
        AND con.confrelid = 'public.movimiento_planilla'::regclass
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      EXECUTE format('DELETE FROM %I.%I', v_fk.schema_name, v_fk.table_name);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'Dependencia de movimiento_planilla limpiada en %.% -> % filas',
        v_fk.schema_name, v_fk.table_name, v_rows;
    END LOOP;
  END IF;

  -- 2) FK hijas de detalle_planilla
  IF to_regclass('public.detalle_planilla') IS NOT NULL THEN
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
        AND con.confrelid = 'public.detalle_planilla'::regclass
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      IF v_fk.schema_name = 'public' AND v_fk.table_name = 'movimiento_planilla' THEN
        CONTINUE;
      END IF;

      EXECUTE format('DELETE FROM %I.%I', v_fk.schema_name, v_fk.table_name);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'Dependencia de detalle_planilla limpiada en %.% -> % filas',
        v_fk.schema_name, v_fk.table_name, v_rows;
    END LOOP;
  END IF;

  -- 3) FK hijas de adelanto_aplicacion
  IF to_regclass('public.adelanto_aplicacion') IS NOT NULL THEN
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
        AND con.confrelid = 'public.adelanto_aplicacion'::regclass
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      EXECUTE format('DELETE FROM %I.%I', v_fk.schema_name, v_fk.table_name);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'Dependencia de adelanto_aplicacion limpiada en %.% -> % filas',
        v_fk.schema_name, v_fk.table_name, v_rows;
    END LOOP;
  END IF;

  -- 4) Eliminar tablas base en orden seguro
  IF to_regclass('public.movimiento_planilla') IS NOT NULL THEN
    DELETE FROM public.movimiento_planilla;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'movimiento_planilla eliminada -> % filas', v_rows;
  END IF;

  IF to_regclass('public.detalle_planilla') IS NOT NULL THEN
    DELETE FROM public.detalle_planilla;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'detalle_planilla eliminada -> % filas', v_rows;
  END IF;

  IF to_regclass('public.adelanto_aplicacion') IS NOT NULL THEN
    DELETE FROM public.adelanto_aplicacion;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'adelanto_aplicacion eliminada -> % filas', v_rows;
  END IF;

  -- 5) Otras FK hijas de planillas
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
      AND con.confrelid = 'public.planillas'::regclass
      AND array_length(con.conkey, 1) = 1
      AND array_length(con.confkey, 1) = 1
  LOOP
    IF v_fk.schema_name = 'public'
       AND v_fk.table_name IN ('detalle_planilla', 'adelanto_aplicacion', 'planillas') THEN
      CONTINUE;
    END IF;

    EXECUTE format('DELETE FROM %I.%I', v_fk.schema_name, v_fk.table_name);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'Dependencia de planillas limpiada en %.% -> % filas',
      v_fk.schema_name, v_fk.table_name, v_rows;
  END LOOP;

  DELETE FROM public.planillas;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE 'planillas eliminada -> % filas', v_rows;

  -- 6) Limpiar adelantos_salario si se quiere dejar modulo totalmente limpio.
  IF v_delete_adelantos_salario AND to_regclass('public.adelantos_salario') IS NOT NULL THEN
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
        AND con.confrelid = 'public.adelantos_salario'::regclass
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      IF v_fk.schema_name = 'public' AND v_fk.table_name = 'adelanto_aplicacion' THEN
        CONTINUE;
      END IF;

      EXECUTE format('DELETE FROM %I.%I', v_fk.schema_name, v_fk.table_name);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE 'Dependencia de adelantos_salario limpiada en %.% -> % filas',
        v_fk.schema_name, v_fk.table_name, v_rows;
    END LOOP;

    DELETE FROM public.adelantos_salario;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'adelantos_salario eliminada -> % filas', v_rows;
  END IF;

  -- 7) Reseed de secuencias
  SELECT pg_get_serial_sequence('public.planillas', 'id_planilla') INTO v_seq_name;
  IF v_seq_name IS NOT NULL THEN
    EXECUTE format('SELECT setval(%L, 1, false)', v_seq_name);
    RAISE NOTICE 'Secuencia planillas reiniciada.';
  END IF;

  IF to_regclass('public.detalle_planilla') IS NOT NULL THEN
    SELECT pg_get_serial_sequence('public.detalle_planilla', 'id_detalle_planilla') INTO v_seq_name;
    IF v_seq_name IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, 1, false)', v_seq_name);
      RAISE NOTICE 'Secuencia detalle_planilla reiniciada.';
    END IF;
  END IF;

  IF to_regclass('public.movimiento_planilla') IS NOT NULL THEN
    SELECT pg_get_serial_sequence('public.movimiento_planilla', 'id_movimiento_planilla') INTO v_seq_name;
    IF v_seq_name IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, 1, false)', v_seq_name);
      RAISE NOTICE 'Secuencia movimiento_planilla reiniciada.';
    END IF;
  END IF;

  IF to_regclass('public.adelanto_aplicacion') IS NOT NULL THEN
    SELECT pg_get_serial_sequence('public.adelanto_aplicacion', 'id_adelanto_aplicacion') INTO v_seq_name;
    IF v_seq_name IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, 1, false)', v_seq_name);
      RAISE NOTICE 'Secuencia adelanto_aplicacion reiniciada.';
    END IF;
  END IF;

  IF to_regclass('public.adelantos_salario') IS NOT NULL THEN
    SELECT pg_get_serial_sequence('public.adelantos_salario', 'id_adelanto_salario') INTO v_seq_name;
    IF v_seq_name IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, 1, false)', v_seq_name);
      RAISE NOTICE 'Secuencia adelantos_salario reiniciada.';
    END IF;
  END IF;

  RAISE NOTICE 'Limpieza de planillas finalizada correctamente.';
END $$;

COMMIT;

DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF to_regclass('public.planillas') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.planillas;
    RAISE NOTICE 'planillas_restantes = %', v_count;
  END IF;

  IF to_regclass('public.detalle_planilla') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.detalle_planilla;
    RAISE NOTICE 'detalle_planilla_restantes = %', v_count;
  END IF;

  IF to_regclass('public.movimiento_planilla') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.movimiento_planilla;
    RAISE NOTICE 'movimiento_planilla_restantes = %', v_count;
  END IF;

  IF to_regclass('public.adelanto_aplicacion') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.adelanto_aplicacion;
    RAISE NOTICE 'adelanto_aplicacion_restantes = %', v_count;
  END IF;

  IF to_regclass('public.adelantos_salario') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.adelantos_salario;
    RAISE NOTICE 'adelantos_salario_restantes = %', v_count;
  END IF;
END $$;

-- Verificacion manual sugerida:
-- SELECT * FROM public.planillas ORDER BY id_planilla;
-- SELECT * FROM public.detalle_planilla ORDER BY id_detalle_planilla;
