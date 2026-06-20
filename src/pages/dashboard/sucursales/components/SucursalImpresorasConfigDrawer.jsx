import { useState } from 'react';
import { createPortal } from 'react-dom';
import AppSelect from '../../../../components/common/AppSelect';
import qzPrintService from '../../../../services/qzPrintService';

const WIDTH_OPTIONS = [58, 80].map((width) => ({
  value: String(width),
  label: `${width}mm`
}));

const PRINT_MODE_OPTIONS = [
  {
    value: 'BROWSER',
    label: 'Navegador/manual',
    helperText: 'Usa el flujo actual del navegador.'
  },
  {
    value: 'QZ_HTML',
    label: 'QZ Tray HTML',
    helperText: 'Impresion directa HTML para ticket termico.'
  },
  {
    value: 'QZ_RAW',
    label: 'QZ Tray RAW',
    helperText: 'Reservado para ESC/POS directo.'
  }
];

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
    const ip = normalizeText(item?.ip_impresora);
    const modo = normalizeText(item?.modo_impresion).toUpperCase() || 'BROWSER';
    const puerto = Number(item?.puerto_impresora ?? 9100);

    if (tipo && !['FACTURA', 'COCINA'].includes(tipo)) {
      errors[`${tipo}.tipo_impresora`] = 'Tipo de impresora invalido.';
    }
    if (![58, 80].includes(ancho)) {
      errors[`${tipo}.ancho_mm`] = 'Selecciona 58mm u 80mm.';
    }
    if (!['BROWSER', 'QZ_HTML', 'QZ_RAW'].includes(modo)) {
      errors[`${tipo}.modo_impresion`] = 'Selecciona un modo de impresion valido.';
    }
    if (nombre.length > 160) {
      errors[`${tipo}.nombre_impresora_sistema`] = 'Usa un maximo de 160 caracteres.';
    }
    if (ip.length > 120) {
      errors[`${tipo}.ip_impresora`] = 'Usa un maximo de 120 caracteres.';
    }
    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
      errors[`${tipo}.puerto_impresora`] = 'El puerto debe estar entre 1 y 65535.';
    }
  }

  return errors;
};

