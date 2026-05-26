import { useMemo, useState } from 'react';
import {
  formatCajaCurrency,
  formatCajaDateTimeHN,
  resolveClosureStateBadge,
  resolveMovimientoManualKind,
  resolveSessionStatusBadge
} from '../../utils/cajasHelpers';
import CierreCajaResolverDiferenciaModal, {
  canResolveCierreDifference
} from './CierreCajaResolverDiferenciaModal';

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

const DetailMobileCards = ({ rows = [], emptyMessage = 'No hay registros.' }) => {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  return (
    <div className="cierres-caja-detail-card-list">
      {normalizedRows.length === 0 ? (
        <div className="cierres-caja-detail-mobile-empty">{emptyMessage}</div>
      ) : (
        normalizedRows.map((row, index) => (
          <article key={row.key || index} className="cierres-caja-detail-mobile-card">
            <div className="cierres-caja-detail-mobile-card__head">
              <strong>{row.title || 'Registro'}</strong>
              {row.badge ? <span>{row.badge}</span> : null}
            </div>
            <div className="cierres-caja-detail-mobile-card__grid">
              {(Array.isArray(row.items) ? row.items : []).map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value || '-'}</strong>
                </div>
              ))}
            </div>
          </article>
        ))
      )}
    </div>
  );
};

