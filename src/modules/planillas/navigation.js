export const PLANILLAS_PARENT_TAB_KEY = 'planillas';
export const PLANILLAS_NAV_QUERY_PARAM = 'planillasTab';

export const PLANILLAS_NAV_TAB_KEYS = Object.freeze({
  pagoPlanilla: 'pago-planilla',
  horasExtras: 'horas-extras',
  adelantosSalario: 'adelantos-salario',
  bonosDeducciones: 'bonos-deducciones'
});

export const PLANILLAS_NAV_TABS = Object.freeze([
  {
    key: PLANILLAS_NAV_TAB_KEYS.pagoPlanilla,
    label: 'Pago de planilla',
    icon: 'bi bi-cash-stack'
  },
  {
    key: PLANILLAS_NAV_TAB_KEYS.bonosDeducciones,
    label: 'Bonos y deducciones',
    icon: 'bi bi-receipt'
  },
  {
    key: PLANILLAS_NAV_TAB_KEYS.adelantosSalario,
    label: 'Adelantos de salario',
    icon: 'bi bi-wallet2'
  },
  {
    key: PLANILLAS_NAV_TAB_KEYS.horasExtras,
    label: 'Horas extras',
    icon: 'bi bi-clock-history'
  }
]);

export const PLANILLAS_DEFAULT_NAV_TAB = PLANILLAS_NAV_TABS[0].key;

const PLANILLAS_ALLOWED_TABS = new Set(PLANILLAS_NAV_TABS.map((tab) => tab.key));

export const resolvePlanillasNavTab = (value, fallback = PLANILLAS_DEFAULT_NAV_TAB) => {
  const normalized = String(value || '').trim().toLowerCase();
  return PLANILLAS_ALLOWED_TABS.has(normalized) ? normalized : fallback;
};

export const isPlanillasContext = (pathname = '', search = '') => {
  if (!String(pathname || '').startsWith('/dashboard/personas')) return false;
  const params = new URLSearchParams(search || '');
  return String(params.get('tab') || '').trim().toLowerCase() === PLANILLAS_PARENT_TAB_KEY;
};
