import { useEffect, useState } from 'react';

const formatMoney = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const FORMATS = [
  { value: 'excel', title: 'Excel (CSV)', icon: 'bi-file-earmark-spreadsheet', helper: 'Descarga inmediata en CSV.' },
  { value: 'pdf', title: 'PDF', icon: 'bi-file-earmark-pdf', helper: 'Usa la vista imprimible para guardar PDF.' },
  { value: 'print', title: 'Imprimir', icon: 'bi-printer', helper: 'Abre la ficha para impresion directa.' }
];

const initialOptions = {
  format: 'excel',
  includeDetalle: true,
  includeMovimientos: false,
  includeCorreo: true
};

function ToggleOption({ checked, onChange, label, helper }) {
  return (
    <label className={`planillas-export__toggle ${checked ? 'is-on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="planillas-export__toggle-track" aria-hidden="true" />
      <span className="planillas-export__toggle-copy">
        <strong>{label}</strong>
        <small>{helper}</small>
      </span>
    </label>
  );
}

export default function ExportModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  resumen = {},
  planillaLabel = 'Planilla seleccionada'
}) {
  const [options, setOptions] = useState(initialOptions);

  useEffect(() => {
    if (!open) {
      setOptions(initialOptions);
    }
  }, [open]);

  if (!open) return null;

  const totalSalario = formatMoney(resumen.total_salario_base ?? resumen.salario_base_total ?? 0);
  const totalBonos = formatMoney(resumen.total_bonos ?? 0);
  const totalDeducciones = formatMoney(resumen.total_deducciones ?? 0);
  const totalNeto = formatMoney(resumen.total_neto_pagar ?? resumen.total_neto ?? 0);

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="planillas-modal planillas-export" onClick={(event) => event.stopPropagation()}>
        <div className="planillas-modal__head">
          <div>
            <h5>Exportar planilla</h5>
            <p>{planillaLabel}</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose} disabled={loading}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="planillas-export__formats" role="radiogroup" aria-label="Formato de exportacion">
          {FORMATS.map((format) => (
            <button
              key={format.value}
              type="button"
              className={`planillas-export__format ${options.format === format.value ? 'is-active' : ''}`}
              onClick={() => setOptions((prev) => ({ ...prev, format: format.value }))}
            >
              <i className={`bi ${format.icon}`} aria-hidden="true" />
              <strong>{format.title}</strong>
              <small>{format.helper}</small>
            </button>
          ))}
        </div>

        <div className="planillas-export__toggles">
          <ToggleOption
            checked={options.includeDetalle}
            onChange={(checked) => setOptions((prev) => ({ ...prev, includeDetalle: checked }))}
            label="Incluir detalle"
            helper="Agrega columnas de cada empleado en el archivo."
          />

          <ToggleOption
            checked={options.includeMovimientos}
            onChange={(checked) => setOptions((prev) => ({ ...prev, includeMovimientos: checked }))}
            label="Incluir movimientos"
            helper="Incluye bonos y deducciones registrados."
          />

          <ToggleOption
            checked={options.includeCorreo}
            onChange={(checked) => setOptions((prev) => ({ ...prev, includeCorreo: checked }))}
            label="Incluir correo"
            helper="Agrega correos de empleado cuando existan."
          />
        </div>

        <div className="planillas-export__summary">
          <div>
            <span>Total salario base</span>
            <strong>{totalSalario}</strong>
          </div>
          <div>
            <span>Total bonos</span>
            <strong>{totalBonos}</strong>
          </div>
          <div>
            <span>Total deducciones</span>
            <strong>{totalDeducciones}</strong>
          </div>
          <div>
            <span>Neto a pagar</span>
            <strong>{totalNeto}</strong>
          </div>
        </div>

        <div className="planillas-form-grid__actions">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSubmit?.(options)}
            disabled={loading}
          >
            {loading ? <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" /> : <i className="bi bi-download me-1" />}
            {loading ? 'Generando...' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  );
}
