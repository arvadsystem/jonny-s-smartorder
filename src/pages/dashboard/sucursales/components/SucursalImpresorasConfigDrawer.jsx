import { createPortal } from 'react-dom';
import AppSelect from '../../../../components/common/AppSelect';

const WIDTH_OPTIONS = [58, 80].map((width) => ({
  value: String(width),
  label: `${width}mm`
}));

const PRINTER_TITLES = {
  FACTURA: 'Impresora de factura',
  COCINA: 'Impresora de cocina'
};

const normalizeText = (value) => String(value ?? '').trim();

const buildErrors = (form = {}) => {
  const errors = {};
  const impresoras = Array.isArray(form?.impresoras) ? form.impresoras : [];

  for (const item of impresoras) {
    const tipo = String(item?.tipo_impresora || '').trim().toUpperCase();
    const ancho = Number(item?.ancho_mm);
    const nombre = normalizeText(item?.nombre_impresora_sistema);

    if (tipo && !['FACTURA', 'COCINA'].includes(tipo)) {
      errors[`${tipo}.tipo_impresora`] = 'Tipo de impresora invalido.';
    }
    if (![58, 80].includes(ancho)) {
      errors[`${tipo}.ancho_mm`] = 'Selecciona 58mm u 80mm.';
    }
    if (nombre.length > 160) {
      errors[`${tipo}.nombre_impresora_sistema`] = 'Usa un maximo de 160 caracteres.';
    }
  }

  return errors;
};

const toPayload = (form = {}) => ({
  impresoras: (Array.isArray(form?.impresoras) ? form.impresoras : []).map((item) => ({
    tipo_impresora: String(item?.tipo_impresora || '').trim().toUpperCase(),
    nombre_impresora_sistema: normalizeText(item?.nombre_impresora_sistema) || null,
    ancho_mm: Number(item?.ancho_mm ?? 80),
    activa: Boolean(item?.activa)
  }))
});

export default function SucursalImpresorasConfigDrawer({
  open,
  sucursalNombre = '',
  form,
  saving = false,
  onChange,
  onClose,
  onSubmit
}) {
  if (!open) return null;

  const errors = buildErrors(form);
  const impresoras = Array.isArray(form?.impresoras) ? form.impresoras : [];

  const handleSubmit = (event) => {
    event.preventDefault();
    if (Object.keys(errors).length > 0) return;
    onSubmit?.(toPayload(form));
  };

  const updatePrinter = (tipo, field, value) => {
    onChange?.(tipo, field, value);
  };

  return createPortal(
    <>
      <div
        className="inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop show"
        onClick={saving ? undefined : onClose}
        aria-hidden="true"
      />
      <aside
        className="inv-prod-drawer inv-cat-v2__drawer suc-filters-drawer suc-facturacion-drawer suc-printer-drawer show"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="inv-prod-drawer-head">
          <i className="bi bi-printer inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">Configurar impresoras</div>
            <div className="inv-prod-drawer-sub">{sucursalNombre || 'Sucursal'}</div>
          </div>
          <button type="button" className="inv-prod-drawer-close" onClick={onClose} disabled={saving} title="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="suc-facturacion-drawer__form" onSubmit={handleSubmit}>
          <div className="inv-prod-drawer-body inv-cat-v2__drawer-body suc-facturacion-drawer__body">
            <div className="inv-prod-pmodal__sections">
              <section className="inv-prod-pmodal__section">
                <div className="inv-prod-pmodal__section-title">Impresoras logicas</div>
                <div className="alert alert-info py-2 mb-0">
                  Define el nombre visible del dispositivo y el ancho de ticket para FACTURA y COCINA.
                </div>
              </section>

              {impresoras.map((item) => {
                const tipo = String(item?.tipo_impresora || '').trim().toUpperCase();
                const typeLabel = PRINTER_TITLES[tipo] || tipo;
                return (
                  <section className="inv-prod-pmodal__section" key={tipo}>
                    <div className="inv-prod-pmodal__section-title">{typeLabel}</div>
                    <div className="row g-3 mt-1">
                      <div className="col-12">
                        <label className="form-label">Nombre de impresora en el sistema</label>
                        <input
                          className={`form-control ${errors[`${tipo}.nombre_impresora_sistema`] ? 'is-invalid' : ''}`}
                          value={item?.nombre_impresora_sistema || ''}
                          onChange={(event) => updatePrinter(tipo, 'nombre_impresora_sistema', event.target.value)}
                          placeholder="Ejemplo: EPSON TM-T20III"
                        />
                        {errors[`${tipo}.nombre_impresora_sistema`] ? (
                          <div className="invalid-feedback">{errors[`${tipo}.nombre_impresora_sistema`]}</div>
                        ) : (
                          <div className="form-text">Dejalo vacio si el navegador elegira la impresora manualmente.</div>
                        )}
                      </div>

                      <div className="col-12">
                        <AppSelect
                          label="Ancho del ticket"
                          value={String(item?.ancho_mm ?? 80)}
                          options={WIDTH_OPTIONS}
                          onChange={(value) => updatePrinter(tipo, 'ancho_mm', Number(value))}
                          placeholder="Selecciona ancho"
                          error={errors[`${tipo}.ancho_mm`] || ''}
                          className="suc-app-select"
                        />
                      </div>

                      <div className="col-12">
                        <div className="form-check">
                          <input
                            id={`printer_${tipo}_activa`}
                            className="form-check-input"
                            type="checkbox"
                            checked={Boolean(item?.activa)}
                            onChange={(event) => updatePrinter(tipo, 'activa', event.target.checked)}
                          />
                          <label className="form-check-label" htmlFor={`printer_${tipo}_activa`}>
                            Impresora activa
                          </label>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          <div className="inv-prod-drawer-actions inv-cat-v2__drawer-actions suc-facturacion-drawer__actions">
            <button type="button" className="btn inv-prod-btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn inv-prod-btn-primary" disabled={saving || Object.keys(errors).length > 0}>
              {saving ? 'Guardando...' : 'Guardar impresoras'}
            </button>
          </div>
        </form>
      </aside>
    </>,
    document.body
  );
}
