const SinPermiso = ({ permiso = "—", detalle }) => {
  return (
    <div className="alert alert-warning mb-0">
      <div className="d-flex align-items-start gap-2">
        <i className="bi bi-shield-lock fs-4"></i>
        <div>
          <div className="fw-semibold">Acceso restringido</div>
          <div className="small text-muted">
            No tienes permisos para ver esta sección.
            {permiso !== "—" && (
              <> (permiso requerido: <b>{permiso}</b>)</>
            )}
          </div>
          {detalle && <div className="small mt-2">{detalle}</div>}
        </div>
      </div>
    </div>
  );
};

export default SinPermiso;
