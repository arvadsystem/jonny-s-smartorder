import { apiFetch } from './api';
import {
  buildDepartamentoPayload,
  normalizeDepartamentoForForm,
  parseBoolean,
  toPositiveInteger
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

  return EDITABLE_FIELDS.reduce((changes, field) => {
    if (!sameValue(field, normalizedOriginal[field], payload[field])) {
      changes[field] = payload[field];
    }
    return changes;
  }, {});
};

const updateFields = (id, cambios) =>
  apiFetch(BASE_ENDPOINT, 'PUT', {
    id_campo: ID_FIELD,
    id_valor: id,
    cambios
  });

const departamentosAdminService = {
  listarDepartamentos: async () => apiFetch(BASE_ENDPOINT, 'GET', null, { noCache: true }),

  crearDepartamento: async (form) => apiFetch(BASE_ENDPOINT, 'POST', buildDepartamentoPayload(form)),

  actualizarDepartamento: async (id, original, edited) => {
    const parsedId = toPositiveInteger(id);
    if (parsedId === null) {
      throw new Error('ID de departamento invalido.');
    }

    const cambios = buildChangedFields(original, edited);
    const changedFields = Object.keys(cambios);
    if (changedFields.length === 0) {
      return {
        message: 'No hay cambios para guardar.',
        changedFields: []
      };
    }

    await updateFields(parsedId, cambios);
    return {
      message: 'Departamento actualizado correctamente.',
      changedFields
    };
  },

  cambiarEstadoDepartamento: async (id, estado) => {
    const parsedId = toPositiveInteger(id);
    if (parsedId === null) {
      throw new Error('ID de departamento invalido.');
    }
    return updateFields(parsedId, { estado: Boolean(estado) });
  }
};

export default departamentosAdminService;
