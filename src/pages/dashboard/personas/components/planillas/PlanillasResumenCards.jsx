import StatsCardsRow from '../../../../../components/ui/StatsCardsRow';

const formatMoney = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PlanillasResumenCards({ resumen = {} }) {
  const cards = [
    {
      key: 'salario_base',
      iconClass: 'bi-cash-stack',
      label: 'Total salario base',
      value: formatMoney(resumen.total_salario_base ?? resumen.salario_base_total),
      accent: 'default'
    },
    {
      key: 'bonos',
      iconClass: 'bi-plus-circle',
      label: 'Total bonos',
      value: formatMoney(resumen.total_bonos),
      accent: 'success'
    },
    {
      key: 'deducciones',
      iconClass: 'bi-dash-circle',
      label: 'Total deducciones',
      value: formatMoney(resumen.total_deducciones),
      accent: 'warning'
    },
    {
      key: 'adelantos',
      iconClass: 'bi-wallet2',
      label: 'Adelantos aplicados',
      value: formatMoney(resumen.total_adelantos_aplicados ?? resumen.total_adelantos),
      accent: 'warning'
    },
    {
      key: 'neto',
      iconClass: 'bi-coin',
      label: 'Neto a pagar',
      value: formatMoney(resumen.total_neto_pagar ?? resumen.total_neto),
      accent: 'success'
    }
  ];

  return (
    <StatsCardsRow
      cards={cards}
      className="planillas-resumen-cards"
      ariaLabel="Resumen financiero de planilla"
    />
  );
}
