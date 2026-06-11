# AGENTS.md — Jonny's SmartOrder Frontend

## Repository context

Repository:

```text
arvadsystem/jonny-s-smartorder
```

This is the frontend for Jonny's SmartOrder.

Detected stack:

- React.
- Vite.
- JavaScript ES Modules.
- React Router.
- Bootstrap.
- Bootstrap Icons.
- Sass.
- Framer Motion.
- React Select.
- Supabase JS dependency exists.

Do not assume TypeScript.

## Real scripts

Use only scripts that exist in `package.json`:

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run qa:personas-planillas:smoke
```

## Important structure

Known important files and folders:

```text
src/App.jsx
src/services/api.js
src/services/ventasService.js
src/utils/constants.js
src/routes/
src/context/
src/hooks/
src/components/
src/pages/auth/
src/pages/dashboard/
src/pages/dashboard/ventas/
src/modules/ventas/
src/modules/public-menu/
vite.config.js
```

## Architecture rules

- Route changes must respect `src/App.jsx`.
- Protected dashboard routes must use existing route guards.
- Permission-aware screens must use existing permission utilities.
- API calls should go through existing service modules.
- General JSON API calls should use `apiFetch`.
- Do not bypass CSRF/cookie behavior.
- Do not break Vite proxy assumptions.
- Do not add direct Supabase calls unless the existing module already does it or the change is explicitly approved.

## API rules

`apiFetch` handles:

- Base API URL.
- JSON parsing.
- CSRF header for unsafe methods.
- `credentials: include`.
- Request timeout.
- Safe UI messages.
- 401 logout event.
- 403 CSRF/permission mapping.

Do not duplicate this logic in components.

## Sales module rules

The sales UI is critical.

Before changing sales/cash/order UI, inspect:

```text
src/pages/dashboard/Ventas.jsx
src/pages/dashboard/ventas/VentasPage.jsx
src/pages/dashboard/ventas/hooks/useVentas.js
src/services/ventasService.js
src/pages/dashboard/ventas/components/
src/pages/dashboard/ventas/utils/
src/modules/ventas/
```

Do not break:

- Direct sales.
- Pending orders.
- Payment registration.
- Discounts.
- Extras.
- Combos.
- Recipes.
- Products.
- Split bill.
- Ticket detail.
- Reversals.
- Cash session dependency.
- Kitchen visibility.

## UI rules

- Keep visual consistency with Bootstrap and existing cards, modals and tables.
- Do not introduce a new component library.
- Keep components focused.
- Use existing toast, alert and loading patterns.
- Always handle loading, error, empty and success states.
- Avoid large UI rewrites.

## State and hooks

- Keep hooks focused.
- Avoid stale closure bugs.
- Do not add effects without correct dependencies.
- Prefer extraction of pure helpers when a hook grows.
- Avoid mixing API, normalization, UI state and business decisions in one new block.

## Refactor rules

- Refactor only the requested area.
- Keep behavior.
- Avoid mass formatting.
- Do not rename public API fields.
- Do not move files unless imports are updated and verified.
- Prefer small extractions from large files.

## Supabase/database impact rules

If a frontend change depends on database fields:

- Check backend response first.
- Check backend SQL/service.
- Check actual table/column if available.
- Do not invent fields.
- Do not assume decimal support unless verified.
- Do not assume RLS protects the call.

## Verification

Preferred commands:

```bash
npm run lint
npm run build
```

For UI changes, also provide manual test steps.

Do not run repetitive checks in loops.

## Do not do

- Do not convert to TypeScript.
- Do not install new dependencies without approval.
- Do not bypass `apiFetch`.
- Do not expose technical database errors to the user.
- Do not hardcode production backend URLs.
- Do not break `credentials: include`.
- Do not break CSRF.
- Do not change API contracts silently.
- Do not touch unrelated modules.