const toPayload = (form = {}) => ({
  impresoras: (Array.isArray(form?.impresoras) ? form.impresoras : []).map((item) => ({
    tipo_impresora: String(item?.tipo_impresora || '').trim().toUpperCase(),
    nombre_impresora_sistema: normalizeText(item?.nombre_impresora_sistema) || null,
    ip_impresora: normalizeText(item?.ip_impresora) || null,
    puerto_impresora: Number(item?.puerto_impresora ?? 9100),
    ancho_mm: Number(item?.ancho_mm ?? 80),
    modo_impresion: normalizeText(item?.modo_impresion).toUpperCase() || 'BROWSER',
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
  const [detectingPrinters, setDetectingPrinters] = useState(false);
  const [detectedPrinters, setDetectedPrinters] = useState([]);
  const [detectError, setDetectError] = useState('');

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

  const handleDetectPrinters = async () => {
    setDetectingPrinters(true);
    setDetectError('');
    try {
      const response = await qzPrintService.testQzConnection();
      const printers = Array.isArray(response?.printers)
        ? response.printers.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      setDetectedPrinters(printers);
      if (printers.length === 0) {
        setDetectError('QZ Tray esta conectado, pero no devolvio impresoras disponibles.');
      }
    } catch (error) {
      setDetectedPrinters([]);
      setDetectError(error?.message || 'No se pudo conectar con QZ Tray para listar impresoras.');
    } finally {
      setDetectingPrinters(false);
    }
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
                  Configura FACTURA y COCINA por nombre exacto de impresora, modo de impresion y ancho del ticket.
                </div>
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={handleDetectPrinters}
                    disabled={saving || detectingPrinters}
                  >
                    <i className="bi bi-arrow-repeat me-1" />
                    {detectingPrinters ? 'Detectando...' : 'Detectar impresoras QZ'}
                  </button>
                  {detectedPrinters.length > 0 ? (
                    <span className="text-muted small align-self-center">
                      {detectedPrinters.length} impresora(s) detectada(s)
                    </span>
                  ) : null}
                </div>
                {detectError ? (
                  <div className="alert alert-warning py-2 mt-3 mb-0">{detectError}</div>
                ) : null}
              </section>

              {impresoras.map((item) => {
                const tipo = String(item?.tipo_impresora || '').trim().toUpperCase();
                const typeLabel = PRINTER_TITLES[tipo] || tipo;
                return (
                  <section className="inv-prod-pmodal__section" key={tipo}>
                    <div className="inv-prod-pmodal__section-title">{typeLabel}</div>
                    <div className="row g-3 mt-1">
                      <div className="col-12">
                        <AppSelect
                          label="Modo de impresion"
                          value={String(item?.modo_impresion || 'BROWSER')}
                          options={PRINT_MODE_OPTIONS}
                          onChange={(value) => updatePrinter(tipo, 'modo_impresion', value)}
                          placeholder="Selecciona modo"
                          error={errors[`${tipo}.modo_impresion`] || ''}
                          helperText="Usa BROWSER si aun no vas a imprimir con QZ Tray."
                          className="suc-app-select"
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label">Nombre de impresora en el sistema</label>
                        <input
                          className={`form-control ${errors[`${tipo}.nombre_impresora_sistema`] ? 'is-invalid' : ''}`}
                          value={item?.nombre_impresora_sistema || ''}
                          onChange={(event) => updatePrinter(tipo, 'nombre_impresora_sistema', event.target.value)}
                          placeholder="Ejemplo: POS-80C"
                        />
                        {errors[`${tipo}.nombre_impresora_sistema`] ? (
                          <div className="invalid-feedback">{errors[`${tipo}.nombre_impresora_sistema`]}</div>
                        ) : (
                          <div className="form-text">Usa el nombre exacto que devuelve QZ Tray. Dejalo vacio si el navegador elegira la impresora manualmente.</div>
                        )}
                      </div>

                      {detectedPrinters.length > 0 ? (
                        <div className="col-12">
                          <label className="form-label">Impresoras detectadas</label>
                          <div className="d-flex flex-wrap gap-2">
                            {detectedPrinters.map((printerName) => (
                              <button
                                key={`${tipo}-${printerName}`}
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => updatePrinter(tipo, 'nombre_impresora_sistema', printerName)}
                                disabled={saving}
                              >
                                {printerName}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

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

                      <div className="col-12 col-md-7">
                        <label className="form-label">IP de impresora</label>
                        <input
                          className={`form-control ${errors[`${tipo}.ip_impresora`] ? 'is-invalid' : ''}`}
                          value={item?.ip_impresora || ''}
                          onChange={(event) => updatePrinter(tipo, 'ip_impresora', event.target.value)}
                          placeholder="Ejemplo: 192.168.1.3"
                        />
                        {errors[`${tipo}.ip_impresora`] ? (
                          <div className="invalid-feedback">{errors[`${tipo}.ip_impresora`]}</div>
                        ) : (
                          <div className="form-text">Opcional. Se guarda como referencia para soporte y futuras impresiones RAW o por red.</div>
                        )}
                      </div>

                      <div className="col-12 col-md-5">
                        <label className="form-label">Puerto</label>
                        <input
                          type="number"
                          min="1"
                          max="65535"
                          className={`form-control ${errors[`${tipo}.puerto_impresora`] ? 'is-invalid' : ''}`}
                          value={Number(item?.puerto_impresora ?? 9100)}
                          onChange={(event) => updatePrinter(tipo, 'puerto_impresora', Number(event.target.value || 9100))}
                          placeholder="9100"
                        />
                        {errors[`${tipo}.puerto_impresora`] ? (
                          <div className="invalid-feedback">{errors[`${tipo}.puerto_impresora`]}</div>
                        ) : (
                          <div className="form-text">9100 es el valor recomendado para impresoras termicas en red.</div>
                        )}
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
