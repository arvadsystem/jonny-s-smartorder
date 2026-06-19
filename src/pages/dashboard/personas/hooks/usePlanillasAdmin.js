import { useCallback, useState } from 'react';

export default function usePlanillasAdmin({
  initialSucursal = '',
  initialPeriodo = '',
  initialTipoPeriodo = 'mensual',
  initialQuincena = '1',
  buildInitialFilters
} = {}) {
  const [selectedSucursal, setSelectedSucursal] = useState(initialSucursal);
  const [periodo, setPeriodo] = useState(initialPeriodo);
  const [tipoPeriodo, setTipoPeriodo] = useState(initialTipoPeriodo);
  const [quincena, setQuincena] = useState(initialQuincena);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [listPage, setListPage] = useState(1);
  const [filters, setFilters] = useState(() => buildInitialFilters(initialSucursal));
  const [selectedPlanillaId, setSelectedPlanillaId] = useState('');
  const [planillaPeriodoLookup, setPlanillaPeriodoLookup] = useState({
    loading: false,
    hasPlanilla: false,
    idPlanilla: 0
  });
  const [detallePage, setDetallePage] = useState(1);

  const clearFilters = useCallback(() => {
    setFilters((previous) => ({
      ...buildInitialFilters(selectedSucursal),
      _expanded: previous?._expanded
    }));
  }, [buildInitialFilters, selectedSucursal]);

  return {
    selectedSucursal,
    setSelectedSucursal,
    periodo,
    setPeriodo,
    tipoPeriodo,
    setTipoPeriodo,
    quincena,
    setQuincena,
    estadoFiltro,
    setEstadoFiltro,
    listPage,
    setListPage,
    filters,
    setFilters,
    clearFilters,
    selectedPlanillaId,
    setSelectedPlanillaId,
    planillaPeriodoLookup,
    setPlanillaPeriodoLookup,
    detallePage,
    setDetallePage
  };
}
