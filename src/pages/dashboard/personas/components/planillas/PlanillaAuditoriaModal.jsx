import PlanillasModalActions from './PlanillasModalActions';
import PlanillasModalLayout from './PlanillasModalLayout';

const toText = (value, fallback = '-') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAuditDate = (value) => {
  const ts = toTimestamp(value);
  if (!ts) return toText(value, '-');
  return new Intl.DateTimeFormat('es-HN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(ts));
};

const resolveActionTone = (actionRaw) => {
  const action = String(actionRaw || '').toUpperCase();
  if (!action) return 'neutral';
  if (action.includes('ANULAR') || action.includes('ELIMIN')) return 'danger';
  if (action.includes('PAGAR')) return 'success';
  if (action.includes('RECALC') || action.includes('CALCUL') || action.includes('CERRAR')) return 'info';
  if (action.includes('GENER') || action.includes('CREAR') || action.includes('REGISTR')) return 'primary';
  if (action.includes('APLIC') || action.includes('ACTUALIZ')) return 'warning';
  return 'neutral';
};

const resolveActionIcon = (tone) => {
  if (tone === 'danger') return 'bi-shield-x';
  if (tone === 'success') return 'bi-check2-circle';
  if (tone === 'info') return 'bi-arrow-repeat';
  if (tone === 'primary') return 'bi-plus-circle';
  if (tone === 'warning') return 'bi-pencil-square';
  return 'bi-dot';
};

export default function PlanillaAuditoriaModal({
  open,
  loading = false,
  items = [],
  onClose
}) {
  if (!open) return null;

  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((row, idx) => {
      const action = toText(row.accion, 'Sin accion').toUpperCase();
      const tone = resolveActionTone(action);
      const fechaRaw = row.fecha_registro || row.fecha_hora || row.fecha;
      return {
        id: row.id_auditoria_planilla || row.id_bitacora || `audit-${idx}`,
        action,
        tone,
        icon: resolveActionIcon(tone),
        user: toText(row.usuario_accion || row.usuario || row.nombre_usuario, 'Sistema'),
        detail: toText(row.descripcion || row.detalle, 'Sin detalle'),
        fechaRaw,
        fechaLabel: formatAuditDate(fechaRaw),
        timestamp: toTimestamp(fechaRaw)
      };
    })
    .sort((left, right) => right.timestamp - left.timestamp);

  const totalEventos = normalizedItems.length;
  const usuariosUnicos = new Set(normalizedItems.map((entry) => String(entry.user || '').toLowerCase())).size;
  const ultimoEvento = normalizedItems[0]?.fechaLabel || '-';

  return (
    <PlanillasModalLayout
      open={open}
      onClose={onClose}
      title="Auditoria de planilla"
      subtitle="Eventos y cambios registrados"
      size="lg"
      className="planillas-modal-shell--auditoria"
      actions={<PlanillasModalActions onCancel={onClose} cancelLabel="Cerrar" hidePrimary />}
    >
      <div className="planillas-auditoria-modal">
        {loading ? (
          <div className="inv-catpro-loading planillas-auditoria-modal__loading" role="status">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Cargando auditoria...</span>
          </div>
        ) : normalizedItems.length === 0 ? (
          <div className="inv-catpro-empty planillas-auditoria-modal__empty">
            <div className="inv-catpro-empty-sub">No hay eventos de auditoria registrados.</div>
          </div>
        ) : (
          <div className="planillas-auditoria-modal__content">
            <div className="planillas-auditoria-modal__summary">
              <article className="planillas-auditoria-modal__summary-card">
                <span>Eventos</span>
                <strong>{totalEventos}</strong>
              </article>
              <article className="planillas-auditoria-modal__summary-card">
                <span>Usuarios</span>
                <strong>{usuariosUnicos}</strong>
              </article>
              <article className="planillas-auditoria-modal__summary-card">
                <span>Ultimo evento</span>
                <strong>{ultimoEvento}</strong>
              </article>
            </div>

            <div className="planillas-auditoria-modal__list" role="list" aria-label="Eventos de auditoria">
              {normalizedItems.map((entry) => (
                <article key={entry.id} className={`planillas-auditoria-modal__item is-${entry.tone}`} role="listitem">
                  <div className="planillas-auditoria-modal__item-top">
                    <span className={`planillas-auditoria-modal__chip is-${entry.tone}`}>
                      <i className={`bi ${entry.icon}`} aria-hidden="true" />
                      {entry.action}
                    </span>
                    <span className="planillas-auditoria-modal__time">
                      <i className="bi bi-clock-history" aria-hidden="true" />
                      {entry.fechaLabel}
                    </span>
                  </div>

                  <div className="planillas-auditoria-modal__meta">
                    <span>
                      <i className="bi bi-person-circle" aria-hidden="true" />
                      {entry.user}
                    </span>
                  </div>

                  <p className="planillas-auditoria-modal__detail">{entry.detail}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </PlanillasModalLayout>
  );
}
