# Fase 7 - QA Menu y Personas

## Menu

- Crear receta nueva.
- Editar receta existente.
- Activar e inactivar receta.
- Ver nombre legible del departamento en cards y lista.
- Crear salsa nueva.
- Editar salsa existente.
- Filtrar salsas por estado.
- Filtrar salsas por nivel picante.
- Guardar salsas por receta con reglas validas.
- Intentar guardar reglas con rangos traslapados.
- Intentar guardar reglas con mas salsas requeridas que salsas permitidas.
- Publicacion por sucursal: cargar sucursal activa.
- Publicacion por sucursal: guardar cambios de visible, precio y orden.
- Crear menu de temporada.
- Activar menu por sucursal.
- Probar vista publica/POS sin errores de permisos.

## Personas

- Crear cliente persona.
- Crear cliente empresa.
- Confirmar que puntos no llegan editables desde el frontend.
- Confirmar que tipo cliente General y fecha de ingreso se manejan por backend.
- Crear empleado con persona vinculada.
- Validar que sucursal sea obligatoria.
- Validar que cargo exista o se indique correctamente.
- Editar empleado y cambiar cargo.
- Abrir modal catalogo de cargos y buscar por nombre o descripcion.
- Crear usuario empleado.
- Crear usuario cliente.
- Confirmar que no se permita usuario ambiguo con empleado y cliente a la vez.
- Confirmar que no se permita usuario sin rol.
- Abrir roles y permisos.
- Buscar permisos por nombre tecnico, titulo amigable y descripcion.

## Seguridad y permisos

- Usuario con solo `MENU_VER` entra al modulo Menu.
- Usuario con permisos granulares de recetas puede crear/editar/estado segun corresponda.
- Usuario con permisos granulares de salsas puede crear/editar/estado segun corresponda.
- Usuario con permiso de publicacion puede ver sin necesidad de crear menu temporada.
- Usuario sin permiso de mutacion no debe ver o usar acciones criticas en frontend.
- Confirmar que backend responda 403 y no 500 cuando falte permiso.

## Estabilidad

- Sin errores 500 en backend.
- Sin errores de render React.
- Sin pantallas blancas.
- Sin `console.*` nuevos agregados por esta fase.
- Build frontend exitoso.
- Sintaxis backend valida en archivos tocados.
- Responsive correcto en desktop y movil para Menu Salsas, Recetas y modal de cargos.
