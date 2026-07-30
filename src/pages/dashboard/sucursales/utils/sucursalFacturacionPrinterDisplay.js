export const resolveInheritedFacturaPrinterDisplay = (facturaPrinter) => {
  const name = String(facturaPrinter?.nombre_impresora_sistema || '').trim();
  return {
    name: name || 'Sin asignar',
    state: name
      ? (facturaPrinter?.activa === false ? 'Inactiva' : 'Activa')
      : 'Sin configurar'
  };
};
