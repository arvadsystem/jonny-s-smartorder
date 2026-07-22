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
      setLines([]); setObservation('');
    } catch { /* AM: conserva el borrador para reintentar. */ }
    finally { setSubmitting(false); }
  };
  return (
    <section className="sol-comp-section">
      <header className="sol-comp-header"><div><button type="button" className="sol-comp-back" onClick={onBack}><i className="bi bi-arrow-left" /> Volver</button><h2>Nueva solicitud</h2><p>Selecciona el almacén y agrega los artículos que necesita tu sucursal.</p></div></header>
      <div className="sol-comp-warehouse"><AppSelect label="Almacén" placeholder={warehousesLoading ? 'Cargando almacenes…' : 'Selecciona un almacén'} value={warehouseId} options={warehouseOptions} onChange={(value) => { setWarehouseId(value); setLines([]); }} disabled={warehousesLoading} searchable={warehouseOptions.length > 6} /></div>
      {!warehouseId ? <div className="sol-comp-feedback">Selecciona un almacén para consultar su catálogo.</div> : (
        <div className="sol-comp-create-layout">
          <SolicitudCompraCatalogo warehouseId={warehouseId} state={catalogState} loadCatalog={loadCatalog} onAdd={addLine} />
          <SolicitudCompraResumen lines={lines} onChange={(index, cantidad) => setLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, cantidad } : line))} onRemove={(index) => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))} observation={observation} setObservation={setObservation} submitting={submitting} onSubmit={send} disabled={!warehouseId || !allValid} />
        </div>
      )}
    </section>
  );
}
