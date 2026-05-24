import { useEffect, useMemo, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import { personaService } from '../../../../services/personasService';
import {
  buildPersonaPayloadFromForm,
  createInitialPersonaForm,
  digitsOnly as digitsOnlyPersona,
  formatDNI,
  formatPhone as formatPersonaPhone,
  limit as limitPersonaDigits,
  normalizeHumanNameInput,
  validatePersonaForm
} from '../../personas/components/common/persona-form-shared';
import {
  buildEmpresaPayloadFromForm,
  createInitialEmpresaForm,
  digitsOnly as digitsOnlyEmpresa,
  formatPhone as formatEmpresaPhone,
  formatRtn,
  limitText as limitEmpresaDigits,
  validateEmpresaForm
} from '../../personas/components/common/empresa-form-shared';

const splitInitialName = (value) => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nombre: parts[0] || '', apellido: '' };
  return {
    nombre: parts.slice(0, -1).join(' '),
    apellido: parts[parts.length - 1]
  };
};

const extractPositiveId = (value, keys = []) => {
  if (!value || typeof value !== 'object') return null;
  const sources = [
    value,
    value.data,
    value.cliente,
    value.data?.cliente,
    value.result,
    value.resultado
  ].filter(Boolean);

  for (const source of sources) {
    for (const key of keys) {
      const parsed = Number.parseInt(String(source?.[key] ?? ''), 10);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
};

const normalizeText = (value) => String(value || '').trim();

export default function ClienteQuickCreateModal({
  open,
  initialSearch = '',
  idSucursal,
  onClose,
  onCreated
}) {
  const initialPersona = useMemo(() => {
    const split = splitInitialName(initialSearch);
    return {
      ...createInitialPersonaForm(),
      nombre: normalizeHumanNameInput(split.nombre),
      apellido: normalizeHumanNameInput(split.apellido)
    };
  }, [initialSearch]);
  const initialEmpresa = useMemo(() => ({
    ...createInitialEmpresaForm(),
    nombre_empresa: normalizeText(initialSearch)
  }), [initialSearch]);

  const [tipo, setTipo] = useState('persona');
  const [personaForm, setPersonaForm] = useState(initialPersona);
  const [empresaForm, setEmpresaForm] = useState(initialEmpresa);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTipo('persona');
    setPersonaForm(initialPersona);
    setEmpresaForm(initialEmpresa);
    setErrors({});
    setSubmitError('');
  }, [initialEmpresa, initialPersona, open]);

  if (!open) return null;

  const updatePersona = (field, value) => {
    setPersonaForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError('');
  };

  const updateEmpresa = (field, value) => {
    setEmpresaForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const validationErrors = tipo === 'empresa'
      ? validateEmpresaForm(empresaForm)
      : validatePersonaForm(personaForm);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const parsedSucursalId = Number.parseInt(String(idSucursal || ''), 10);
    if (!Number.isInteger(parsedSucursalId) || parsedSucursalId <= 0) {
      setSubmitError('Selecciona una sucursal antes de crear el cliente.');
      return;
    }

    setSaving(true);
    setSubmitError('');
    try {
      const clientePayload = {
        id_persona: null,
        id_empresa: null,
        id_empresa_cliente: null,
        id_sucursal: parsedSucursalId,
        estado: true
      };
      const payload = {
        origen: tipo,
        strict_base_create: true,
        id_sucursal: parsedSucursalId,
        cliente: clientePayload,
        ...(tipo === 'empresa'
          ? { empresa: buildEmpresaPayloadFromForm(empresaForm) }
          : { persona: buildPersonaPayloadFromForm(personaForm) })
      };

      const response = await personaService.createClienteFull(payload);
      const idCliente = extractPositiveId(response, ['id_cliente', 'cliente_id', 'id']);
      const label = tipo === 'empresa'
        ? normalizeText(empresaForm.nombre_empresa)
        : normalizeText(`${personaForm.nombre} ${personaForm.apellido}`);
      await onCreated?.({ id_cliente: idCliente, label, response });
    } catch (error) {
      setSubmitError(error?.message || 'No se pudo crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ventas-modal-backdrop ventas-cliente-quick-backdrop" role="presentation">
      <form
        className="ventas-modal-card ventas-cliente-quick-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-cliente-quick-title"
        onSubmit={handleSubmit}
      >
        <header className="ventas-modal-header ventas-cliente-quick-modal__header">
          <div>
            <h5 id="ventas-cliente-quick-title">Crear cliente</h5>
            <p>Registra el cliente sin salir de ventas.</p>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} disabled={saving} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="ventas-modal-body ventas-cliente-quick-modal__body">
          <AppSelect
            label="Tipo"
            value={tipo}
            options={[
              { value: 'persona', label: 'Individual' },
              { value: 'empresa', label: 'Empresa' }
            ]}
            onChange={setTipo}
            className="app-select--compact app-select--warm"
          />

          {tipo === 'persona' ? (
            <div className="ventas-cliente-quick-modal__grid">
              <label className="ventas-create-modal__field">
                <span>Nombre</span>
                <input value={personaForm.nombre} onChange={(event) => updatePersona('nombre', normalizeHumanNameInput(event.target.value, { preserveTrailingSpace: true }))} />
                {errors.nombre ? <small className="ventas-cliente-quick-modal__error">{errors.nombre}</small> : null}
              </label>
              <label className="ventas-create-modal__field">
                <span>Apellido</span>
                <input value={personaForm.apellido} onChange={(event) => updatePersona('apellido', normalizeHumanNameInput(event.target.value, { preserveTrailingSpace: true }))} />
                {errors.apellido ? <small className="ventas-cliente-quick-modal__error">{errors.apellido}</small> : null}
              </label>
              <AppSelect
                label="Genero"
                value={personaForm.genero}
                options={[
                  { value: 'M', label: 'Masculino' },
                  { value: 'F', label: 'Femenino' }
                ]}
                onChange={(value) => updatePersona('genero', value)}
                error={errors.genero}
                className="app-select--compact app-select--warm"
              />
              <label className="ventas-create-modal__field">
                <span>Telefono</span>
                <input value={personaForm.id_telefono} onChange={(event) => updatePersona('id_telefono', formatPersonaPhone(limitPersonaDigits(digitsOnlyPersona(event.target.value), 8)))} />
                {errors.id_telefono ? <small className="ventas-cliente-quick-modal__error">{errors.id_telefono}</small> : null}
              </label>
              <label className="ventas-create-modal__field">
                <span>DNI</span>
                <input value={personaForm.dni} onChange={(event) => updatePersona('dni', formatDNI(limitPersonaDigits(digitsOnlyPersona(event.target.value), 13)))} />
                {errors.dni ? <small className="ventas-cliente-quick-modal__error">{errors.dni}</small> : null}
              </label>
              <label className="ventas-create-modal__field">
                <span>Correo</span>
                <input type="email" value={personaForm.id_correo} onChange={(event) => updatePersona('id_correo', event.target.value)} />
                {errors.id_correo ? <small className="ventas-cliente-quick-modal__error">{errors.id_correo}</small> : null}
              </label>
              <label className="ventas-create-modal__field ventas-cliente-quick-modal__wide">
                <span>Direccion</span>
                <input value={personaForm.id_direccion} onChange={(event) => updatePersona('id_direccion', event.target.value)} />
              </label>
            </div>
          ) : (
            <div className="ventas-cliente-quick-modal__grid">
              <label className="ventas-create-modal__field">
                <span>Razon social</span>
                <input value={empresaForm.nombre_empresa} onChange={(event) => updateEmpresa('nombre_empresa', event.target.value)} />
                {errors.nombre_empresa ? <small className="ventas-cliente-quick-modal__error">{errors.nombre_empresa}</small> : null}
              </label>
              <label className="ventas-create-modal__field">
                <span>RTN</span>
                <input value={empresaForm.rtn} onChange={(event) => updateEmpresa('rtn', formatRtn(event.target.value))} />
                {errors.rtn ? <small className="ventas-cliente-quick-modal__error">{errors.rtn}</small> : null}
              </label>
              <label className="ventas-create-modal__field">
                <span>Telefono</span>
                <input value={empresaForm.id_telefono} onChange={(event) => updateEmpresa('id_telefono', formatEmpresaPhone(limitEmpresaDigits(digitsOnlyEmpresa(event.target.value), 8)))} />
                {errors.id_telefono ? <small className="ventas-cliente-quick-modal__error">{errors.id_telefono}</small> : null}
              </label>
              <label className="ventas-create-modal__field">
                <span>Correo</span>
                <input type="email" value={empresaForm.id_correo} onChange={(event) => updateEmpresa('id_correo', event.target.value)} />
                {errors.id_correo ? <small className="ventas-cliente-quick-modal__error">{errors.id_correo}</small> : null}
              </label>
              <label className="ventas-create-modal__field ventas-cliente-quick-modal__wide">
                <span>Direccion</span>
                <input value={empresaForm.id_direccion} onChange={(event) => updateEmpresa('id_direccion', event.target.value)} />
              </label>
            </div>
          )}

          {submitError ? <div className="ventas-create-modal__error">{submitError}</div> : null}
        </div>

        <footer className="ventas-modal-footer ventas-cliente-quick-modal__footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creando...' : 'Crear cliente'}
          </button>
        </footer>
      </form>
    </div>
  );
}
