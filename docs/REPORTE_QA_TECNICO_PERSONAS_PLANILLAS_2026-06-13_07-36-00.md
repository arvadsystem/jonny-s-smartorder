# Reporte QA Tecnico - Personas y Planillas

Fecha: 2026-06-13 07:37:30
Backend base URL: http://localhost:3001
Resultado global: FAIL

| ID | Prueba | Resultado | Evidencia |
|---|---|---|---|
| T1 | eslint alcance personas/permisos | FAIL | ExitCode 1 :: npx eslint src/utils/permissions.js src/services/personasService.js src/pages/dashboard/personas --max-warnings=0 |
| T2 | build frontend | PASS | npm run build |
| T3 | GET /status responde 200 | PASS | HTTP 200 :: http://localhost:3001/status :: {"status":"ok","db_time":{"now":"2026-06-13T13:37:28.997Z"}} |
| T4 | GET /personas sin sesion responde 401 | PASS | HTTP 401 :: http://localhost:3001/personas?page=1&limit=9 ::  |
| T5 | GET /usuarios/v2/list sin sesion responde 401 | PASS | HTTP 401 :: http://localhost:3001/usuarios/v2/list?page=1&limit=9 ::  |

Nota: este reporte cubre validaciones tecnicas automatizables (T1-T5).
Las pruebas funcionales manuales A-E deben registrarse en el acta de aceptacion.
