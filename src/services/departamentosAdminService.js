import { apiFetch } from './api';
import {
  buildDepartamentoPayload,
  normalizeDepartamentoForForm,
  parseBoolean
} from '../pages/dashboard/menu/utils/departamentosAdminUtils';

const BASE_ENDPOINT = '/tipo_departamento';
const ID_FIELD = 'id_tipo_departamento';
const EDITABLE_FIELDS = ['nombre_departamento', 'descripcion', 'codigo_departamento', 'orden_menu', 'estado'];

const sameValue = (field, a, b) => {
  if (field === 'estado') return parseBoolean(a) === parseBoolean(b);
  if (field === 'orden_menu') return Number(a || 0) === Number(b || 0);
  return String(a ?? '').trim() === String(b ?? '').trim();
};

const buildChangedFields = (original, edited) => {
  const normalizedOriginal = normalizeDepartamentoForForm(original || {});
  const payload = buildDepartamentoPayload(edited || {});

  return EDITABLE_FIELDS
    .filter((field) => !sameValue(field, normalizedOriginal[field], payload[field]))
    .map((field) => ({ field, value: payload[field] }));
};

const updateField = (id, field, value) =>
  apiFetch(BASE_ENDPOINT, 'PUT', {
    campo: field,
    valor: value,
    id_campo: ID_FIELD,
    id_valor: id
  });

const departamentosAdminService = {
  listarDepartamentos: async () => apiFetch(BASE_ENDPOINT, 'GET', null, { noCache: true }),

  crearDepartamento: async (form) => apiFetch(BASE_ENDPOINT, 'POST', buildDepartamentoPayload(form)),

  actualizarDepartamento: async (id, original, edited) => {
    const parsedId = Number.parseInt(String(id ?? ''), 10);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new Error('ID de departamento invalido.');
    }

    const changes = buildChangedFields(original, edited);
    for (const change of changes) {
      await updateField(parsedId, change.field, change.value);
    }

    return {
      message: changes.length > 0
        ? 'Departamento actualizado correctamente.'
        : 'No hay cambios para guardar.',
      changedFields: changes.map((change) => change.field)
    };
  },

  cambiarEstadoDepartamento: async (id, estado) => updateField(id, 'estado', Boolean(estado))
};

export default departamentosAdminService;
