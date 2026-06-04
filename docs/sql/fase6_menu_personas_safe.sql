-- FASE 6
-- Scripts seguros y no destructivos para Menu y Personas.
-- No elimina columnas, no elimina tablas, no modifica nombre_permiso existente.

BEGIN;

-- 1) Permisos granulares para Menu.
INSERT INTO public.permisos (nombre_permiso, descripcion)
SELECT v.nombre_permiso, v.descripcion
FROM (
  VALUES
    ('MENU_RECETAS_VER', 'Permite ver el submodulo de recetas del menu.'),
    ('MENU_RECETAS_CREAR', 'Permite crear recetas del menu.'),
    ('MENU_RECETAS_EDITAR', 'Permite editar recetas del menu.'),
    ('MENU_RECETAS_ESTADO_CAMBIAR', 'Permite activar o inactivar recetas del menu.'),
    ('MENU_SALSAS_VER', 'Permite ver el submodulo de salsas del menu.'),
    ('MENU_SALSAS_CREAR', 'Permite crear salsas del menu.'),
    ('MENU_SALSAS_EDITAR', 'Permite editar salsas y configuraciones por receta.'),
    ('MENU_SALSAS_ESTADO_CAMBIAR', 'Permite activar o inactivar salsas del menu.'),
    ('MENU_PUBLICACION_VER', 'Permite ver la publicacion de menu por sucursal.'),
    ('MENU_PUBLICACION_GUARDAR', 'Permite guardar publicacion de menu por sucursal.'),
    ('MENU_TEMPORADA_CREAR', 'Permite crear menus de temporada.')
) AS v(nombre_permiso, descripcion)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.permisos p
  WHERE UPPER(TRIM(p.nombre_permiso)) = UPPER(TRIM(v.nombre_permiso))
);

-- 2) Completar descripcion si existe permiso sin descripcion.
UPDATE public.permisos AS p
SET descripcion = v.descripcion
FROM (
  VALUES
    ('MENU_RECETAS_VER', 'Permite ver el submodulo de recetas del menu.'),
    ('MENU_RECETAS_CREAR', 'Permite crear recetas del menu.'),
    ('MENU_RECETAS_EDITAR', 'Permite editar recetas del menu.'),
    ('MENU_RECETAS_ESTADO_CAMBIAR', 'Permite activar o inactivar recetas del menu.'),
    ('MENU_SALSAS_VER', 'Permite ver el submodulo de salsas del menu.'),
    ('MENU_SALSAS_CREAR', 'Permite crear salsas del menu.'),
    ('MENU_SALSAS_EDITAR', 'Permite editar salsas y configuraciones por receta.'),
    ('MENU_SALSAS_ESTADO_CAMBIAR', 'Permite activar o inactivar salsas del menu.'),
    ('MENU_PUBLICACION_VER', 'Permite ver la publicacion de menu por sucursal.'),
    ('MENU_PUBLICACION_GUARDAR', 'Permite guardar publicacion de menu por sucursal.'),
    ('MENU_TEMPORADA_CREAR', 'Permite crear menus de temporada.')
) AS v(nombre_permiso, descripcion)
WHERE UPPER(TRIM(p.nombre_permiso)) = UPPER(TRIM(v.nombre_permiso))
  AND COALESCE(NULLIF(TRIM(p.descripcion), ''), '') = '';

-- 3) Mejora opcional: codigo estable para tipo_departamento.
ALTER TABLE IF EXISTS public.tipo_departamento
ADD COLUMN IF NOT EXISTS codigo_departamento VARCHAR(80);

-- 4) Poblar codigo_departamento solo donde este vacio.
-- La tabla expone nombre_departamento; no asumimos otras columnas.
UPDATE public.tipo_departamento
SET codigo_departamento = UPPER(
  REGEXP_REPLACE(
    COALESCE(nombre_departamento, ''),
    '[^A-Za-z0-9]+',
    '_',
    'g'
  )
)
WHERE COALESCE(NULLIF(TRIM(codigo_departamento), ''), '') = '';

COMMIT;

-- NOTAS
-- 1) No asigna permisos a roles existentes automaticamente.
-- 2) No modifica nombre_permiso.
-- 3) Si la tabla permisos tiene una restriccion unica por nombre_permiso, este script sigue siendo seguro.
