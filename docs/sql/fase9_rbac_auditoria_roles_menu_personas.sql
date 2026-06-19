-- FASE 9
-- Auditoria segura de roles/permisos para Menu y Personas.
-- No modifica datos. Solo consulta estructura, cobertura y brechas.

-- 1) Roles objetivo presentes en la base.
SELECT
  r.id_rol,
  r.nombre
FROM public.roles r
WHERE LOWER(TRIM(r.nombre)) IN ('administrador', 'super_admin', 'root', 'cajero', 'cocina')
ORDER BY r.nombre;

-- 2) Permisos objetivo de Menu y Personas que deben revisarse.
WITH permisos_objetivo(nombre_permiso) AS (
  VALUES
    ('MENU_VER'),
    ('MENU_RECETAS_VER'),
    ('MENU_RECETAS_CREAR'),
    ('MENU_RECETAS_EDITAR'),
    ('MENU_RECETAS_ESTADO_CAMBIAR'),
    ('MENU_SALSAS_VER'),
    ('MENU_SALSAS_CREAR'),
    ('MENU_SALSAS_EDITAR'),
    ('MENU_SALSAS_ESTADO_CAMBIAR'),
    ('MENU_PUBLICACION_VER'),
    ('MENU_PUBLICACION_GUARDAR'),
    ('MENU_TEMPORADA_CREAR'),
    ('MENU_EXTRAS_VER'),
    ('MENU_EXTRAS_CREAR'),
    ('MENU_EXTRAS_EDITAR'),
    ('MENU_EXTRAS_ESTADO_CAMBIAR'),
    ('MENU_COMBOS_VER'),
    ('MENU_COMBOS_CREAR'),
    ('MENU_COMBOS_EDITAR'),
    ('MENU_COMBOS_ESTADO_CAMBIAR'),
    ('MENU_COMBOS_DETALLE_EDITAR'),
    ('MENU_POS_VER'),
    ('MENU_POS_ARCHIVOS_SUBIR'),
    ('MENU_POS_PRODUCTOS_IMAGEN_EDITAR'),
    ('MENU_POS_COMBOS_IMAGEN_EDITAR'),
    ('MENU_POS_ARCHIVOS_ELIMINAR'),
    ('MENU_DEPARTAMENTOS_VER'),
    ('MENU_DEPARTAMENTOS_CREAR'),
    ('MENU_DEPARTAMENTOS_EDITAR'),
    ('MENU_DEPARTAMENTOS_ELIMINAR'),
    ('CLIENTES_MODULO_VER'),
    ('CLIENTES_LISTADO_VER'),
    ('CLIENTES_CREAR'),
    ('CLIENTES_EDITAR'),
    ('EMPLEADOS_MODULO_VER'),
    ('EMPLEADOS_LISTADO_VER'),
    ('EMPLEADOS_CREAR'),
    ('EMPLEADOS_EDITAR'),
    ('USUARIOS_MODULO_VER'),
    ('USUARIOS_LISTADO_VER'),
    ('USUARIOS_CREAR'),
    ('USUARIOS_EDITAR'),
    ('ROLES_PERMISOS_MODULO_VER'),
    ('ROLES_PERMISOS_ROLES_LISTADO_VER'),
    ('ROLES_PERMISOS_PERMISOS_LISTADO_VER'),
    ('ROLES_PERMISOS_PERMISOS_GUARDAR'),
    ('PLANILLAS_MODULO_VER'),
    ('PLANILLAS_LISTADO_VER')
)
SELECT
  po.nombre_permiso,
  p.id_permiso,
  p.descripcion
FROM permisos_objetivo po
LEFT JOIN public.permisos p
  ON UPPER(TRIM(p.nombre_permiso)) = UPPER(TRIM(po.nombre_permiso))
ORDER BY po.nombre_permiso;

