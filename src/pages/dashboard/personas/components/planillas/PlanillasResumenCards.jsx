import SummaryCard from './SummaryCard';

const formatMoney = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PlanillasResumenCards({ resumen = {}, cardKeys = null, customCards = null }) {
  const baseCards = [
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

  const cards = Array.isArray(customCards) && customCards.length > 0
    ? customCards.map((card, index) => ({
      key: card?.key || `custom-${index}`,
      iconClass: card?.iconClass || 'bi-graph-up',
      label: String(card?.label ?? ''),
      value: String(card?.value ?? '0'),
      accent: card?.accent || 'default',
      isNet: Boolean(card?.isNet)
    }))
    : baseCards;

  const allowedKeys = Array.isArray(cardKeys) && cardKeys.length > 0 ? new Set(cardKeys) : null;
  const visibleCards = allowedKeys ? cards.filter((card) => allowedKeys.has(card.key)) : cards;
  const dynamicColumns = Math.max(1, visibleCards.length);

  return (
    <div
      className="planillas-resumen-cards"
      role="list"
      aria-label="Resumen financiero de planilla"
      style={{ '--planillas-resumen-columns': dynamicColumns }}
    >
      {visibleCards.map((card) => (
        <SummaryCard
          key={card.key}
          iconClass={card.iconClass}
          label={card.label}
          value={card.value}
          accent={card.accent}
          isNet={Boolean(card.isNet || card.key === 'neto')}
        />
      ))}
    </div>
  );
}
