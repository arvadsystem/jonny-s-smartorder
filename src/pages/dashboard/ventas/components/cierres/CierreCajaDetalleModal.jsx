import { useMemo, useState } from 'react';
import {
  formatCajaCurrency,
  formatCajaDateTimeHN,
  resolveDifferenceBadge,
  resolveMovimientoManualKind,
  resolveSessionStatusBadge
} from '../../utils/cajasHelpers';

const formatSessionCode = (idSesionCaja) =>
  idSesionCaja ? `SES-${String(idSesionCaja).padStart(5, '0')}` : 'Sesion sin codigo';

const resolveRolCobroLabel = (row = {}) => {
  if (row.es_responsable || row.rol_participacion === 'RESPONSABLE') return 'Responsable';
  if (row.es_auxiliar || row.rol_participacion === 'AUXILIAR') return 'Auxiliar';
  return 'Ejecutor';
};

const resolveParticipantRole = (row = {}) => {
  const code = String(row.rol_codigo || row.rol_participacion || '').trim().toUpperCase();
  if (code === 'RESPONSABLE') return 'Responsable';
  if (code === 'AUXILIAR') return 'Auxiliar';
  return 'Ejecutor';
};

const resolveMovimientoRole = (row = {}) => {
  const code = String(row.rol_participacion_codigo || row.rol_codigo || '').trim().toUpperCase();
  if (code === 'RESPONSABLE') return 'Responsable';
  if (code === 'AUXILIAR') return 'Auxiliar';
  return row.rol_participacion_nombre || 'Ejecutor';
};

const renderEmptyRow = (message, colSpan) => (
  <tr>
    <td colSpan={colSpan} className="text-center py-4 text-muted">
      {message}
    </td>
  </tr>
);

const DetailField = ({ label, value }) => (
  <div className="cierres-caja-detail-field">
    <span>{label}</span>
    <strong>{value || '-'}</strong>
  </div>
);

const AmountCard = ({ label, value, tone = 'neutral', icon = 'bi-cash-stack' }) => (
  <article className={`cierres-caja-detail-amount-card is-${tone}`}>
    <span className="cierres-caja-detail-amount-card__icon">
      <i className={`bi ${icon}`} />
    </span>
    <div>
      <span>{label}</span>
      <strong>L. {formatCajaCurrency(value)}</strong>
    </div>
  </article>
);

