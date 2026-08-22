import { useMemo, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import { buildProviderDistribution, countMissingProviders, countProviderReplacements } from '../utils/solicitudesCompraProviderUtils';

export default function ProveedorBulkAssignment({ providerOptions, lines, onApplyAll, onFillMissing, disabled = false }) {
  const [selectedProvider, setSelectedProvider] = useState('');
  const [replacementCount, setReplacementCount] = useState(0);
  const [feedback, setFeedback] = useState('');
  const distribution = useMemo(() => buildProviderDistribution(lines, providerOptions), [lines, providerOptions]);
  const unavailable = disabled || !selectedProvider || !lines.length;

  const applyAll = () => {
    const replacements = countProviderReplacements(lines, selectedProvider);
    if (replacements > 0) { setReplacementCount(replacements); return; }
    onApplyAll(selectedProvider);
    setFeedback(`Proveedor aplicado a ${lines.length} líneas.`);
  };
  const fillMissing = () => {
    const count = countMissingProviders(lines);
    onFillMissing(selectedProvider);
    setFeedback(`Proveedor aplicado a ${count} líneas.`);
  };

  return <section className="sol-comp-provider-bulk" aria-labelledby="provider-bulk-title">
    <div><h4 id="provider-bulk-title">Asignación rápida de proveedor</h4><p>Selecciona un proveedor para asignarlo a varias líneas de una sola vez.</p></div>
    <div className="sol-comp-provider-bulk__controls">
      <AppSelect label="Proveedor para asignación rápida" placeholder="Selecciona un proveedor" value={selectedProvider} options={providerOptions} onChange={(value) => { setSelectedProvider(value); setFeedback(''); }} searchable disabled={disabled} />
      <div className="sol-comp-provider-bulk__actions"><button type="button" className="btn btn-outline-primary" disabled={unavailable} onClick={applyAll}>Aplicar a todos</button><button type="button" className="btn btn-outline-secondary" disabled={unavailable} onClick={fillMissing}>Solo líneas sin proveedor</button></div>
    </div>
    {feedback ? <p className="sol-comp-provider-bulk__feedback" aria-live="polite">{feedback}</p> : null}
    <div className="sol-comp-provider-distribution"><strong>Distribución por proveedor</strong>{distribution.length ? <div>{distribution.map((item) => <span className={item.missing ? 'is-missing' : ''} key={item.id_proveedor || 'missing'}><em>{item.nombre}</em><b>{item.cantidad} {item.cantidad === 1 ? 'artículo' : 'artículos'}</b></span>)}</div> : <p>No hay artículos para asignar.</p>}</div>
    {replacementCount > 0 ? <div className="sol-comp-modal-backdrop" role="presentation"><div className="sol-comp-modal" role="dialog" aria-modal="true" aria-labelledby="replace-providers-title"><h3 id="replace-providers-title">Reemplazar proveedores</h3><p>Esta acción cambiará el proveedor de {replacementCount} {replacementCount === 1 ? 'línea que ya tiene' : 'líneas que ya tienen'} un proveedor seleccionado.</p><div className="sol-comp-review-actions"><button type="button" className="btn btn-outline-secondary" onClick={() => setReplacementCount(0)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => { onApplyAll(selectedProvider); setFeedback(`Proveedor aplicado a ${lines.length} líneas.`); setReplacementCount(0); }}>Reemplazar en todas</button></div></div></div> : null}
  </section>;
}