-- 3) Permisos objetivo faltantes en la tabla permisos.
WITH permisos_objetivo(nombre_permiso) AS (
  VALUES
    ('MENU_VER'),
    ('MENU_RECETAS_VER'),
    ('MENU_RECETAS_CREAR'),
    ('MENU_RECETAS_EDITAR'),
    ('MENU_RECETAS_ESTADO_CAMBIAR'),
    ('MENU_SALSAS_VER'),
    ('MENU_SALSAS_CREAR'),
    ('MENU_SALSAS_EDITAR'),
    ('MENU_SALSAS_ESTADO_CAMBIAR'),
    ('MENU_PUBLICACION_VER'),
    ('MENU_PUBLICACION_GUARDAR'),
    ('MENU_TEMPORADA_CREAR'),
    ('MENU_EXTRAS_VER'),
    ('MENU_EXTRAS_CREAR'),
    ('MENU_EXTRAS_EDITAR'),
    ('MENU_EXTRAS_ESTADO_CAMBIAR'),
    ('MENU_COMBOS_VER'),
    ('MENU_COMBOS_CREAR'),
    ('MENU_COMBOS_EDITAR'),
    ('MENU_COMBOS_ESTADO_CAMBIAR'),
    ('MENU_COMBOS_DETALLE_EDITAR'),
    ('MENU_POS_VER'),
    ('MENU_POS_ARCHIVOS_SUBIR'),
    ('MENU_POS_PRODUCTOS_IMAGEN_EDITAR'),
    ('MENU_POS_COMBOS_IMAGEN_EDITAR'),
    ('MENU_POS_ARCHIVOS_ELIMINAR'),
    ('MENU_DEPARTAMENTOS_VER'),
    ('MENU_DEPARTAMENTOS_CREAR'),
    ('MENU_DEPARTAMENTOS_EDITAR'),
    ('MENU_DEPARTAMENTOS_ELIMINAR'),
    ('CLIENTES_MODULO_VER'),
    ('CLIENTES_LISTADO_VER'),
    ('CLIENTES_CREAR'),
    ('CLIENTES_EDITAR'),
    ('EMPLEADOS_MODULO_VER'),
    ('EMPLEADOS_LISTADO_VER'),
    ('EMPLEADOS_CREAR'),
    ('EMPLEADOS_EDITAR'),
    ('USUARIOS_MODULO_VER'),
    ('USUARIOS_LISTADO_VER'),
    ('USUARIOS_CREAR'),
    ('USUARIOS_EDITAR'),
    ('ROLES_PERMISOS_MODULO_VER'),
    ('ROLES_PERMISOS_ROLES_LISTADO_VER'),
    ('ROLES_PERMISOS_PERMISOS_LISTADO_VER'),
    ('ROLES_PERMISOS_PERMISOS_GUARDAR'),
    ('PLANILLAS_MODULO_VER'),
    ('PLANILLAS_LISTADO_VER')
)
SELECT po.nombre_permiso AS permiso_faltante
FROM permisos_objetivo po
LEFT JOIN public.permisos p
  ON UPPER(TRIM(p.nombre_permiso)) = UPPER(TRIM(po.nombre_permiso))
WHERE p.id_permiso IS NULL
ORDER BY po.nombre_permiso;

-- 4) Matriz real de asignacion por rol.
WITH roles_objetivo AS (
  SELECT id_rol, LOWER(TRIM(nombre)) AS rol_normalizado, nombre
  FROM public.roles
  WHERE LOWER(TRIM(nombre)) IN ('administrador', 'super_admin', 'root', 'cajero', 'cocina')
),
permisos_objetivo(nombre_permiso) AS (
  VALUES
    ('MENU_VER'),
    ('MENU_RECETAS_VER'),
    ('MENU_RECETAS_CREAR'),
    ('MENU_RECETAS_EDITAR'),
    ('MENU_RECETAS_ESTADO_CAMBIAR'),
    ('MENU_SALSAS_VER'),
    ('MENU_SALSAS_CREAR'),
    ('MENU_SALSAS_EDITAR'),
    ('MENU_SALSAS_ESTADO_CAMBIAR'),
    ('MENU_PUBLICACION_VER'),
    ('MENU_PUBLICACION_GUARDAR'),
    ('MENU_TEMPORADA_CREAR'),
    ('MENU_EXTRAS_VER'),
    ('MENU_EXTRAS_CREAR'),
    ('MENU_EXTRAS_EDITAR'),
    ('MENU_EXTRAS_ESTADO_CAMBIAR'),
    ('MENU_COMBOS_VER'),
    ('MENU_COMBOS_CREAR'),
    ('MENU_COMBOS_EDITAR'),
    ('MENU_COMBOS_ESTADO_CAMBIAR'),
    ('MENU_COMBOS_DETALLE_EDITAR'),
    ('MENU_POS_VER'),
    ('MENU_POS_ARCHIVOS_SUBIR'),
    ('MENU_POS_PRODUCTOS_IMAGEN_EDITAR'),
    ('MENU_POS_COMBOS_IMAGEN_EDITAR'),
    ('MENU_POS_ARCHIVOS_ELIMINAR'),
    ('MENU_DEPARTAMENTOS_VER'),
    ('MENU_DEPARTAMENTOS_CREAR'),
    ('MENU_DEPARTAMENTOS_EDITAR'),
    ('MENU_DEPARTAMENTOS_ELIMINAR'),
    ('CLIENTES_MODULO_VER'),
    ('CLIENTES_LISTADO_VER'),
    ('CLIENTES_CREAR'),
    ('CLIENTES_EDITAR'),
    ('EMPLEADOS_MODULO_VER'),
    ('EMPLEADOS_LISTADO_VER'),
    ('EMPLEADOS_CREAR'),
    ('EMPLEADOS_EDITAR'),
    ('USUARIOS_MODULO_VER'),
    ('USUARIOS_LISTADO_VER'),
    ('USUARIOS_CREAR'),
    ('USUARIOS_EDITAR'),
    ('ROLES_PERMISOS_MODULO_VER'),
    ('ROLES_PERMISOS_ROLES_LISTADO_VER'),
    ('ROLES_PERMISOS_PERMISOS_LISTADO_VER'),
    ('ROLES_PERMISOS_PERMISOS_GUARDAR'),
    ('PLANILLAS_MODULO_VER'),
    ('PLANILLAS_LISTADO_VER')
),
permisos_existentes AS (
  SELECT id_permiso, UPPER(TRIM(nombre_permiso)) AS nombre_permiso
  FROM public.permisos
)
SELECT
  r.nombre AS rol,
  po.nombre_permiso,
  CASE WHEN rp.id_permiso IS NOT NULL THEN true ELSE false END AS asignado
