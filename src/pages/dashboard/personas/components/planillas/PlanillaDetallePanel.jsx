import PlanillasModalActions from './PlanillasModalActions';
import PlanillasModalLayout from './PlanillasModalLayout';

const toText = (value, fallback = 'Sin dato') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const money = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const moneyNumber = (value) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const resolveDni = (item = {}) =>
  toText(
    item?.dni ||
      item?.persona_dni ||
      item?.dni_persona ||
      item?.numero_dni ||
      item?.identidad ||
      item?.no_identidad ||
      item?.documento_identidad ||
      item?.documento ||
      item?.cedula,
    'Sin DNI'
  );

const buildEmpleadoMeta = (item = {}) => {
  const dni = resolveDni(item);
  const cargo = toText(item?.cargo, 'Sin cargo');
  return `${cargo} - ${dni}`;
};

const resolveEstadoBadge = (estadoRaw) => {
  const normalized = String(estadoRaw ?? '').trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('anulad')) {
    return null;
  }
  if (normalized.includes('pagad')) {
    return { label: 'Pagada', tone: 'pagada' };
  }
  if (normalized.includes('calcul') || normalized.includes('cerrad')) {
    return { label: 'Calculada', tone: 'calculada' };
  }
  if (normalized.includes('borrad') || normalized.includes('abiert')) {
    return { label: 'Borrador', tone: 'borrador' };
  }

  return {
    label: toText(estadoRaw, 'Estado'),
    tone: 'default'
  };
};

const buildDetailSections = (item) => [
  {
    title: 'Datos del empleado',
    fields: [
      { label: 'DNI', value: resolveDni(item) },
      { label: 'Cargo', value: toText(item.cargo, 'Sin cargo') },
      { label: 'Salario base', value: money(item.salario_base), tone: 'salario' },
      { label: 'Horas extra tiempo', value: toText(item.he_tiempo ?? item.horas_extra_tiempo, '0') }
    ]
  },
  {
    title: 'Totales en planilla',
    fields: [
      { label: 'Bonos', value: money(item.total_bonos ?? item.bonos), tone: 'bonos' },
      { label: 'Deducciones', value: money(item.total_deducciones ?? item.deducciones), tone: 'deducciones' },
      { label: 'Adelantos', value: money(item.total_adelantos_aplicados ?? item.adelantos), tone: 'adelantos' },
      { label: 'Neto a pagar', value: money(item.neto_pagar ?? item.total_neto_pagar ?? item.neto), tone: 'neto' }
    ]
  }
];

export default function PlanillaDetallePanel({ open, item, onClose, planillaEstado = '' }) {
  if (!open || !item) return null;

  const nombre =
    item.nombre_completo ||
    item.empleado_nombre ||
    item.nombre_empleado ||
    `${item.nombre || ''} ${item.apellido || ''}`.trim();

  const salarioBase = moneyNumber(item.salario_base);
  const bonos = moneyNumber(item.total_bonos ?? item.bonos);
  const deducciones = moneyNumber(item.total_deducciones ?? item.deducciones);
  const adelantos = moneyNumber(item.total_adelantos_aplicados ?? item.adelantos);
  const neto = moneyNumber(item.neto_pagar ?? item.total_neto_pagar ?? item.neto);

  const avatarLetter = String(toText(nombre, 'Empleado').charAt(0) || 'E').toUpperCase();
  const empleadoMeta = buildEmpleadoMeta(item);
  const estadoBadge = resolveEstadoBadge(planillaEstado);

  const sections = buildDetailSections(item);

  return (
    <PlanillasModalLayout
      open={open}
      onClose={onClose}
      title="Detalle de empleado en planilla"
      subtitle={toText(nombre, 'Empleado sin nombre')}
      size="lg"
      className="planillas-modal-shell--detalle"
      actions={<PlanillasModalActions onCancel={onClose} cancelLabel="Cerrar" hidePrimary />}
    >
      <div className="planillas-detail-panel">
        <section className="planillas-detail-panel__hero" aria-label="Resumen del empleado">
          <span className="planillas-detail-panel__avatar" aria-hidden="true">
            {avatarLetter}
          </span>
          <div className="planillas-detail-panel__hero-copy">
            <div className="planillas-detail-panel__hero-topline">
              <span className="planillas-detail-panel__hero-eyebrow">Resumen de colaborador</span>
              {estadoBadge ? (
                <span
                  className={`planillas-detail-panel__estado-badge is-${estadoBadge.tone}`}
                  title={`Estado de planilla: ${estadoBadge.label}`}
                >
                  {estadoBadge.label}
                </span>
              ) : null}
            </div>
            <strong className="planillas-detail-panel__hero-name">{toText(nombre, 'Empleado sin nombre')}</strong>
            <span className="planillas-detail-panel__hero-meta">{empleadoMeta}</span>
          </div>
          <div className="planillas-detail-panel__hero-neto">
            <span className="planillas-detail-panel__hero-neto-label">Neto actual</span>
            <strong>{money(neto)}</strong>
          </div>
        </section>

        {sections.map((section) => (
          <section key={section.title} className="planillas-detail-panel__section">
            <h6 className="planillas-detail-panel__section-title">{section.title}</h6>
            <div className="planillas-detail-panel__grid">
              {section.fields.map((field) => (
                <article
                  key={`${section.title}-${field.label}`}
                  className={`planillas-detail-panel__card ${field.tone ? `is-${field.tone}` : ''}`}
                >
                  <span className="planillas-detail-panel__label">{field.label}</span>
                  <strong className="planillas-detail-panel__value">{field.value}</strong>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section className="planillas-detail-panel__formula" aria-label="Formula de calculo">
          <h6 className="planillas-detail-panel__section-title">Formula de calculo</h6>
          <div className="planillas-detail-panel__formula-grid">
            <article className="planillas-detail-panel__formula-item is-positive">
              <span>Salario base</span>
              <strong>{money(salarioBase)}</strong>
            </article>
            <article className="planillas-detail-panel__formula-item is-positive">
              <span>+ Bonos</span>
              <strong>{money(bonos)}</strong>
            </article>
            <article className="planillas-detail-panel__formula-item is-negative">
              <span>- Deducciones</span>
              <strong>{money(deducciones)}</strong>
            </article>
            <article className="planillas-detail-panel__formula-item is-negative">
              <span>- Adelantos</span>
              <strong>{money(adelantos)}</strong>
            </article>
            <article className="planillas-detail-panel__formula-item is-result">
              <span>= Neto a pagar</span>
              <strong>{money(neto)}</strong>
            </article>
          </div>
        </section>
      </div>
    </PlanillasModalLayout>
  );
}
