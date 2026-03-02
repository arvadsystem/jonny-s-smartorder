# FASE 0 - Preparacion UI Refresh (Vite + React)

## A) Alcance de Fase 0

### Si incluye
- Levantar baseline funcional para un refactor visual incremental.
- Documentar rutas reales, tabs reales y puntos sensibles del shell UI.
- Definir checklist manual de no-regresion.
- Definir baseline ligera de performance y accesibilidad.
- Definir guardrails CSS para Fase 1 (Sidebar + Topbar + layout shell).

### No incluye
- Cambios de UI final.
- Cambios de contratos backend (endpoints, payloads, interceptores, auth flow).
- Renombrar rutas o mover/reestructurar router.
- Cambios de estructura de pantallas funcionales.
- Automatizacion de login con credenciales hardcodeadas.

## B) Checklist de "NO romper"

- [ ] Login en `/` carga y autentica sin errores visibles.
- [ ] Logout desde Topbar (`Navbar`) redirige a `/`.
- [ ] Logout desde `BottomNav` redirige a `/`.
- [ ] Todas las rutas de dashboard siguen navegando sin 404 local.
- [ ] Tabs por querystring siguen funcionando con `?tab=...`.
- [ ] Tabs invalidos hacen fallback correcto:
  - [ ] Inventario -> `categorias`
  - [ ] Seguridad -> `sesiones`
  - [ ] Personas -> `personas`
- [ ] `BottomNav` aparece y navega correctamente en viewport movil.
- [ ] Ruta protegida de seguridad respeta permiso (`SEGURIDAD_VER`) sin romper navegacion.

## C) Rutas reales a validar (fuente: `src/App.jsx`)

### Publica
- `/` -> `Login`

### Protegidas bajo `ProtectedRoute` + `DashboardLayout`
- `/dashboard` (index) -> `Inicio`
- `/dashboard/personas` -> `Personas`
- `/dashboard/sucursales` -> `Sucursales`
- `/dashboard/inventario` -> `Inventario`
- `/dashboard/ventas` -> `PaginaEnConstruccion("Ventas")`
- `/dashboard/parametros` -> `Parametros`
- `/dashboard/menu` -> `Menu`
- `/dashboard/seguridad` -> `Seguridad` (envuelta en `RequirePerm perm="SEGURIDAD_VER"`)
- `/dashboard/perfil` -> `Perfil`
- `/dashboard/configuracion` -> `PaginaEnConstruccion("Configuracion")`

### Comodin
- `*` -> redirecciona a `/`

### Tabs reales (fuente: `src/components/layout/Navbar.jsx`)

Las tabs se construyen con `navigate('/dashboard/<modulo>?tab=<key>')`.

- Inventario: `/dashboard/inventario?tab=<key>`
  - keys: `categorias`, `insumos`, `productos`, `almacenes`, `movimientos`, `alertas`
- Seguridad: `/dashboard/seguridad?tab=<key>`
  - keys: `sesiones`, `password`, `logins`
- Personas: `/dashboard/personas?tab=<key>`
  - keys: `personas`, `empresas`, `empleados`, `usuarios`, `clientes`

Confirmacion de fallback por pagina:
- `src/pages/dashboard/Inventario.jsx`: fallback `categorias`
- `src/pages/dashboard/Seguridad.jsx`: fallback `sesiones`
- `src/pages/dashboard/Personas.jsx`: fallback `personas`

## D) Checklist de pruebas manuales (pasos cortos y reproducibles)

Precondicion: backend/auth disponible para iniciar sesion.

1. Ejecutar `npm run dev`.
2. Abrir `/`.
3. Iniciar sesion con usuario valido.
4. Entrar a `/dashboard` y confirmar render de layout base (Sidebar + Topbar + contenido + BottomNav en movil).
5. Navegar por cada ruta protegida listada en la seccion C.
6. En `Inventario`, probar tabs por URL:
   - abrir `/dashboard/inventario?tab=categorias`
   - abrir `/dashboard/inventario?tab=foo` y confirmar fallback a `categorias`
7. En `Seguridad`, probar:
   - `/dashboard/seguridad?tab=sesiones`
   - `/dashboard/seguridad?tab=foo` y confirmar fallback a `sesiones`
