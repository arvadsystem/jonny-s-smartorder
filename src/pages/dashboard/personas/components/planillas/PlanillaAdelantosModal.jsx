import { useEffect, useMemo, useState } from 'react';

const money = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const parsePositiveMoney = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export default function PlanillaAdelantosModal({
  open,
  item,
  adelantos = [],
  loading = false,
  applying = false,
  onClose,
  onApply
}) {
  const [selectedId, setSelectedId] = useState('');
  const [monto, setMonto] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectedId('');
    setMonto('');
  }, [open, item]);

  const selectedAdelanto = useMemo(
    () =>
      adelantos.find(
        (adelanto) => String(adelanto.id_adelanto_salario || adelanto.id_adelanto || '') === selectedId
      ) || null,
    [adelantos, selectedId]
  );

  if (!open || !item) return null;

  const handleApply = () => {
    if (!selectedAdelanto) return;
    const montoAplicar = parsePositiveMoney(monto);
    if (!montoAplicar) return;

    onApply?.({
      id_adelanto: selectedAdelanto.id_adelanto_salario || selectedAdelanto.id_adelanto,
      monto_aplicar: montoAplicar
    });
  };

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="planillas-modal planillas-modal--lg" onClick={(event) => event.stopPropagation()}>
        <div className="planillas-modal__head">
          <div>
            <h5>Aplicar adelanto</h5>
            <p>{item.nombre_completo || item.empleado_nombre || 'Empleado seleccionado'}</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {loading ? (
          <div className="inv-catpro-loading" role="status">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Cargando adelantos...</span>
          </div>
        ) : adelantos.length === 0 ? (
          <div className="inv-catpro-empty">
            <div className="inv-catpro-empty-sub">No hay adelantos aplicables para este empleado.</div>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th />
                    <th>Codigo</th>
                    <th>Saldo disponible</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {adelantos.map((adelanto) => {
                    const id =
                      String(adelanto.id_adelanto_salario || adelanto.id_adelanto || '').trim();
                    const saldo = adelanto.saldo_disponible ?? adelanto.saldo ?? adelanto.monto_pendiente;
                    return (
                      <tr key={id}>
                        <td>
                          <input
                            type="radio"
                            name="adelantoSeleccionado"
                            checked={selectedId === id}
                            onChange={() => {
                              setSelectedId(id);
                              setMonto(String(saldo ?? ''));
                            }}
                          />
                        </td>
                        <td>{adelanto.codigo_adelanto || `AD-${id}`}</td>
                        <td>{money(saldo)}</td>
                        <td>{adelanto.fecha || adelanto.fecha_registro || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="planillas-form-grid">
              <div>
                <label className="form-label">Monto a aplicar</label>
                <input
                  type="number"
                  className="form-control"
                  value={monto}
                  min="0.01"
                  step="0.01"
                  onChange={(event) => setMonto(event.target.value)}
                />
              </div>

              <div className="planillas-form-grid__actions">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={applying}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={applying || !selectedAdelanto || !parsePositiveMoney(monto)}
                  onClick={handleApply}
                >
                  {applying ? 'Aplicando...' : 'Aplicar adelanto'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
