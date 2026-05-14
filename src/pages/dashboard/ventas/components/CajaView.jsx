import { useState } from 'react';
import VentaComposerCatalog from './VentaComposerCatalog';
import VentaComposerSummary from './VentaComposerSummary';
import { useVentaComposer } from '../hooks/useVentaComposer';
import cajasService from '../../../../services/cajasService';
import VentaCajaAutoAuxiliarModal from './VentaCajaAutoAuxiliarModal';
import VentaComplementosModal from './VentaComplementosModal';

export default function CajaView({
  sucursales,
  isSuperAdmin,
  defaultSucursalId,
  productos,
  categorias,
  tiposDepartamento,
  clientes,
  combos,
  recetas,
  descuentosCatalogo,
  canApplyDiscount,
  catalogLoading,
  catalogErrors,
  saving,
  onSubmit
}) {
  const toSafeMessage = (error, fallback) => {
    if (String(error?.code || '').trim().toUpperCase() === 'AUTO_AUXILIAR_ENDPOINT_UNAVAILABLE') {
      return 'No se pudo registrar porque esta función aún no está habilitada en el backend en ejecución. Reinicia el backend actualizado.';
    }
    const raw = String(error?.message || '').trim();
    if (!raw) return fallback;
    if (raw.includes('<!DOCTYPE html') || raw.includes('<html')) return fallback;
    return raw;
  };

  const normalizeOpenSessions = (rows) =>
    (Array.isArray(rows) ? rows : []).map((row) => ({
      id_sesion_caja: row.id_sesion_caja,
      id_caja: row.id_caja,
      id_sucursal: row.id_sucursal,
      codigo_caja: row.codigo_caja,
      nombre_caja: row.nombre_caja,
      nombre_sucursal: row.nombre_sucursal,
      responsable_nombre: row.responsable_nombre,
      fecha_apertura: row.fecha_apertura
    }));

  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [autoModalLoading, setAutoModalLoading] = useState(false);
  const [autoModalAssigning, setAutoModalAssigning] = useState(false);
  const [autoModalError, setAutoModalError] = useState('');
  const [sesionesAbiertas, setSesionesAbiertas] = useState([]);
  const [selectedSesion, setSelectedSesion] = useState('');

  const composer = useVentaComposer({
    productos,
    categorias,
    tiposDepartamento,
    clientes,
    combos,
    recetas,
    descuentosCatalogo,
    canApplyDiscount,
    sucursales,
    isSuperAdmin,
    defaultSucursalId,
    onSubmit,
    onRequireAutoAuxiliar: async ({ idSucursal }) => {
      if (!isSuperAdmin) return;
      setAutoModalError('');
      setAutoModalLoading(true);
      setAutoModalOpen(true);
      try {
        const rows = normalizeOpenSessions(
          await cajasService.listSesionesAbiertasSafe({ id_sucursal: idSucursal })
        );

        setSesionesAbiertas(rows);
        setSelectedSesion(rows.length > 0 ? String(rows[0].id_sesion_caja) : '');
        if (rows.length === 0) {
          setAutoModalError('No hay cajas activas con sesión abierta para la sucursal seleccionada.');
        }
      } catch (error) {
        setSesionesAbiertas([]);
        setSelectedSesion('');
        setAutoModalError(toSafeMessage(error, 'No se pudieron cargar sesiones abiertas.'));
      } finally {
        setAutoModalLoading(false);
      }
    }
  });

  const closeAutoModal = () => {
    if (autoModalAssigning) return;
    setAutoModalOpen(false);
  };

  const confirmAutoAsignacion = async () => {
    const idSesionCaja = Number.parseInt(String(selectedSesion || ''), 10);
    const idSucursal = Number.parseInt(String(composer.selectedSucursal || ''), 10);
    if (!idSesionCaja || !idSucursal) return;
    setAutoModalAssigning(true);
    setAutoModalError('');
    try {
      await cajasService.autoAsignarAuxiliarSesionSafe(idSesionCaja, { id_sucursal: idSucursal });
      composer.setTemporarySessionId(String(idSesionCaja));
      composer.setPartialState({ submitError: '' });
      setAutoModalOpen(false);
    } catch (error) {
      setAutoModalError(toSafeMessage(error, 'No se pudo registrar la autoasignación temporal.'));
    } finally {
      setAutoModalAssigning(false);
    }
  };

  return (
    <div className="ventas-page ventas-caja-page">
      <div className="inv-catpro-card inv-prod-card ventas-caja-card">
        <form className="ventas-create-modal__body ventas-caja__body" onSubmit={composer.handleSubmit}>
          <VentaComposerCatalog
            composer={composer}
            catalogLoading={catalogLoading}
            catalogErrors={catalogErrors}
          />
          <VentaComposerSummary composer={composer} saving={saving} />
        </form>
      </div>
      <VentaCajaAutoAuxiliarModal
        open={autoModalOpen}
        loading={autoModalLoading}
        sessions={sesionesAbiertas}
        selectedSessionId={selectedSesion}
        assigning={autoModalAssigning}
        errorMessage={autoModalError}
        onSelectSession={setSelectedSesion}
        onConfirm={confirmAutoAsignacion}
        onClose={closeAutoModal}
      />
      <VentaComplementosModal
        key={`${composer.complementModal.mode}:${composer.complementModal.cartKey || composer.complementModal.row?.entityId || composer.complementModal.row?.id_combo || composer.complementModal.row?.id_receta || ''}:${composer.complementModal.open ? '1' : '0'}`}
        open={composer.complementModal.open}
        mode={composer.complementModal.mode}
        row={composer.complementModal.row}
        selected={composer.complementModal.selected}
        error={composer.complementModal.error}
        onCancel={composer.closeComplementModal}
        onConfirm={composer.confirmComplementModal}
      />
    </div>
  );
}
