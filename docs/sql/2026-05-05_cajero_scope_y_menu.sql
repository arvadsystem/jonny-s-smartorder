-- Ajuste de accesos para rol CAJERO + correccion opcional de scope de sucursal para VCARBAJAL
-- Fecha: 2026-05-05
-- Seguro/idempotente: SI

BEGIN;

-- ==========================================================
-- 1) CAJERO: solo modulos operativos (Ventas + Cierres de caja)
--    Bloquear dashboard, sucursales, menu y demas modulos no operativos.
-- ==========================================================

DO $$
DECLARE
  v_id_rol_cajero int;
BEGIN
  SELECT r.id_rol
  INTO v_id_rol_cajero
  FROM public.roles r
  WHERE UPPER(TRIM(r.nombre)) = 'CAJERO'
  LIMIT 1;

  IF v_id_rol_cajero IS NULL THEN
    RAISE NOTICE 'No existe el rol CAJERO. Se omite bloque de permisos.';
    RETURN;
  END IF;

  -- 1.1) Revocar permisos de modulos fuera de alcance operativo para cajero.
  DELETE FROM public.roles_permisos rp
  USING public.permisos p
  WHERE rp.id_permiso = p.id_permiso
    AND rp.id_rol = v_id_rol_cajero
    AND (
      p.nombre_permiso LIKE 'DASHBOARD_%'
      OR p.nombre_permiso LIKE 'SUCURSALES_%'
      OR p.nombre_permiso LIKE 'MENU_%'
      OR p.nombre_permiso LIKE 'INVENTARIO_%'
      OR p.nombre_permiso LIKE 'PERSONAS_%'
      OR p.nombre_permiso LIKE 'EMPRESAS_%'
      OR p.nombre_permiso LIKE 'CLIENTES_%'
      OR p.nombre_permiso LIKE 'EMPLEADOS_%'
      OR p.nombre_permiso LIKE 'USUARIOS_%'
      OR p.nombre_permiso LIKE 'ROLES_PERMISOS_%'
      OR p.nombre_permiso LIKE 'PLANILLAS_%'
      OR p.nombre_permiso LIKE 'SEGURIDAD_%'
      OR p.nombre_permiso LIKE 'CONFIGURACION_%'
      OR p.nombre_permiso LIKE 'FIDELIZACION_%'
      OR p.nombre_permiso LIKE 'REPORTES_%'
      OR p.nombre_permiso LIKE 'PARAMETROS_%'
      OR p.nombre_permiso LIKE 'COCINA_%'
      OR p.nombre_permiso IN ('INVENTARIO_VER', 'MENU_VER', 'SUCURSALES_VER', 'DASHBOARD_VER')
    );

  -- 1.2) Garantizar permisos minimos para lo que SI debe ver/usar:
  --      Ventas (ventas/caja/pedidos) + Cierres de caja (operacion + historial).
  INSERT INTO public.roles_permisos (id_rol, id_permiso)
  SELECT
    v_id_rol_cajero,
    p.id_permiso
  FROM public.permisos p
  WHERE p.nombre_permiso IN (
    'VENTAS_VER',
    'VENTAS_DETALLE_VER',
    'VENTAS_CREAR',
    'VENTAS_CARRITO_EDITAR',
    'VENTAS_METODO_PAGO_SELECCIONAR',
    'VENTAS_IMPRIMIR',
    'VENTAS_CAJAS_MODULO_VER',
    'VENTAS_CAJAS_LISTADO_VER',
    'VENTAS_CAJAS_DETALLE_VER',
    'VENTAS_CAJAS_SESION_ABRIR',
    'VENTAS_CAJAS_SESION_CERRAR',
    'VENTAS_CAJAS_ARQUEO_REGISTRAR',
    'VENTAS_CAJAS_REPORTE_VER',
    'VENTAS_CIERRES_VER',
    'PERFIL_VER',
    'PERFIL_EDITAR',
    'PERFIL_PASSWORD_CAMBIAR'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.roles_permisos rp
    WHERE rp.id_rol = v_id_rol_cajero
      AND rp.id_permiso = p.id_permiso
  );

  RAISE NOTICE 'Permisos de CAJERO ajustados correctamente.';