export default function CierreCajaDetalleModal({
  open,
  detalle,
  loading,
  canRegisterArqueo,
  canCloseSession,
  canUseCloseFlow,
  canViewCajaTheoreticalAmounts = true,
  canResolveDifference = false,
  saving = false,
  onClose,
  onOpenArqueo,
  onOpenCerrar,
  onResolveDifference
}) {
  const [activeTab, setActiveTab] = useState('RESUMEN');
  const [movimientoFiltro, setMovimientoFiltro] = useState('TODOS');
  const [resolveOpen, setResolveOpen] = useState(false);

  const sesion = detalle?.sesion;
  const resumen = detalle?.resumen_operativo ?? {};
  const cierre = detalle?.cierre ?? null;
  const participantes = Array.isArray(detalle?.equipo_caja)
    ? detalle.equipo_caja
    : (Array.isArray(detalle?.participantes) ? detalle.participantes : []);
  const cobrosPorUsuario = Array.isArray(detalle?.cobros_por_usuario) ? detalle.cobros_por_usuario : [];
  const arqueos = Array.isArray(detalle?.arqueos) ? detalle.arqueos : [];
  const movimientos = Array.isArray(detalle?.movimientos) ? detalle.movimientos : [];
  const recuentos = Array.isArray(detalle?.recuentos)
    ? detalle.recuentos
    : (Array.isArray(detalle?.validaciones_cierre) ? detalle.validaciones_cierre : []);
  const isOpen = sesion?.estado_codigo === 'ABIERTA';
  const sessionCode = formatSessionCode(sesion?.id_sesion_caja);
  const statusBadge = resolveSessionStatusBadge(sesion);
  const closeBadge = cierre?.id_cierre_caja
    ? resolveClosureStateBadge(canViewCajaTheoreticalAmounts ? cierre : null)
    : { label: 'Sin cierre', className: 'bg-light border-secondary text-secondary' };
  const declaredAmount =
    cierre?.monto_declarado_cierre
    ?? resumen?.monto_declarado
    ?? resumen?.monto_declarado_cierre
    ?? null;
  const theoreticalAmount = resumen?.monto_teorico ?? resumen?.efectivo_teorico ?? cierre?.monto_teorico_cierre;
  const differenceAmount = cierre?.diferencia ?? resumen?.diferencia_cierre ?? sesion?.diferencia_cierre ?? null;
  const cierreObservacion = cierre?.observacion || cierre?.observacion_cierre || resumen?.observacion_cierre || '';
  const canSubmitResolution = canResolveCierreDifference({
    cierre,
    sesion,
    canResolveDifference,
    canViewCajaTheoreticalAmounts,
    onResolveDifference
  });

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
        { key: 'RECUENTOS', label: 'Recuentos', icon: 'bi-arrow-repeat' },
        { key: 'MOVIMIENTOS', label: 'Movimientos manuales', icon: 'bi-journal-plus' }
      ]
    : [
        { key: 'RESUMEN', label: 'Resumen de cierre', icon: 'bi-check2-square' },
        { key: 'RECUENTOS', label: 'Recuentos', icon: 'bi-arrow-repeat' },
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
        <>
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
        <DetailMobileCards
          rows={[{
            key: 'resumen-operativo',
            title: 'Resumen operativo',
            items: [
              { label: 'Ventas efectivo', value: `L. ${formatCajaCurrency(resumen.ventas_efectivo)}` },
              { label: 'Ventas no efectivo', value: `L. ${formatCajaCurrency(resumen.ventas_no_efectivo)}` },
              { label: 'Ingresos manuales', value: `L. ${formatCajaCurrency(resumen.ingresos_manuales)}` },
              { label: 'Egresos manuales', value: `L. ${formatCajaCurrency(resumen.egresos_manuales)}` },
              { label: 'Total responsable', value: `L. ${formatCajaCurrency(resumen.total_responsable)}` },
              { label: 'Total auxiliares', value: `L. ${formatCajaCurrency(resumen.total_auxiliares)}` },
              { label: 'Monto teorico', value: `L. ${formatCajaCurrency(theoreticalAmount)}` },
              { label: 'Monto declarado', value: `L. ${formatCajaCurrency(declaredAmount)}` }
            ]
          }]}
        />
        </>
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
    <section className="cierres-caja-detail-panel has-mobile-cards">
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
      <DetailMobileCards
        emptyMessage="No hay registros."
        rows={participantes.map((row) => ({
          key: row.id_participacion_caja || row.id_usuario,
          title: row.nombre_completo || row.nombre_usuario || 'Usuario no disponible',
          badge: row.activo ? 'Activo' : 'Inactivo',
          items: [
            { label: 'Rol', value: resolveParticipantRole(row) },
            { label: 'Inicio', value: formatCajaDateTimeHN(row.fecha_inicio) },
            { label: 'Fin', value: formatCajaDateTimeHN(row.fecha_fin) }
          ]
        }))}
      />
    </section>
  );

  const renderCobros = () => (
    <section className="cierres-caja-detail-panel has-mobile-cards">
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
      <DetailMobileCards
        emptyMessage="No hay registros."
        rows={cobrosPorUsuario.map((row) => ({
          key: row.id_usuario_ejecutor,
          title: row.nombre_completo || row.nombre_usuario || 'Usuario no disponible',
          badge: resolveRolCobroLabel(row),
          items: [
            { label: 'Cobros', value: row.cobros_registrados },
            { label: 'Total efectivo', value: `L. ${formatCajaCurrency(row.total_efectivo)}` },
            { label: 'Total no efectivo', value: `L. ${formatCajaCurrency(row.total_no_efectivo)}` },
            { label: 'Total cobrado', value: `L. ${formatCajaCurrency(row.total_cobrado)}` }
          ]
        }))}
      />
    </section>
  );

  const renderArqueos = () => (
    <section className="cierres-caja-detail-panel has-mobile-cards">
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
    <section className="cierres-caja-detail-panel has-mobile-cards cierres-caja-manual-movements">
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

  const renderRecuentos = () => (
    <section className="cierres-caja-detail-panel has-mobile-cards">
      <div className="inv-prod-title-row mb-2">
        <i className="bi bi-arrow-repeat text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
        <span className="inv-prod-title">Recuentos de cierre</span>
      </div>

      {recuentos.length === 0 ? (
        <div className="ventas-create-modal__empty shadow-none border-0">
          <div className="ventas-create-modal__cart-empty-icon">
            <i className="bi bi-journal-x text-secondary" />
          </div>
          <span>No hay revisiones registradas para esta sesion.</span>
        </div>
      ) : (
        <div className="d-grid gap-3">
          {recuentos.map((recuento) => {
            const difference = recuento.diferencia_total;
            const metodosRecuento = Array.isArray(recuento.metodos) ? recuento.metodos : [];
            const differenceLabel = difference === null || difference === undefined
              ? 'No visible'
              : `L. ${formatCajaCurrency(difference)}`;
            return (
              <article
                key={recuento.id_validacion_cierre || recuento.numero_intento}
                className={`cierres-caja-review-card ${recuento.usado_para_cierre ? 'border border-success' : ''}`}
              >
                <div className="cierres-caja-review-card__head">
                  <div>
                    <strong>Revision #{recuento.numero_intento || '-'}</strong>
                    <div className="text-muted small fw-semibold">
                      {recuento.usuario_valida_nombre || 'Usuario no disponible'} - {formatCajaDateTimeHN(recuento.fecha_validacion)}
                    </div>
                  </div>
                  {recuento.usado_para_cierre ? (
                    <span className="ventas-page__table-pill bg-success border-success text-white">
                      Usado para cierre
                    </span>
                  ) : (
                    <span className="ventas-page__table-pill bg-light border-secondary text-secondary">
                      Revision previa
                    </span>
                  )}
                </div>

                <div className="cierres-caja-review-card__grid">
                  {canViewCajaTheoreticalAmounts ? (
                    <div>
                      <span>Sistema</span>
                      <strong>
                        {recuento.total_teorico === null || recuento.total_teorico === undefined
                          ? 'No visible'
                          : `L. ${formatCajaCurrency(recuento.total_teorico)}`}
                      </strong>
                    </div>
                  ) : null}
                  <div>
                    <span>Declarado</span>
                    <strong>
                      {recuento.total_declarado === null || recuento.total_declarado === undefined
                        ? 'No disponible'
                        : `L. ${formatCajaCurrency(recuento.total_declarado)}`}
                    </strong>
                  </div>
                  {canViewCajaTheoreticalAmounts ? (
                    <div>
                      <span>Diferencia</span>
                      <strong>{differenceLabel}</strong>
                    </div>
                  ) : null}
                  <div>
                    <span>Observacion</span>
                    <strong>{recuento.observacion_general || 'Sin observacion'}</strong>
                  </div>
                </div>

                <div className="ventas-page__table-wrap cierres-caja-detail__table-wrap mt-3">
                  <table className="table ventas-page__table cierres-caja-detail-table">
                    <thead>
                      <tr>
                        <th>Metodo</th>
                        {canViewCajaTheoreticalAmounts ? <th className="text-end">Sistema</th> : null}
                        <th className="text-end">Declarado</th>
                        {canViewCajaTheoreticalAmounts ? <th className="text-end">Diferencia</th> : null}
                        <th className="text-center">Refs.</th>
                        <th>Resultado</th>
                        <th>Observacion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metodosRecuento.length === 0 ? (
                        renderEmptyRow('Sin detalle por metodo.', canViewCajaTheoreticalAmounts ? 7 : 5)
                      ) : (
                        metodosRecuento.map((metodo) => (
                          <tr key={`${recuento.id_validacion_cierre}-${metodo.metodo_pago_codigo}`}>
                            <td>{metodo.metodo_pago_codigo || '-'}</td>
                            {canViewCajaTheoreticalAmounts ? (
                              <td className="text-end">
                                {metodo.monto_teorico === null || metodo.monto_teorico === undefined
                                  ? '-'
                                  : `L. ${formatCajaCurrency(metodo.monto_teorico)}`}
                              </td>
                            ) : null}
                            <td className="text-end">L. {formatCajaCurrency(metodo.monto_declarado)}</td>
                            {canViewCajaTheoreticalAmounts ? (
                              <td className="text-end">
                                {metodo.diferencia === null || metodo.diferencia === undefined
                                  ? '-'
                                  : `L. ${formatCajaCurrency(metodo.diferencia)}`}
                              </td>
                            ) : null}
                            <td className="text-center">{metodo.cantidad_referencias ?? '-'}</td>
                            <td>
                              <span className={`ventas-page__table-pill ${metodo.requiere_revision ? 'bg-warning border-warning text-dark' : 'bg-success border-success text-white'}`}>
                                {metodo.resultado || 'CUADRADO'}
                              </span>
                            </td>
                            <td>{metodo.observacion || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}
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
    if (selectedTab === 'RECUENTOS') return renderRecuentos();
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
            {canSubmitResolution ? (
              <button
                type="button"
                className="ventas-modal__ghost-btn"
                title="Resolver diferencia"
                onClick={() => setResolveOpen(true)}
                disabled={saving}
              >
                <i className="bi bi-shield-check" />
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
                    {cierre?.resolucion_codigo && !['CAJA_CUADRA', 'PENDIENTE_REVISION'].includes(cierre.resolucion_codigo) ? (
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
                      tone={Number(differenceAmount) < 0 ? 'expense' : 'income'}
                      icon="bi-activity"
                    />
                  ) : null}
                </div>
              </section>

              {canSubmitResolution ? (
                <section className="cierres-caja-detail-resolution-cta">
                  <div>
                    <strong>Resolucion administrativa pendiente</strong>
                    <span>Registra una decision para cerrar la revision de esta diferencia.</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setResolveOpen(true)}
                    disabled={saving}
                  >
                    <i className="bi bi-shield-check me-2" />
                    Resolver diferencia
                  </button>
                </section>
              ) : null}

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

      <CierreCajaResolverDiferenciaModal
        open={resolveOpen && canSubmitResolution}
        detalle={detalle}
        saving={saving}
        onClose={() => setResolveOpen(false)}
        onSubmit={onResolveDifference}
      />
    </div>
  );
}
