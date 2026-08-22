import useCapturasCompraRapida from '../hooks/useCapturasCompraRapida';
import { formatDateTime } from '../utils/solicitudesCompraUtils';
import { formatFileSize, MAX_INVOICE_EVIDENCES } from '../utils/solicitudesCompraRecepcionUtils';

export default function CapturasCompraRapidaOperativa({ onBack, openToast }) {
  const flow = useCapturasCompraRapida({ openToast });
  const draftState = String(flow.draft?.estado || 'BORRADOR').toUpperCase();
  const editable = draftState === 'BORRADOR';
  if (flow.mode === 'list') return (
    <section className="sol-comp-section sol-comp-quick-capture">
      <header className="sol-comp-header"><div><h2>Mis capturas rápidas</h2><p>Consulta borradores y facturas enviadas a Administración.</p></div><div className="sol-comp-header-actions"><button className="btn btn-outline-secondary" type="button" onClick={onBack}>Volver</button><button className="btn btn-primary" type="button" onClick={flow.openNew}><i className="bi bi-camera" /> Nueva captura</button></div></header>
      {flow.list.loading ? <div className="sol-comp-feedback">Cargando capturas…</div> : null}
      {flow.list.error ? <div className="sol-comp-feedback sol-comp-feedback--error">{flow.list.error}</div> : null}
      <div className="sol-comp-list">
        {flow.list.items.map((item) => <article className="sol-comp-request-card" key={item.id_captura_compra_rapida}><div className="sol-comp-card-top"><strong>Captura rápida #{item.id_captura_compra_rapida}</strong><span className={`sol-comp-state sol-comp-state--${String(item.estado).toLowerCase()}`}>{item.estado}</span></div><div className="sol-comp-meta-grid"><span><small>Fecha</small>{formatDateTime(item.fecha_creacion)}</span><span><small>Facturas</small>{item.cantidad_evidencias || 0}</span><span><small>Sucursal</small>{item.sucursal?.nombre || '—'}</span><span><small>Almacén</small>{item.almacen?.nombre || '—'}</span></div><button type="button" className="btn btn-outline-primary btn-sm" onClick={() => flow.loadCapture(item.id_captura_compra_rapida)}>{item.estado === 'BORRADOR' ? 'Continuar' : 'Ver'}</button></article>)}
      </div>
    </section>
  );
  return (
    <section className="sol-comp-section sol-comp-quick-capture">
      <header className="sol-comp-header"><div><h2>Compra rápida</h2><p>Utiliza esta opción cuando los productos ya fueron recibidos y solo necesitas enviar las fotografías de la factura a Administración.</p></div><button type="button" className="btn btn-outline-secondary" onClick={() => flow.setMode('list')}>Volver</button></header>
      {flow.draft ? <div className="sol-comp-warehouse"><strong>{draftState} #{flow.draft.id_captura_compra_rapida}</strong><span>{flow.draft.sucursal?.nombre || ''} {flow.draft.almacen?.nombre || ''}</span></div> : null}
      <div className="sol-comp-reception-panel">
        <h3>Factura / comprobantes</h3>
        {editable ? <div className="sol-comp-header-actions"><label className="btn btn-outline-primary" htmlFor="quick-camera"><i className="bi bi-camera" /> Tomar foto</label><input id="quick-camera" hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { void flow.addFiles(event.target.files); event.target.value = ''; }} /><label className="btn btn-outline-secondary" htmlFor="quick-files">Seleccionar imágenes</label><input id="quick-files" hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void flow.addFiles(event.target.files); event.target.value = ''; }} /></div> : null}
        <p>{flow.evidence.length} de {MAX_INVOICE_EVIDENCES} imágenes</p>
        {draftState === 'RECHAZADA' && flow.draft?.motivo_rechazo ? <div className="sol-comp-feedback sol-comp-feedback--error"><strong>Motivo del rechazo</strong><span>{flow.draft.motivo_rechazo}</span></div> : null}
        {draftState === 'FORMALIZADA' && flow.draft?.id_solicitud_compra ? <div className="sol-comp-feedback"><strong>Orden generada:</strong> #{flow.draft.id_solicitud_compra}</div> : null}
        {flow.error ? <div className="sol-comp-feedback sol-comp-feedback--error">{flow.error}</div> : null}
        <div className="sol-comp-invoice-grid">{flow.evidence.map((item) => <article className="sol-comp-invoice-preview" key={item.id_evidencia}>{item.url_firmada ? <img src={item.url_firmada} alt={item.nombre_original || 'Factura'} /> : null}<div><strong>{item.nombre_original || 'Factura'}</strong><small>{item.tamano_bytes ? formatFileSize(item.tamano_bytes) : item.mime_type}</small></div>{editable ? <button className="btn btn-outline-danger btn-sm" disabled={Boolean(flow.busy)} type="button" onClick={() => flow.removeEvidence(item.id_evidencia)} aria-label={`Quitar ${item.nombre_original || 'factura'}`}>×</button> : null}</article>)}</div>
        {editable ? <div className="sol-comp-review-actions"><button type="button" className="btn btn-outline-danger" disabled={!flow.draft || Boolean(flow.busy)} onClick={() => { if (window.confirm('¿Descartar este borrador?')) void flow.discard(); }}>Descartar borrador</button><button type="button" className="btn btn-primary" disabled={!flow.draft || flow.evidence.length < 1 || Boolean(flow.busy)} onClick={flow.send}>{flow.busy === 'send' ? 'Enviando…' : 'Enviar a Administración'}</button></div> : <p className="sol-comp-feedback">Las fotografías están en modo de solo lectura.</p>}
      </div>
    </section>
  );
}