END $$;

-- ==========================================================
-- 2) CORRECCION OPCIONAL VCARBAJAL (scope sucursal)
--    Motivo: tenia inconsistencia entre empleados.id_sucursal y empleados_sucursales.
-- ==========================================================

DO $$
DECLARE
  v_id_usuario int;
  v_id_empleado int;
  v_id_sucursal_empleado int;
BEGIN
  SELECT u.id_usuario, u.id_empleado
  INTO v_id_usuario, v_id_empleado
  FROM public.usuarios u
  WHERE UPPER(TRIM(u.nombre_usuario)) = 'VCARBAJAL'
  LIMIT 1;

  IF v_id_usuario IS NULL OR v_id_empleado IS NULL THEN
    RAISE NOTICE 'No se encontro usuario VCARBAJAL con empleado asociado. Se omite bloque de sucursal.';
    RETURN;
  END IF;

  SELECT e.id_sucursal
  INTO v_id_sucursal_empleado
  FROM public.empleados e
  WHERE e.id_empleado = v_id_empleado
  LIMIT 1;

  IF v_id_sucursal_empleado IS NULL THEN
    RAISE NOTICE 'Empleado de VCARBAJAL no tiene id_sucursal. Se omite bloque de sucursal.';
    RETURN;
  END IF;

  -- Desactivar asignaciones secundarias activas distintas a su sucursal principal en empleados.id_sucursal
  UPDATE public.empleados_sucursales es
  SET estado = false,
      es_principal = false,
      fecha_actualizacion = NOW()
  WHERE es.id_empleado = v_id_empleado
    AND COALESCE(es.estado, true) = true
    AND es.id_sucursal <> v_id_sucursal_empleado;

  -- Garantizar la fila principal consistente en empleados_sucursales
  INSERT INTO public.empleados_sucursales (id_empleado, id_sucursal, es_principal, estado, fecha_creacion, fecha_actualizacion)
  SELECT v_id_empleado, v_id_sucursal_empleado, true, true, NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.empleados_sucursales es
    WHERE es.id_empleado = v_id_empleado
      AND es.id_sucursal = v_id_sucursal_empleado
  );

  UPDATE public.empleados_sucursales es
  SET es_principal = true,
      estado = true,
      fecha_actualizacion = NOW()
  WHERE es.id_empleado = v_id_empleado
    AND es.id_sucursal = v_id_sucursal_empleado;

  RAISE NOTICE 'Scope de sucursal de VCARBAJAL alineado con empleados.id_sucursal = %.', v_id_sucursal_empleado;
END $$;

COMMIT;

-- ==========================================================
-- Verificacion rapida
-- ==========================================================

-- Permisos activos del rol CAJERO
SELECT r.nombre AS rol, p.nombre_permiso
FROM public.roles r
JOIN public.roles_permisos rp ON rp.id_rol = r.id_rol
JOIN public.permisos p ON p.id_permiso = rp.id_permiso
WHERE UPPER(TRIM(r.nombre)) = 'CAJERO'
ORDER BY p.nombre_permiso;

-- Asignaciones de sucursal de VCARBAJAL
SELECT
  u.nombre_usuario,
  u.id_empleado,
  e.id_sucursal AS id_sucursal_empleado,
  s1.nombre_sucursal AS sucursal_empleado,
  es.id_sucursal AS id_sucursal_scope,
  s2.nombre_sucursal AS sucursal_scope,
  es.es_principal,
  es.estado
FROM public.usuarios u
LEFT JOIN public.empleados e ON e.id_empleado = u.id_empleado
LEFT JOIN public.sucursales s1 ON s1.id_sucursal = e.id_sucursal
LEFT JOIN public.empleados_sucursales es ON es.id_empleado = e.id_empleado
LEFT JOIN public.sucursales s2 ON s2.id_sucursal = es.id_sucursal
WHERE UPPER(TRIM(u.nombre_usuario)) = 'VCARBAJAL'
ORDER BY es.id_sucursal NULLS LAST;
