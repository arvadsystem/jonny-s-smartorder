# Ventas Integration Map

Este mapa resume la integracion frontend de Ventas/Caja. Backend no fue tocado en esta fase.

## Servicio Frontend

Archivo fuente: `src/services/ventasService.js`.

Endpoints usados:

- `GET /ventas`
- `GET /ventas/buscar`
- `GET /ventas/:id`
- `POST /ventas/:id/reversiones`
- `GET /ventas/:id/reversiones`
- `POST /ventas`
- `POST /ventas/pedidos-pendientes`
- `GET /ventas/pedidos-pendientes`
- `POST /ventas/pedidos/:id/registrar-pago`
- `GET /ventas/catalogos/clientes`
- `GET /ventas/catalogos/recetas`
- `GET /ventas/catalogos/extras-permitidos`
- `GET /ventas/catalogos/descuentos`
- `GET /ventas/catalogos/tipos-descuento`
- `GET /ventas/catalogos/productos`
- `GET /ventas/catalogos/categorias`
- `GET /ventas/catalogos/tipo-departamento`
- `GET /ventas/descuentos-catalogos`
- `GET /ventas/descuentos-catalogos/:id`
- `POST /ventas/descuentos-catalogos`
- `PUT /ventas/descuentos-catalogos/:id`
- `PATCH /ventas/descuentos-catalogos/:id/estado`
- `GET /ventas/pedidos-menu`
- `POST /ventas/pedidos-menu/:id/confirmar-pago`
- `PUT /ventas/pedidos-menu/:id/estado`

## RPC Backend Detectadas

- `public.registrar_venta_pos_v1`
- `public.registrar_venta_pos_v2`

## Advertencia

No modificar estas RPC, transacciones, SQL ni rutas backend en esta fase. La modularizacion actual solo reorganiza utilidades frontend y mantiene los payloads existentes.
