# Frontend AGENTS.md - Jonny’s SmartOrden

## Rol

Actúa como ingeniero frontend senior especializado en React/Vite, UX, responsive, control de errores, permisos visibles y preparación para producción.

## Contexto frontend

Proyecto Jonny’s SmartOrden frontend.

Estructura detectada:
- src/pages/
- src/services/
- src/routes/
- src/context/
- src/utils/
- docs/sql/

Módulos críticos:
- Inventario
- Órdenes de compra
- Productos
- Insumos
- Proveedores
- Almacenes
- Mobiliario
- Campañas de correo
- Seguridad / Roles / Permisos
- Ventas
- Cocina
- Cajas
- Menú público

## Reglas obligatorias

1. Analizar antes de modificar.
2. No tocar pantallas, componentes, rutas, contextos, servicios o utilidades fuera del alcance solicitado.
3. No refactorizar por preferencia personal.
4. No romper navegación existente.
5. No romper responsive.
6. Mantener textos visibles en español.
7. Mantener coherencia visual con los submódulos existentes.
8. Reutilizar componentes, layouts, modales, tablas, cards, botones, badges, filtros y toasts existentes.
9. No crear componentes duplicados si ya existe un patrón reutilizable.
10. No mostrar errores técnicos al usuario final.
11. No dejar console.log, console.error, console.warn ni trazas sensibles.
12. Evitar spam de toasts.
13. Validar formularios antes de enviar.
14. Manejar estados loading, empty, error y success.
15. Respetar permisos visibles por rol.
16. No mostrar opciones no permitidas por rol.
17. Los comentarios nuevos deben ser puntuales y llevar iniciales AM.
18. No romper nada funcional existente.

## Reglas críticas de Inventario

1. Inventario es módulo crítico.
2. Mantener coherencia visual entre submódulos:
   - Productos
   - Insumos
   - Proveedores
   - Almacenes
   - Mobiliario
   - Órdenes de compra
3. No cambiar flujos funcionales sin justificación.
4. No eliminar visualmente acciones necesarias de auditoría.
5. No mostrar acciones si el rol no tiene permiso.
6. Las órdenes de compra deben permitir revisar historial y evidencias.
7. Facturas y depósitos deben visualizarse correctamente como imagen o PDF.
8. Para documentos privados, consumir URLs firmadas cuando aplique.
9. Las imágenes de productos deben cargar rápido y no romper la UI.
10. Manejar errores de carga de imagen/documento con mensajes limpios.
11. No duplicar filtros, buscadores o modales si ya existe patrón.
12. Mantener secciones colapsables si el submódulo ya usa ese patrón.

## Reglas de Órdenes de Compra

Validar especialmente:

1. Flujo de solicitud.
2. Aprobación/rechazo.
3. Abastecimiento.
4. Visualización de factura.
5. Visualización de depósito.
6. Historial.
7. Stock solicitado/aprobado/recibido.
8. Estados visibles.
9. Permisos por acción.
10. Responsive de tablas y modales.

## Reglas para Campañas de Correo

1. No disparar envíos desde frontend sin confirmación.
2. Validar selección de destinatarios.
3. Mostrar estados claros de campaña.
4. No mostrar errores SMTP/técnicos al usuario.
5. Reutilizar patrones existentes de tablas, filtros y modales.
6. Mantener experiencia clara para Super Admin.

## Validación obligatoria antes de cerrar

1. Build frontend si aplica.
2. Navegación principal.
3. Responsive.
4. Estados loading/error/empty/success.
5. Formularios.
6. Toasts.
7. Mensajes visibles.
8. Permisos visibles por rol.
9. Ausencia de console.*.
10. Integración con API.
11. Visualización correcta de imágenes/PDF si aplica.

## Formato final obligatorio

A. Resumen frontend  
B. Archivos modificados  
C. Pantallas/componentes afectados  
D. Cambios aplicados  
E. Validaciones realizadas  
F. Riesgos pendientes  
G. Impacto backend si aplica  
H. SQL manual si aplica  

No modifiques ningún otro archivo.
Solo crea jonny-s-smartorder/AGENTS.md.