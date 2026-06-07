import { useEffect, useMemo, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import sucursalesService from '../../../../services/sucursalesService';
import {
  DIAS_SEMANA,
  FECHA_ESPECIAL_TIPOS,
  extractApiMessage,
  normalizeTime,
  validateFechaEspecial,
  validateHorarioRegular
} from '../utils/sucursalHelpers';
import SucursalFechasEspecialesTable from './SucursalFechasEspecialesTable';
import SucursalFechaEspecialModal from './SucursalFechaEspecialModal';
import SucursalHorarioRegularForm from './SucursalHorarioRegularForm';

const buildDefaultHorarios = () =>
  DIAS_SEMANA.map((day) => ({
    dia_semana: day.value,
    hora_inicio: '',
    hora_final: '',
    cerrado: true,
    estado: true
  }));

const looksTechnical = (message) => /sql|stack|constraint|relation|column|pg_/i.test(String(message || ''));
const safeMessage = (message, fallback) => (looksTechnical(message) ? fallback : String(message || fallback));
const LAST_SUCURSAL_STORAGE_KEY = 'jonny_s_sucursales_horarios_last_sucursal';

export default function SucursalHorariosTab({ sucursales = [], canManage = false }) {
  const [selectedSucursalId, setSelectedSucursalId] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [savingHorarios, setSavingHorarios] = useState(false);
  const [savingFecha, setSavingFecha] = useState(false);
  const [horarios, setHorarios] = useState(buildDefaultHorarios);
  const [fechasEspeciales, setFechasEspeciales] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFecha, setEditingFecha] = useState(null);

  const selectedId = Number(selectedSucursalId || 0);

  const sucursalOptions = useMemo(
    () => (Array.isArray(sucursales) ? sucursales : []).map((s) => ({
      id: Number(s?.id_sucursal || 0),
      label: `${s?.nombre_sucursal || 'Sucursal'}${s?.estado === false ? ' (Inactiva)' : ''}`
    })).filter((s) => s.id > 0),
    [sucursales]
  );
  const sucursalSelectOptions = useMemo(
    () => sucursalOptions.map((option) => ({
      value: String(option.id),
      label: option.label
    })),
    [sucursalOptions]
  );
  const selectedSucursal = useMemo(
    () => sucursalOptions.find((option) => Number(option.id) === selectedId) || null,
    [selectedId, sucursalOptions]
  );

  useEffect(() => {
    if (!sucursalOptions.length || selectedSucursalId) return;
    const storedId = typeof window === 'undefined'
      ? ''
      : window.localStorage.getItem(LAST_SUCURSAL_STORAGE_KEY) || '';
    const storedExists = storedId && sucursalOptions.some((option) => String(option.id) === String(storedId));
    setSelectedSucursalId(storedExists ? String(storedId) : String(sucursalOptions[0].id));
  }, [selectedSucursalId, sucursalOptions]);

  const selectSucursal = (value) => {
    const nextValue = String(value || '');
    setSelectedSucursalId(nextValue);
    if (typeof window !== 'undefined' && nextValue) {
      window.localStorage.setItem(LAST_SUCURSAL_STORAGE_KEY, nextValue);
    }
  };

  useEffect(() => {
    if (!selectedId) {
      setHorarios(buildDefaultHorarios());
      setFechasEspeciales([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingData(true);
      setError('');
      try {
        const [horariosRes, fechasRes] = await Promise.all([
          sucursalesService.obtenerHorariosSucursal(selectedId),
          sucursalesService.obtenerFechasEspecialesSucursal(selectedId)
        ]);

        if (cancelled) return;

        const horariosRows = Array.isArray(horariosRes?.data) ? horariosRes.data : [];
        const byDay = new Map(horariosRows.map((row) => [Number(row?.dia_semana), row]));
        setHorarios(
          DIAS_SEMANA.map((day) => {
            const row = byDay.get(day.value);
            return {
              dia_semana: day.value,
              hora_inicio: row?.hora_inicio ? String(row.hora_inicio).slice(0, 5) : '',
              hora_final: row?.hora_final ? String(row.hora_final).slice(0, 5) : '',
              cerrado: row ? Boolean(row.cerrado) : true,
              estado: row ? Boolean(row.estado) : true
            };
          })
        );

        setFechasEspeciales(Array.isArray(fechasRes?.data) ? fechasRes.data : []);
      } catch (err) {
        if (!cancelled) {
          setError(safeMessage(extractApiMessage(err, 'No se pudieron cargar los horarios.'), 'No se pudieron cargar los horarios.'));
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [selectedId]);

  const onHorarioChange = (dia, field, value) => {
    setHorarios((prev) => prev.map((row) => {
      if (row.dia_semana !== dia) return row;
      const next = { ...row, [field]: value };
      if (field === 'cerrado' && value === true) {
        next.hora_inicio = '';
        next.hora_final = '';
      }
      return next;
    }));
  };

  const onSaveHorarios = async () => {
    setError('');
    setNotice('');
    const payload = horarios.map((row) => ({
      dia_semana: row.dia_semana,
      cerrado: Boolean(row.cerrado),
      estado: Boolean(row.estado),
      hora_inicio: row.cerrado ? null : normalizeTime(row.hora_inicio),
      hora_final: row.cerrado ? null : normalizeTime(row.hora_final)
    }));

    const validation = validateHorarioRegular(payload);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setSavingHorarios(true);
    try {
      await sucursalesService.guardarHorariosSucursal(selectedId, payload);
      setNotice('Horarios actualizados correctamente.');
    } catch (err) {
      setError(safeMessage(extractApiMessage(err, 'No se pudieron guardar los horarios. Verifica los datos ingresados.'), 'No se pudieron guardar los horarios. Verifica los datos ingresados.'));
    } finally {
      setSavingHorarios(false);
    }
  };

  const onOpenCreateFecha = () => {
    setEditingFecha(null);
    setModalOpen(true);
  };

  const onOpenEditFecha = (row) => {
    setEditingFecha(row);
    setModalOpen(true);
  };

  const onSubmitFecha = async (values) => {
    const validation = validateFechaEspecial(values);
    if (!validation.ok) {
      throw new Error(validation.message);
    }

    setSavingFecha(true);
    try {
      if (editingFecha?.id_fecha_especial) {
        await sucursalesService.actualizarFechaEspecialSucursal(selectedId, editingFecha.id_fecha_especial, validation.payload);
        setNotice('Fecha especial actualizada correctamente.');
      } else {
        await sucursalesService.crearFechaEspecialSucursal(selectedId, validation.payload);
        setNotice('Fecha especial creada correctamente.');
      }
      const fechasRes = await sucursalesService.obtenerFechasEspecialesSucursal(selectedId);
      setFechasEspeciales(Array.isArray(fechasRes?.data) ? fechasRes.data : []);
      setModalOpen(false);
    } catch (err) {
      const msg = extractApiMessage(err, 'No se pudo guardar la fecha especial.');
      throw new Error(safeMessage(msg, 'No se pudo guardar la fecha especial.'));
    } finally {
      setSavingFecha(false);
    }
  };

  const onDesactivarFecha = async (row) => {
    if (!row?.id_fecha_especial) return;
    setSavingFecha(true);
    setError('');
    try {
      await sucursalesService.eliminarFechaEspecialSucursal(selectedId, row.id_fecha_especial);
      setNotice('Fecha especial desactivada correctamente.');
      setFechasEspeciales((prev) => prev.map((item) =>
        Number(item?.id_fecha_especial) === Number(row.id_fecha_especial) ? { ...item, estado: false } : item
      ));
    } catch (err) {
      setError(safeMessage(extractApiMessage(err, 'No se pudo guardar la fecha especial.'), 'No se pudo guardar la fecha especial.'));
    } finally {
      setSavingFecha(false);
    }
  };

  if (!canManage) {
    return <div className="alert alert-warning mb-0">No tienes permisos para gestionar horarios de sucursales.</div>;
  }

  return (
    <div className="suc-horarios-page">
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <AppSelect
            label="Sucursal"
            value={selectedSucursalId}
            options={sucursalSelectOptions}
            onChange={selectSucursal}
            placeholder="Selecciona una sucursal"
            searchable
            searchPlaceholder="Buscar sucursal..."
            className="suc-app-select"
          />
          {!selectedId ? <p className="text-muted small mt-2 mb-0">Selecciona una sucursal para configurar sus horarios.</p> : null}
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {notice ? <div className="alert alert-success">{notice}</div> : null}

      {selectedId ? (
        <>
          <SucursalHorarioRegularForm
            horarios={horarios}
            loading={loadingData}
            saving={savingHorarios}
            sucursalNombre={selectedSucursal?.label || ''}
            onChange={onHorarioChange}
            onSave={onSaveHorarios}
          />

          <div className="card border-0 shadow-sm suc-horarios-special-card">
            <div className="card-body">
              <div className="suc-horarios-section-head">
                <h5 className="mb-0">Fechas especiales</h5>
                {fechasEspeciales.length > 0 ? (
                  <button type="button" className="btn inv-prod-btn-outline" onClick={onOpenCreateFecha} disabled={savingFecha || loadingData}>
                    Nueva fecha especial
                  </button>
                ) : null}
              </div>

              <SucursalFechasEspecialesTable
                rows={fechasEspeciales}
                loading={loadingData}
                onEdit={onOpenEditFecha}
                onDeactivate={onDesactivarFecha}
                onCreate={onOpenCreateFecha}
                saving={savingFecha}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="suc-horarios-empty card border-0 shadow-sm">
          <div className="card-body">
            <i className="bi bi-shop-window" />
            <strong>No hay sucursales disponibles.</strong>
            <span>Cuando exista al menos una sucursal, sus horarios se cargaran aqui automaticamente.</span>
          </div>
        </div>
      )}

      {selectedId ? (
        <SucursalFechaEspecialModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={onSubmitFecha}
          saving={savingFecha}
          tipos={FECHA_ESPECIAL_TIPOS}
          initialData={editingFecha}
        />
      ) : null}
    </div>
  );
}
