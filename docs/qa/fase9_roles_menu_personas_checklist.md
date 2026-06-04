# Fase 9 - Validacion por rol real

## Roles a probar

- administrador
- super_admin
- root
- cajero
- cocina

## Menu

- `administrador`: debe entrar a Menu y operar Recetas, Salsas, Publicacion, Extras y Combos.
- `super_admin`: debe tener cobertura completa del modulo Menu.
- `root`: confirmar si usa RBAC normal o bypass interno; validar acceso real.
- `cajero`: no debe poder crear ni editar Recetas, Salsas, Publicacion, Extras ni Combos salvo que se le hayan dado permisos explicitamente.
- `cocina`: no debe ver ni operar Menu administrativo salvo grant explicito.

## Personas

- `administrador`: debe ver Clientes, Empleados, Usuarios, Roles/Permisos y Planillas segun baseline definido.
- `super_admin`: debe tener cobertura completa de Personas.
- `root`: confirmar si usa RBAC normal o bypass interno.
- `cajero`: validar que no pueda entrar a Empleados, Usuarios, Roles/Permisos ni Planillas si no tiene grants.
- `cocina`: validar que no tenga acceso a Personas salvo grant explicito.

## Seguridad funcional

- Un rol con solo `MENU_VER` debe seguir entrando al modulo Menu mientras exista compatibilidad temporal.
- Un rol con permisos granulares pero sin `MENU_VER` debe poder operar el submodulo si backend/frontend ya estan alineados.
- Si falta permiso especifico, debe responder 403 y no 500.
- El frontend debe ocultar o deshabilitar acciones de crear, editar o cambiar estado cuando corresponda.

## Extras y Combos

- Probar boton `Nuevo extra` con y sin `MENU_EXTRAS_CREAR`.
- Probar `Editar` con y sin `MENU_EXTRAS_EDITAR`.
- Probar `Activar/Inactivar` con y sin `MENU_EXTRAS_ESTADO_CAMBIAR`.
- Probar boton `Nuevo combo` con y sin `MENU_COMBOS_CREAR`.
- Probar `Editar combo` con y sin `MENU_COMBOS_EDITAR`.
- Probar `Activar/Inactivar combo` con y sin `MENU_COMBOS_ESTADO_CAMBIAR`.
- Probar agregar/quitar recetas del detalle con y sin `MENU_COMBOS_DETALLE_EDITAR`.

## POS y Departamentos

- Ver categorias y catalogo POS con `MENU_POS_VER`.
- Probar subida de archivo con `MENU_POS_ARCHIVOS_SUBIR`.
- Probar cambio de imagen de producto con `MENU_POS_PRODUCTOS_IMAGEN_EDITAR`.
- Probar cambio de imagen de combo con `MENU_POS_COMBOS_IMAGEN_EDITAR`.
- Probar soft-delete de archivo con `MENU_POS_ARCHIVOS_ELIMINAR`.
- Probar GET/POST/PUT/DELETE de `tipo_departamento` con permisos `MENU_DEPARTAMENTOS_*`.

## Resultado esperado

- Sin errores 500.
- Sin pantallas blancas.
- Sin acciones visibles que el backend rechace por falta de permiso sin razon aparente.
- Sin regresiones para usuarios legacy que aun dependen de `MENU_VER`.
