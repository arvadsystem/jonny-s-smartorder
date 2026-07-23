import { useEffect, useMemo, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import SolicitudCompraCatalogo from './SolicitudCompraCatalogo';
import SolicitudCompraResumen from './SolicitudCompraResumen';
import { buildSolicitudPayload, parseRequestedQuantity, upsertDraftLine } from '../utils/solicitudesCompraUtils';

export default function NuevaSolicitudCompra({ warehouses, warehousesLoading, catalogState, loadCatalog, submit, onBack, openToast }) {
  const activeWarehouses = useMemo(() => warehouses.filter((row) => row?.estado !== false && row?.estado !== 'false' && row?.activo !== false), [warehouses]);
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState([]);
  const [observation, setObservation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (activeWarehouses.length === 1) setWarehouseId(String(activeWarehouses[0].id_almacen)); }, [activeWarehouses]);
  const warehouseOptions = activeWarehouses.map((row) => ({ value: String(row.id_almacen), label: row.nombre || row.nombre_almacen || `Almacén #${row.id_almacen}`, helperText: row.nombre_sucursal || row.sucursal?.nombre || '' }));
  const allValid = lines.length > 0 && lines.every((line) => parseRequestedQuantity(line.cantidad, line.tipo_item));
  const addLine = (line) => {
    const result = upsertDraftLine(lines, line);
    setLines(result.lines);
    openToast('ARTÍCULO AGREGADO', result.merged ? 'La cantidad de la línea existente fue actualizada.' : 'El artículo se agregó al resumen.', 'info');
  };
  const send = async () => {
    if (submitting || !warehouseId || !allValid) return;
    setSubmitting(true);
    try {
      await submit(buildSolicitudPayload({ idAlmacen: warehouseId, observacion: observation, detalles: lines }));
      setLines([]);
      setObservation('');
    } catch { /* AM: conserva el borrador para reintentar. */ }
    finally { setSubmitting(false); }
  };
  return (
    <section className="sol-comp-section">
      <button type="button" className="sol-comp-back" onClick={onBack}><i className="bi bi-arrow-left" aria-hidden="true" /> Volver a solicitudes</button>
      <header className="sol-comp-header sol-comp-header--create">
        <div className="sol-comp-header__copy"><span className="sol-comp-header__icon" aria-hidden="true"><i className="bi bi-cart-plus" /></span><div><h2>Nueva solicitud</h2><p>Selecciona el almacén y agrega los artículos que necesita tu sucursal.</p></div></div>
      </header>
      <ol className="sol-comp-steps" aria-label="Flujo de nueva solicitud"><li className="is-current"><span>1</span> Almacén</li><li><span>2</span> Seleccionar artículos</li><li><span>3</span> Revisar y enviar</li></ol>
      <div className="sol-comp-warehouse">
        <div className="sol-comp-panel-heading"><span aria-hidden="true"><i className="bi bi-building-check" /></span><div><h3>Almacén de destino</h3><p>El catálogo y el inventario corresponden al almacén seleccionado.</p></div></div>
        <AppSelect label="Almacén" placeholder={warehousesLoading ? 'Cargando almacenes…' : 'Selecciona un almacén'} value={warehouseId} options={warehouseOptions} onChange={(selected) => { setWarehouseId(selected); setLines([]); }} disabled={warehousesLoading} searchable={warehouseOptions.length > 6} />
      </div>
      {!warehouseId ? <div className="sol-comp-feedback">Selecciona un almacén para consultar su catálogo.</div> : (
        <div className="sol-comp-create-layout">
          <SolicitudCompraCatalogo key={warehouseId} warehouseId={warehouseId} state={catalogState} loadCatalog={loadCatalog} onAdd={addLine} />
          <SolicitudCompraResumen lines={lines} onChange={(index, cantidad) => setLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, cantidad } : line))} onRemove={(index) => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))} observation={observation} setObservation={setObservation} submitting={submitting} onSubmit={send} disabled={!warehouseId || !allValid} />
        </div>
      )}
    </section>
  );
}
