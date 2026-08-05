import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path) => readFileSync(resolve(path), 'utf8');
const dashboardService = read('src/pages/dashboard/inicio/services/dashboardSupabaseService.js');
const dashboardHook = read('src/pages/dashboard/inicio/hooks/useInicioDashboardData.js');
const cocinaHook = read('src/pages/dashboard/cocina/hooks/useCocina.js');
const pedidosView = read('src/pages/dashboard/ventas/components/PedidosView.jsx');

describe('frontera financiera del Data API', () => {
  it('dashboard no consulta pedidos ni ventas mediante Supabase', () => {
    assert.doesNotMatch(dashboardService, /pedidos_menu|ventas_pedidos_menu|ventas_resumen|getFinancialSummary/);
    assert.match(dashboardHook, /ventasService\.getPedidosMenu/);
    assert.match(dashboardHook, /ventasService\.list/);
  });

  it('Cocina y Pedidos no se suscriben a public.pedidos', () => {
    for (const source of [cocinaHook, pedidosView]) {
      assert.doesNotMatch(source, /postgres_changes/);
      assert.doesNotMatch(source, /table:\s*['"]pedidos['"]/);
    }
    assert.match(cocinaHook, /cocinaApi\.listPedidos/);
    assert.match(pedidosView, /ventasService\.getPedidosMenu/);
  });

  it('Cocina y Pedidos coordinan polling, timeout, visibilidad y limpieza', () => {
    for (const source of [cocinaHook, pedidosView]) {
      assert.match(source, /createPollingRequestCoordinator/);
      assert.match(source, /requestToken\.controller\.signal/);
      assert.match(source, /timeoutMs:/);
      assert.match(source, /document\.visibilityState === 'visible'/);
      assert.match(source, /document\.addEventListener\('visibilitychange'/);
      assert.match(source, /document\.removeEventListener\('visibilitychange'/);
      assert.match(source, /pollingCoordinatorRef\.current\.cancel\(\)/);
      assert.match(source, /getNextDelay\(\)/);
      assert.doesNotMatch(source, /setInterval\([^)]*(?:loadPedidos|pollBoard)/s);
    }
  });

  it('errores temporales no vacian el tablero vigente', () => {
    const cocinaCatch = cocinaHook.match(/catch \(loadError\) \{[\s\S]*?throw loadError;/)?.[0] || '';
    const pedidosCatch = pedidosView.match(/catch \(err\) \{[\s\S]*?\n\s*\} finally/)?.[0] || '';
    assert.doesNotMatch(cocinaCatch, /setPedidos\(\[\]\)/);
    assert.doesNotMatch(pedidosCatch, /commitPedidos\(\[\]\)/);
  });
});