export default function CierreCajaDetalleModal({
  open,
  detalle,
  loading,
  canRegisterArqueo,
  canCloseSession,
  canUseCloseFlow,
  canViewCajaTheoreticalAmounts = true,
  onClose,
  onOpenArqueo,
  onOpenCerrar
}) {
  const [activeTab, setActiveTab] = useState('RESUMEN');
  const [movimientoFiltro, setMovimientoFiltro] = useState('TODOS');

  const sesion = detalle?.sesion;
  const resumen = detalle?.resumen_operativo ?? {};
  const cierre = detalle?.cierre ?? null;
  const participantes = Array.isArray(detalle?.equipo_caja)
    ? detalle.equipo_caja
    : (Array.isArray(detalle?.participantes) ? detalle.participantes : []);
  const cobrosPorUsuario = Array.isArray(detalle?.cobros_por_usuario) ? detalle.cobros_por_usuario : [];
  const arqueos = Array.isArray(detalle?.arqueos) ? detalle.arqueos : [];
  const movimientos = Array.isArray(detalle?.movimientos) ? detalle.movimientos : [];
  const isOpen = sesion?.estado_codigo === 'ABIERTA';
  const sessionCode = formatSessionCode(sesion?.id_sesion_caja);
  const statusBadge = resolveSessionStatusBadge(sesion);
  const closeBadge = cierre?.id_cierre_caja
    ? resolveDifferenceBadge(canViewCajaTheoreticalAmounts ? cierre?.diferencia : null)
    : { label: 'Sin cierre', className: 'bg-light border-secondary text-secondary' };
  const declaredAmount =
    cierre?.monto_declarado_cierre
    ?? resumen?.monto_declarado
    ?? resumen?.monto_declarado_cierre
    ?? null;
  const theoreticalAmount = resumen?.monto_teorico ?? resumen?.efectivo_teorico ?? cierre?.monto_teorico_cierre;
  const differenceAmount = cierre?.diferencia ?? resumen?.diferencia_cierre ?? sesion?.diferencia_cierre ?? null;
  const cierreObservacion = cierre?.observacion || cierre?.observacion_cierre || resumen?.observacion_cierre || '';

  const movimientosManuales = useMemo(
    () => movimientos
      .map((movimiento) => ({
        ...movimiento,
        kind: resolveMovimientoManualKind(movimiento)
      }))
      .filter((movimiento) => movimiento.kind === 'INGRESO' || movimiento.kind === 'EGRESO'),
    [movimientos]
  );

  const movimientosResumen = useMemo(() => {
    const ingresos = movimientosManuales.filter((movimiento) => movimiento.kind === 'INGRESO');
    const egresos = movimientosManuales.filter((movimiento) => movimiento.kind === 'EGRESO');
    return {
      ingresos: {
        count: ingresos.length,
        total: ingresos.reduce((sum, movimiento) => sum + Number(movimiento.monto || 0), 0)
      },
      egresos: {
        count: egresos.length,
        total: egresos.reduce((sum, movimiento) => sum + Number(movimiento.monto || 0), 0)
      }
    };
  }, [movimientosManuales]);

  const movimientosFiltrados = useMemo(() => {
    if (movimientoFiltro === 'INGRESOS') {
      return movimientosManuales.filter((movimiento) => movimiento.kind === 'INGRESO');
    }
    if (movimientoFiltro === 'EGRESOS') {
      return movimientosManuales.filter((movimiento) => movimiento.kind === 'EGRESO');
    }
    return movimientosManuales;
  }, [movimientoFiltro, movimientosManuales]);

  const tabs = canViewCajaTheoreticalAmounts
    ? [
        { key: 'RESUMEN', label: 'Resumen operativo', icon: 'bi-clipboard-data' },
        { key: 'EQUIPO', label: 'Equipo de caja', icon: 'bi-person-badge' },
        { key: 'COBROS', label: 'Cobros por usuario', icon: 'bi-people' },
        { key: 'ARQUEOS', label: 'Arqueos', icon: 'bi-calculator' },
        { key: 'MOVIMIENTOS', label: 'Movimientos manuales', icon: 'bi-journal-plus' }
      ]
    : [
        { key: 'RESUMEN', label: 'Resumen de cierre', icon: 'bi-check2-square' },
        { key: 'MOVIMIENTOS', label: 'Movimientos manuales', icon: 'bi-journal-plus' },
        ...(cierreObservacion ? [{ key: 'OBSERVACION', label: 'Observacion de cierre', icon: 'bi-chat-left-text' }] : [])
      ];
  const selectedTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : tabs[0]?.key;

  if (!open) return null;

  const emptyMovementMessage = movimientoFiltro === 'INGRESOS'
    ? 'No hay ingresos manuales registrados.'
    : movimientoFiltro === 'EGRESOS'
      ? 'No hay egresos manuales registrados.'
      : 'No hay ingresos ni egresos manuales registrados.';

  const renderResumen = () => (
    <section className="cierres-caja-detail-panel">
      <div className="inv-prod-title-row mb-2">
        <i className="bi bi-clipboard-data text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
        <span className="inv-prod-title">{canViewCajaTheoreticalAmounts ? 'Resumen operativo' : 'Resumen de cierre'}</span>
      </div>

      {canViewCajaTheoreticalAmounts ? (
        <div className="ventas-page__table-wrap cierres-caja-detail__table-wrap">
          <table className="table ventas-page__table cierres-caja-detail-table">
            <thead>
              <tr>
                <th className="text-end">Ventas efectivo</th>
                <th className="text-end">Ventas no efectivo</th>
                <th className="text-end">Ingresos manuales</th>
                <th className="text-end">Egresos manuales</th>
                <th className="text-end">Total responsable</th>
                <th className="text-end">Total auxiliares</th>
                <th className="text-end">Monto teorico</th>
                <th className="text-end">Monto declarado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-end">L. {formatCajaCurrency(resumen.ventas_efectivo)}</td>
                <td className="text-end">L. {formatCajaCurrency(resumen.ventas_no_efectivo)}</td>
                <td className="text-end">L. {formatCajaCurrency(resumen.ingresos_manuales)}</td>
                <td className="text-end">L. {formatCajaCurrency(resumen.egresos_manuales)}</td>
                <td className="text-end">L. {formatCajaCurrency(resumen.total_responsable)}</td>
                <td className="text-end">L. {formatCajaCurrency(resumen.total_auxiliares)}</td>
                <td className="text-end">L. {formatCajaCurrency(theoreticalAmount)}</td>
                <td className="text-end">L. {formatCajaCurrency(declaredAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cierres-caja-detail-safe-grid">
          <DetailField label="Sesion" value={sessionCode} />
          <DetailField label="Caja" value={sesion?.nombre_caja || 'Sin caja'} />
          <DetailField label="Cierre" value={formatCajaDateTimeHN(sesion?.fecha_cierre || cierre?.fecha_cierre)} />
          <DetailField
            label="Monto declarado"
            value={declaredAmount === null || declaredAmount === undefined ? 'No disponible' : `L. ${formatCajaCurrency(declaredAmount)}`}
          />
        </div>
      )}
    </section>
  );

  const renderEquipo = () => (
    <section className="cierres-caja-detail-panel">
      <div className="inv-prod-title-row mb-2">
        <i className="bi bi-person-badge text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
        <span className="inv-prod-title">Equipo de caja</span>
      </div>
      <div className="ventas-page__table-wrap cierres-caja-detail__table-wrap">
        <table className="table ventas-page__table cierres-caja-detail-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {participantes.length === 0
              ? renderEmptyRow('No hay registros.', 5)
              : participantes.map((row) => (
                  <tr key={row.id_participacion_caja || row.id_usuario}>
                    <td>{row.nombre_completo || row.nombre_usuario || 'Usuario no disponible'}</td>
                    <td>{resolveParticipantRole(row)}</td>
                    <td>{formatCajaDateTimeHN(row.fecha_inicio)}</td>
                    <td>{formatCajaDateTimeHN(row.fecha_fin)}</td>
                    <td>{row.activo ? 'Activo' : 'Inactivo'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderCobros = () => (
    <section className="cierres-caja-detail-panel">
      <div className="inv-prod-title-row mb-2">
        <i className="bi bi-people text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
        <span className="inv-prod-title">Cobros por usuario</span>
      </div>
      <div className="ventas-page__table-wrap cierres-caja-detail__table-wrap">
        <table className="table ventas-page__table cierres-caja-detail-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th className="text-center">Rol</th>
              <th className="text-center">Cobros</th>
              <th className="text-end">Total efectivo</th>
              <th className="text-end">Total no efectivo</th>
              <th className="text-end">Total cobrado</th>
            </tr>
          </thead>
          <tbody>
            {cobrosPorUsuario.length === 0
              ? renderEmptyRow('No hay registros.', 6)
              : cobrosPorUsuario.map((row) => (
                  <tr key={row.id_usuario_ejecutor}>
                    <td>
                      <div className="ventas-page__table-sale">
                        <strong>{row.nombre_completo || row.nombre_usuario || 'Usuario no disponible'}</strong>
                        <span>{row.nombre_usuario ? `@${row.nombre_usuario}` : 'Usuario sin alias'}</span>
                      </div>
                    </td>
                    <td className="text-center align-middle">{resolveRolCobroLabel(row)}</td>
                    <td className="text-center align-middle">{row.cobros_registrados}</td>
                    <td className="text-end align-middle">L. {formatCajaCurrency(row.total_efectivo)}</td>
                    <td className="text-end align-middle">L. {formatCajaCurrency(row.total_no_efectivo)}</td>
                    <td className="text-end align-middle ventas-page__table-total">L. {formatCajaCurrency(row.total_cobrado)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderArqueos = () => (
    <section className="cierres-caja-detail-panel">
      <div className="inv-prod-title-row mb-2">
        <i className="bi bi-calculator text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
        <span className="inv-prod-title">Arqueos</span>
      </div>
      <div className="ventas-page__table-wrap cierres-caja-detail__table-wrap">
        <table className="table ventas-page__table cierres-caja-detail-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Fecha</th>
              <th className="text-end">Contado</th>
              {canViewCajaTheoreticalAmounts ? <th className="text-end">Diferencia</th> : null}
            </tr>
          </thead>
          <tbody>
            {arqueos.length === 0
              ? renderEmptyRow('No hay registros.', canViewCajaTheoreticalAmounts ? 4 : 3)
              : arqueos.map((arqueo) => (
                  <tr key={arqueo.id_arqueo_caja}>
                    <td>{arqueo.tipo_nombre || arqueo.tipo_codigo}</td>
                    <td>{formatCajaDateTimeHN(arqueo.fecha_arqueo)}</td>
                    <td className="text-end">L. {formatCajaCurrency(arqueo.monto_contado)}</td>
                    {canViewCajaTheoreticalAmounts ? (
                      <td className="text-end">L. {formatCajaCurrency(arqueo.diferencia)}</td>
                    ) : null}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderMovimientos = () => (
    <section className="cierres-caja-detail-panel cierres-caja-manual-movements">
      <div className="cierres-caja-manual-movements__head">
        <div className="inv-prod-title-row">
          <i className="bi bi-journal-plus text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
          <span className="inv-prod-title">Movimientos manuales</span>
        </div>
        <div className="cierres-caja-manual-movements__filter" role="tablist" aria-label="Filtrar movimientos manuales">
          {[
            ['TODOS', 'Todos'],
            ['INGRESOS', 'Ingresos'],
            ['EGRESOS', 'Egresos']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={movimientoFiltro === key ? 'is-active' : ''}
              onClick={() => setMovimientoFiltro(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="cierres-caja-manual-movements__summary">
        <AmountCard
          label={`${movimientosResumen.ingresos.count} ingresos`}
          value={movimientosResumen.ingresos.total}
          tone="income"
          icon="bi-box-arrow-in-down"
        />
        <AmountCard
          label={`${movimientosResumen.egresos.count} egresos`}
          value={movimientosResumen.egresos.total}
          tone="expense"
          icon="bi-box-arrow-up"
        />
      </div>

      <div className="ventas-page__table-wrap cierres-caja-detail__table-wrap">
        <table className="table ventas-page__table cierres-caja-detail-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Usuario / Rol</th>
              <th>Fecha y hora</th>
              <th>Referencia</th>
              <th>Observacion</th>
              <th className="text-end">Monto</th>
            </tr>
          </thead>
          <tbody>
            {movimientosFiltrados.length === 0
              ? renderEmptyRow(emptyMovementMessage, 6)
              : movimientosFiltrados.map((movimiento) => {
                  const isIncome = movimiento.kind === 'INGRESO';
                  const userName =
                    movimiento.usuario_ejecutor_nombre
                    || movimiento.nombre_completo
                    || movimiento.usuario_ejecutor_alias
                    || movimiento.nombre_usuario
                    || 'Usuario no disponible';

                  return (
                    <tr key={movimiento.id_movimiento_caja}>
                      <td>
                        <span className={`cierres-caja-movement-badge ${isIncome ? 'is-income' : 'is-expense'}`}>
                          {isIncome ? 'Ingreso' : 'Egreso'}
                        </span>
                      </td>
                      <td>
                        <div className="ventas-page__table-sale">
                          <strong>{userName}</strong>
                          <span>{resolveMovimientoRole(movimiento)}</span>
                        </div>
                      </td>
                      <td>{formatCajaDateTimeHN(movimiento.fecha_movimiento || movimiento.fecha_creacion)}</td>
                      <td>{movimiento.referencia || '-'}</td>
                      <td className="cierres-caja-movement-observation">{movimiento.observacion || '-'}</td>
                      <td className={`text-end cierres-caja-movement-amount ${isIncome ? 'is-income' : 'is-expense'}`}>
                        {isIncome ? '+' : '-'} L. {formatCajaCurrency(movimiento.monto)}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderObservacion = () => (
    <section className="cierres-caja-detail-panel">
      <div className="inv-prod-title-row mb-2">
        <i className="bi bi-chat-left-text text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
        <span className="inv-prod-title">Observacion de cierre</span>
      </div>
      <p className="mb-0 text-muted fw-semibold">{cierreObservacion || 'Sin observacion registrada.'}</p>
    </section>
  );

  const renderActivePanel = () => {
    if (selectedTab === 'EQUIPO') return renderEquipo();
    if (selectedTab === 'COBROS') return renderCobros();
    if (selectedTab === 'ARQUEOS') return renderArqueos();
    if (selectedTab === 'MOVIMIENTOS') return renderMovimientos();
    if (selectedTab === 'OBSERVACION') return renderObservacion();
    return renderResumen();
  };

  return (
    <div className="ventas-modal-backdrop" onClick={onClose}>
      <section
        className="ventas-modal ventas-detail-modal cierres-caja-detail-modal cierres-caja-detail-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cierre-caja-detalle-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-safe2-fill" />
            </span>
            <div>
              <h3 id="cierre-caja-detalle-title">Detalle de cierre</h3>
              <p>{sessionCode}</p>
            </div>
          </div>

          <div className="ventas-modal__header-actions">
            {canRegisterArqueo ? (
              <button
                type="button"
                className="ventas-modal__ghost-btn"
                title="Registrar arqueo"
                onClick={() => onOpenArqueo(sesion)}
                disabled={!isOpen}
              >
                <i className="bi bi-calculator" />
              </button>
            ) : null}
            {canCloseSession ? (
              <button
                type="button"
                className="ventas-modal__ghost-btn"
                title="Cerrar caja"
                onClick={() => onOpenCerrar(sesion)}
                disabled={!isOpen || !canUseCloseFlow}
              >
                <i className="bi bi-lock" />
              </button>
            ) : null}
            <button type="button" className="ventas-modal__close-btn" onClick={onClose} aria-label="Cerrar">
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </header>

        <div className="ventas-modal__body ventas-detail-modal__body cierres-caja-detail-body">
          {loading || !detalle ? (
            <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
              <div className="spinner-border text-danger" role="status" />
              <span>Cargando detalle de la sesion...</span>
            </div>
          ) : (
            <>
              <section className="cierres-caja-detail-summary">
                <div className="cierres-caja-detail-summary__main">
                  <div className="cierres-caja-detail__badges">
                    <span className={`ventas-page__table-pill ${statusBadge.className}`}>{statusBadge.label}</span>
                    <span className={`ventas-page__table-pill ${closeBadge.className}`}>{closeBadge.label}</span>
                    {cierre?.resolucion_nombre ? (
                      <span className="ventas-page__table-pill bg-white border-secondary text-secondary">
                        {cierre.resolucion_nombre}
                      </span>
                    ) : null}
                  </div>

                  <div className="cierres-caja-detail-summary__grid">
                    <DetailField label="Caja" value={sesion?.nombre_caja || 'Sin caja'} />
                    <DetailField label="Sucursal" value={sesion?.nombre_sucursal || 'Sin sucursal'} />
                    <DetailField label="Apertura" value={`L. ${formatCajaCurrency(sesion?.monto_apertura)}`} />
                    <DetailField label="Cierre" value={formatCajaDateTimeHN(sesion?.fecha_cierre || cierre?.fecha_cierre)} />
                    <DetailField label="Estado" value={statusBadge.label} />
                    {canViewCajaTheoreticalAmounts ? (
                      <DetailField
                        label="Diferencia"
                        value={differenceAmount === null || differenceAmount === undefined ? '-' : `L. ${formatCajaCurrency(differenceAmount)}`}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="cierres-caja-detail-summary__cards">
                  {canViewCajaTheoreticalAmounts ? (
                    <AmountCard label="Monto teorico" value={theoreticalAmount} icon="bi-calculator" />
                  ) : null}
                  <AmountCard label="Monto declarado" value={declaredAmount} icon="bi-cash-coin" />
                  {canViewCajaTheoreticalAmounts && differenceAmount !== null && differenceAmount !== undefined ? (
                    <AmountCard
                      label="Diferencia"
                      value={differenceAmount}
                      tone={Number(differenceAmount) === 0 ? 'income' : 'expense'}
                      icon="bi-activity"
                    />
                  ) : null}
                </div>
              </section>

              <nav className="cierres-caja-detail-tabs" aria-label="Detalle de cierre">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`cierres-caja-detail-tab ${selectedTab === tab.key ? 'is-active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <i className={`bi ${tab.icon}`} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>

              {renderActivePanel()}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