FROM roles_objetivo r
CROSS JOIN permisos_objetivo po
LEFT JOIN permisos_existentes p
  ON p.nombre_permiso = UPPER(TRIM(po.nombre_permiso))
LEFT JOIN public.roles_permisos rp
  ON rp.id_rol = r.id_rol
 AND rp.id_permiso = p.id_permiso
ORDER BY r.nombre, po.nombre_permiso;

-- 5) Brechas por rol: permisos objetivo existentes pero no asignados.
WITH roles_objetivo AS (
  SELECT id_rol, nombre
  FROM public.roles
  WHERE LOWER(TRIM(nombre)) IN ('administrador', 'super_admin', 'root', 'cajero', 'cocina')
),
permisos_objetivo(nombre_permiso) AS (
  VALUES
    ('MENU_VER'),
    ('MENU_RECETAS_VER'),
    ('MENU_RECETAS_CREAR'),
    ('MENU_RECETAS_EDITAR'),
    ('MENU_RECETAS_ESTADO_CAMBIAR'),
    ('MENU_SALSAS_VER'),
    ('MENU_SALSAS_CREAR'),
    ('MENU_SALSAS_EDITAR'),
    ('MENU_SALSAS_ESTADO_CAMBIAR'),
    ('MENU_PUBLICACION_VER'),
    ('MENU_PUBLICACION_GUARDAR'),
    ('MENU_TEMPORADA_CREAR'),
    ('MENU_EXTRAS_VER'),
    ('MENU_EXTRAS_CREAR'),
    ('MENU_EXTRAS_EDITAR'),
    ('MENU_EXTRAS_ESTADO_CAMBIAR'),
    ('MENU_COMBOS_VER'),
    ('MENU_COMBOS_CREAR'),
    ('MENU_COMBOS_EDITAR'),
    ('MENU_COMBOS_ESTADO_CAMBIAR'),
    ('MENU_COMBOS_DETALLE_EDITAR'),
    ('MENU_POS_VER'),
    ('MENU_POS_ARCHIVOS_SUBIR'),
    ('MENU_POS_PRODUCTOS_IMAGEN_EDITAR'),
    ('MENU_POS_COMBOS_IMAGEN_EDITAR'),
    ('MENU_POS_ARCHIVOS_ELIMINAR'),
    ('MENU_DEPARTAMENTOS_VER'),
    ('MENU_DEPARTAMENTOS_CREAR'),
    ('MENU_DEPARTAMENTOS_EDITAR'),
    ('MENU_DEPARTAMENTOS_ELIMINAR')
)
SELECT
  r.nombre AS rol,
  po.nombre_permiso AS permiso_no_asignado
FROM roles_objetivo r
CROSS JOIN permisos_objetivo po
JOIN public.permisos p
  ON UPPER(TRIM(p.nombre_permiso)) = UPPER(TRIM(po.nombre_permiso))
LEFT JOIN public.roles_permisos rp
  ON rp.id_rol = r.id_rol
 AND rp.id_permiso = p.id_permiso
WHERE rp.id_permiso IS NULL
ORDER BY r.nombre, po.nombre_permiso;

-- 6) Usuarios reales afectados por rol en ambiente actual.
SELECT
  r.nombre AS rol,
  COUNT(DISTINCT ru.id_usuario)::int AS total_usuarios
FROM public.roles r
LEFT JOIN public.roles_usuarios ru
  ON ru.id_rol = r.id_rol
WHERE LOWER(TRIM(r.nombre)) IN ('administrador', 'super_admin', 'root', 'cajero', 'cocina')
GROUP BY r.nombre
ORDER BY r.nombre;
