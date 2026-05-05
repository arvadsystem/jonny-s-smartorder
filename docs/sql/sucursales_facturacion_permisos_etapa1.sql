-- ETAPA 1 - Sucursales > Facturacion
-- Script seguro: crea permisos y solo asigna automaticamente al rol SUPER_ADMIN si existe.

DO $$
DECLARE
  v_perm_table_exists boolean;
  v_role_table_exists boolean;
  v_role_perm_table_exists boolean;
  v_has_perm_name_col boolean;
  v_has_perm_id_col boolean;
  v_has_role_id_col boolean;
  v_has_role_name_col boolean;
  v_has_rp_role_id_col boolean;
  v_has_rp_perm_id_col boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'permisos'
  ) INTO v_perm_table_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'roles'
  ) INTO v_role_table_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'roles_permisos'
  ) INTO v_role_perm_table_exists;

  IF NOT v_perm_table_exists THEN
    RAISE NOTICE 'No existe public.permisos. Se omite el script.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'permisos' AND column_name = 'nombre_permiso'
  ) INTO v_has_perm_name_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'permisos' AND column_name = 'id_permiso'
  ) INTO v_has_perm_id_col;

  IF NOT v_has_perm_name_col THEN
    RAISE NOTICE 'No existe public.permisos.nombre_permiso. Se omite el script.';
    RETURN;
  END IF;

  INSERT INTO public.permisos (nombre_permiso)
  VALUES
    ('SUCURSALES_FACTURACION_VER'),
    ('SUCURSALES_FACTURACION_EDITAR'),
    ('SUCURSALES_FACTURACION_PREVIEW_VER'),
    ('SUCURSALES_FACTURACION_CAI_VER'),
    ('SUCURSALES_FACTURACION_CAI_GESTIONAR')
  ON CONFLICT (nombre_permiso) DO NOTHING;

  IF NOT (v_role_table_exists AND v_role_perm_table_exists AND v_has_perm_id_col) THEN
    RAISE NOTICE 'No se detecto estructura completa para asignar rol SUPER_ADMIN. Solo se crearon permisos.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'roles' AND column_name = 'id_rol'
  ) INTO v_has_role_id_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'roles' AND column_name = 'nombre'
  ) INTO v_has_role_name_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'roles_permisos' AND column_name = 'id_rol'
  ) INTO v_has_rp_role_id_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'roles_permisos' AND column_name = 'id_permiso'
  ) INTO v_has_rp_perm_id_col;

  IF NOT (v_has_role_id_col AND v_has_role_name_col AND v_has_rp_role_id_col AND v_has_rp_perm_id_col) THEN
    RAISE NOTICE 'No se detectaron columnas esperadas para asignacion en roles_permisos. Solo se crearon permisos.';
    RETURN;
  END IF;

  INSERT INTO public.roles_permisos (id_rol, id_permiso)
  SELECT r.id_rol, p.id_permiso
  FROM public.roles r
  JOIN public.permisos p
    ON p.nombre_permiso IN (
      'SUCURSALES_FACTURACION_VER',
      'SUCURSALES_FACTURACION_EDITAR',
      'SUCURSALES_FACTURACION_PREVIEW_VER',
      'SUCURSALES_FACTURACION_CAI_VER',
      'SUCURSALES_FACTURACION_CAI_GESTIONAR'
    )
  WHERE UPPER(TRIM(r.nombre)) = 'SUPER_ADMIN'
    AND NOT EXISTS (
      SELECT 1
      FROM public.roles_permisos rp
      WHERE rp.id_rol = r.id_rol
        AND rp.id_permiso = p.id_permiso
    );
END $$;
