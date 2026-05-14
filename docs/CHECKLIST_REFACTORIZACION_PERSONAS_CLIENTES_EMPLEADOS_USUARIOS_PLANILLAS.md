# Checklist de Pruebas - Refactorizacion Progresiva (Personas/Clientes/Empleados/Usuarios/Planillas)

## 1) Creacion unificada backend (`/full-create`)

- [ ] `POST /clientes/full-create` crea cliente de tipo persona en una sola transaccion.
- [ ] `POST /clientes/full-create` crea cliente de tipo empresa en una sola transaccion.
- [ ] `POST /empleados/full-create` crea persona + empleado en una sola transaccion.
- [ ] En error intermedio, no quedan registros huerfanos.
- [ ] Las respuestas incluyen `nombre_completo` (o alias canonico equivalente) cuando aplica.
- [ ] Endpoints legacy (`/clientes/atomico`, `/empleados/atomico`) siguen funcionando.

## 2) Modales multipaso frontend

- [ ] Clientes: paso 1 (tipo persona/empresa), paso 2 (datos base), paso 3 (datos cliente).
- [ ] Empleados: paso 1 (persona), paso 2 (datos empleado).
- [ ] No avanza el flujo con validaciones fallidas por paso.
- [ ] Se puede retroceder sin perder datos ya capturados.
- [ ] El alta final consume `createClienteFull` / `createEmpleadoFull` con fallback legacy.

## 3) Cards unificadas

- [ ] Card de cliente muestra nombre, tipo, telefono, correo y estado sin duplicidad.
- [ ] Card de empleado muestra nombre proveniente de persona.
- [ ] No aparece "Usuario sin nombre" en vistas de empleados derivadas de usuario.

## 4) Usuarios

- [ ] Listado de usuarios resuelve `nombre_completo` desde backend.
- [ ] Si no hay relacion valida, fallback controlado a `nombre_usuario`.
- [ ] Carga/edicion de imagen en usuarios conserva la misma estabilidad del flujo actual.
- [ ] Cards de usuarios mantienen consistencia visual con el modulo de personas.

## 5) Paginacion global (patron Inventario -> Almacenes)

- [ ] Clientes usa paginacion numerada con ventana visible y meta "Mostrando X-Y de Z".
- [ ] Empleados usa el mismo patron de paginacion.
- [ ] Usuarios usa el mismo patron de paginacion.
- [ ] Planillas usa el mismo patron para listado y detalle.
- [ ] Prev/Next y salto por numero respetan limites de pagina.

## 6) Planillas quincenales (compatibles con mensual)

- [ ] `tipo_periodo=mensual` funciona sin cambios respecto al flujo anterior.
- [ ] `tipo_periodo=quincenal` + `quincena=1` responde con metadatos de subperiodo.
- [ ] `tipo_periodo=quincenal` + `quincena=2` responde con metadatos de subperiodo.
- [ ] Parametros invalidos (`tipo_periodo`, `quincena`) devuelven error validado y consistente.
- [ ] UI permite seleccionar tipo de periodo y quincena.
- [ ] El comportamiento mensual no se rompe al no enviar parametros quincenales.

## 7) Clientes sin sucursal obligatoria

- [ ] Listado de clientes funciona sin enviar `id_sucursal`.
- [ ] Creacion de cliente funciona sin sucursal seleccionada.
- [ ] Edicion de cliente funciona sin sucursal seleccionada.
- [ ] Empleados/planillas mantienen su dependencia de sucursal donde corresponde.

## 8) Correccion critica "Usuario sin nombre"

- [ ] Usuarios de empleado muestran nombre completo correcto.
- [ ] Usuarios de cliente persona muestran nombre completo correcto.
- [ ] Usuarios de cliente empresa muestran nombre empresarial correcto.
- [ ] Usuarios sin relacion muestran fallback de `nombre_usuario` (no texto roto).

## 9) Seguridad y consistencia

- [ ] Backend valida campos obligatorios y tipos en endpoints intervenidos.
- [ ] Backend no confia en validaciones del frontend.
- [ ] Errores mantienen compatibilidad (`error/message`) y agregan contexto util cuando aplica.
- [ ] Flujos de creacion conservan transaccionalidad y rollback seguro.

## 10) Regresion integral

- [ ] Crear cliente persona (fin a fin).
- [ ] Crear cliente empresa (fin a fin).
- [ ] Crear empleado (fin a fin).
- [ ] Visualizar cards correctas en clientes, empleados y usuarios.
- [ ] Confirmar paginacion funcional en clientes, empleados, usuarios y planillas.
- [ ] Validar planilla quincenal Q1.
- [ ] Validar planilla quincenal Q2.
- [ ] Validar compatibilidad mensual sin quincena.
- [ ] Validar clientes sin sucursal.
- [ ] Validar usuarios con nombre correcto en todos los escenarios.
