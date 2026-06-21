import { createConsumidorFinalCliente } from '../../../../modules/ventas/constants/ventasDefaults';
import { normalizeClienteOption } from './ventasHelpers';

export const mergeVentasClienteCatalogOption = (currentClientes, rawCliente) => {
  const option = normalizeClienteOption(rawCliente);
  if (!option?.value || option.es_consumidor_final) {
    return { option: null, clientes: Array.isArray(currentClientes) ? currentClientes : [] };
  }
  const withoutDuplicate = (Array.isArray(currentClientes) ? currentClientes : [])
    .filter((cliente) => String(cliente?.value || '') !== String(option.value));
  const consumidorFinal = withoutDuplicate.find((cliente) => cliente?.es_consumidor_final)
    || createConsumidorFinalCliente();
  return {
    option,
    clientes: [
      consumidorFinal,
      option,
      ...withoutDuplicate.filter((cliente) => !cliente?.es_consumidor_final)
    ]
  };
};

