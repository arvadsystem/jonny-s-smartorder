import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';

const initialState = {
  fecha: '',
  tipo: 'FERIADO',
  descripcion: '',
  cerrado: true,
  hora_inicio: '',
  hora_final: '',
  estado: true
};

export default function SucursalFechaEspecialModal({ open, onClose, onSubmit, saving = false, tipos = [], initialData = null }) {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (!initialData) {
      setForm(initialState);
      setError('');
      return;
    }
    setForm({
      fecha: initialData?.fecha ? String(initialData.fecha).slice(0, 10) : '',
      tipo: initialData?.tipo || 'FERIADO',
      descripcion: initialData?.descripcion || '',
      cerrado: Boolean(initialData?.cerrado),
      hora_inicio: initialData?.hora_inicio ? String(initialData.hora_inicio).slice(0, 5) : '',
      hora_final: initialData?.hora_final ? String(initialData.hora_final).slice(0, 5) : '',
      estado: initialData?.estado !== false
    });
    setError('');
  }, [initialData, open]);

  if (!open) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'cerrado' && checked) {
        next.hora_inicio = '';
        next.hora_final = '';
      }
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSubmit(form);
    } catch (err) {
      setError(String(err?.message || 'No se pudo guardar la fecha especial.'));
    }
  };

  return createPortal(
    <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!open}>
      <div className="inv-prod-pmodal__overlay" onClick={saving ? undefined : onClose} />
      <div className="inv-prod-pmodal__viewport">
        <div className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create suc-form-modal suc-fecha-especial-modal" role="dialog" aria-modal="true">
          <form className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create" onSubmit={submit}>
            <div className="inv-prod-pmodal__body">
              <div className="inv-ins-create-hero">
                <div className="inv-ins-create-hero__copy">
                  <div className="inv-ins-create-hero__eyebrow">Horarios</div>
                  <h3>{initialData ? 'Editar fecha especial' : 'Nueva fecha especial'}</h3>
                </div>
                <button type="button" className="inv-prod-drawer-close inv-ins-create-hero__close" onClick={onClose} disabled={saving}>
                  <i className="bi bi-x-lg" />
                </button>
              </div>

              {error ? <div className="alert alert-danger">{error}</div> : null}

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">Fecha</label>
                  <input className="form-control" type="date" name="fecha" value={form.fecha} onChange={handleChange} required />
                </div>
                <div className="col-12 col-md-6">
                  <AppSelect
                    label="Tipo"
                    value={form.tipo}
                    options={tipos.map((tipo) => ({ value: tipo, label: tipo }))}
                    onChange={(value) => handleChange({ target: { name: 'tipo', value } })}
                    placeholder="Selecciona un tipo"
                    className="suc-app-select"
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Descripcion</label>
                  <input className="form-control" name="descripcion" maxLength={200} value={form.descripcion} onChange={handleChange} />
                </div>
                <div className="col-12 col-md-4">
                  <div className="form-check mt-2">
                    <input className="form-check-input" id="cerrado" type="checkbox" name="cerrado" checked={form.cerrado} onChange={handleChange} />
                    <label className="form-check-label" htmlFor="cerrado">Cerrado</label>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">Hora inicio</label>
                  <input className="form-control" type="time" name="hora_inicio" value={form.hora_inicio} disabled={form.cerrado} onChange={handleChange} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">Hora final</label>
                  <input className="form-control" type="time" name="hora_final" value={form.hora_final} disabled={form.cerrado} onChange={handleChange} />
                </div>
                <div className="col-12">
                  <div className="form-check mt-1">
                    <input className="form-check-input" id="estado" type="checkbox" name="estado" checked={form.estado} onChange={handleChange} />
                    <label className="form-check-label" htmlFor="estado">Estado activo</label>
                  </div>
                </div>
              </div>
            </div>

            <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
              <button type="button" className="btn inv-prod-btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn inv-prod-btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
