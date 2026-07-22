import useSolicitudCompraEvidencias from '../hooks/useSolicitudCompraEvidencias';
import { formatDateTime } from '../utils/solicitudesCompraUtils';
import { formatFileSize } from '../utils/solicitudesCompraRecepcionUtils';

export default function SolicitudCompraEvidencias({ idSolicitud }) {
  const evidence = useSolicitudCompraEvidencias({ idSolicitud });

  if (!evidence.open) {
    return <button type="button" className="btn btn-outline-primary" onClick={evidence.openViewer}>Ver factura</button>;
  }

  return (
    <section className="sol-comp-evidence" aria-labelledby="sol-comp-evidence-title">
      <header>
        <div><h3 id="sol-comp-evidence-title">Factura registrada</h3><p>El acceso a la imagen es temporal.</p></div>
        <button type="button" className="btn btn-link" onClick={evidence.closeViewer}>Cerrar</button>
      </header>
      <div aria-live="polite">
        {evidence.loading ? <div className="sol-comp-feedback"><span className="spinner-border spinner-border-sm" /> Consultando factura…</div> : null}
        {evidence.error ? <div className="sol-comp-feedback sol-comp-feedback--error"><span>{evidence.error}</span><button type="button" className="btn btn-outline-danger btn-sm" onClick={evidence.refreshAccess}>Reintentar</button></div> : null}
        {!evidence.loading && !evidence.error && evidence.items.length === 0 ? <div className="sol-comp-feedback">No hay una factura disponible.</div> : null}
      </div>
      {!evidence.loading && !evidence.error ? evidence.items.map((item) => (
        <article key={item.id_evidencia} className="sol-comp-evidence-card">
          {item.url_firmada ? <img src={item.url_firmada} alt={`Factura ${item.nombre_original || 'de la solicitud'}`} /> : <div className="sol-comp-contract-error">La evidencia no contiene una URL temporal válida.</div>}
          <div>
            <strong>{item.nombre_original || 'Factura'}</strong>
            <span>{item.tipo_archivo || 'Tipo no disponible'}</span>
            <span>{formatFileSize(item.tamano_bytes)}</span>
            <span>{formatDateTime(item.fecha_registro)}</span>
            <span>Registrada por: {item.usuario_registro?.nombre || '—'}</span>
            <span>Acceso temporal: {item.expira_en_segundos || 300} segundos</span>
            {item.url_firmada ? <a className="btn btn-outline-primary btn-sm" href={item.url_firmada} target="_blank" rel="noopener noreferrer">Abrir imagen</a> : null}
          </div>
        </article>
      )) : null}
      {!evidence.loading && !evidence.error && evidence.items.length ? <button type="button" className="btn btn-outline-secondary btn-sm" onClick={evidence.refreshAccess}>Actualizar acceso</button> : null}
    </section>
  );
}