8. En `Personas`, probar:
   - `/dashboard/personas?tab=usuarios`
   - `/dashboard/personas?tab=foo` y confirmar fallback a `personas`
9. Probar logout desde Topbar (perfil -> cerrar sesion) y validar redireccion a `/`.
10. Reingresar y probar logout desde `BottomNav` en viewport movil.
11. Validar `BottomNav` (movil) navegando al menos: Dashboard, Inventario (abre modal), Seguridad, Salir.

## E) Baseline performance (ligero)

## Lighthouse (Performance + Accessibility)

1. Ejecutar `npm run dev`.
2. En Chrome, abrir ruta objetivo ya autenticada (ejemplo: `/dashboard`, `/dashboard/inventario?tab=categorias`).
3. DevTools -> Lighthouse.
4. Seleccionar categorias: `Performance` y `Accessibility`.
5. Correr en modo `Navigation (Desktop)` y guardar resultados.

Metricas a anotar por ruta:
- Performance score
- Accessibility score
- FCP
- LCP
- INP
- CLS
- TBT
- Speed Index

## React Profiler (guia rapida)

1. DevTools -> pestana React -> Profiler.
2. Iniciar grabacion.
3. Navegar: `/dashboard` -> `Inventario` -> cambio de tabs -> `Personas` -> logout.
4. Detener grabacion.
5. Registrar:
- commits por interaccion
- componente(s) con mayor `render duration`
- re-renders repetitivos en shell (`DashboardLayout`, `Navbar`, `Sidebar`, `BottomNav`)

## F) Guardrails CSS para Fase 1

### Donde viven estilos del shell (paths reales)
- `src/components/layout/DashboardLayout.jsx` (importa `../../assets/styles/main.scss`)
- `src/components/layout/Sidebar.jsx`
- `src/components/layout/Navbar.jsx`
- `src/components/layout/BottomNav.jsx`
- `src/assets/styles/main.scss`
- `src/assets/styles/_layout.scss`
- `src/assets/styles/_sidebar.scss`
- `src/assets/styles/_navbar.scss`
- `src/assets/styles/_mobile.scss`
- `src/assets/styles/_legacy-main.scss` (alto alcance global)
- `src/components/layout/Navbar.css` (archivo existente; no importado por el shell actual)

### Riesgos actuales
- Bootstrap global (`bootstrap.min.css`) convive con SCSS global.
- Uso intensivo de `!important` en estilos de shell, con alta probabilidad de colisiones.
- `_legacy-main.scss` contiene reglas globales extensas (layout + inventario + overrides), riesgo de efectos secundarios fuera del shell.
- `src/index.css` tambien aplica reglas base globales sobre `body` y `#root`.

### Regla obligatoria para Fase 1
- Scopar cambios al shell (Sidebar/Topbar/layout) usando selectores contenedores existentes (`.sidebar-wrapper`, `.top-navbar`, `.main-content`, `.bottom-nav`) y evitar tocar estilos de contenido de modulos funcionales.

## Baseline visual (Opcion A - manual, sin dependencias)

Se usa opcion manual por seguridad (auth protegida y sin hardcode de credenciales).

### Viewport recomendado
- Desktop baseline: `1440 x 900`
- Movil baseline (para `BottomNav`): `390 x 844`

### Procedimiento de captura
1. Abrir ruta objetivo.
2. Esperar carga completa (sin spinners/toasts transitorios).
3. Capturar screenshot de pantalla completa.
4. Repetir en rutas clave:
- `/`
- `/dashboard`
- `/dashboard/inventario?tab=categorias`
- `/dashboard/personas?tab=personas`
- `/dashboard/seguridad?tab=sesiones` (si el usuario tiene permiso)

### Carpeta sugerida para guardar capturas
- `docs/ui-refresh/baseline/`

## Notas de inspeccion (Fase 0)

- Stack detectado:
  - Vite + React 19
  - `react-router-dom` (router declarado en `src/App.jsx`)
  - estado global por Context API (`AuthContext`, `PermisosContext`)
  - estilos con SCSS + Bootstrap
- `src/routes/AppRouter.jsx` existe pero esta vacio (longitud 0); no es el router operativo.
