import React, { useMemo } from 'react';
import Select from 'react-select';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const tooltipStyle = {
  borderRadius: 14,
  border: '1px solid rgba(219, 202, 179, 0.9)',
  boxShadow: '0 14px 30px rgba(66, 40, 20, 0.12)'
};

const buildPanelSelectStyles = () => ({
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    borderRadius: 14,
    borderColor: state.isFocused ? '#c58a54' : '#e8d8c4',
    background: '#fffdfa',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(197, 138, 84, 0.12)' : 'none',
    '&:hover': {
      borderColor: '#c58a54'
    }
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '4px 12px'
  }),
  singleValue: (base) => ({
    ...base,
    color: '#493324'
  }),
  placeholder: (base) => ({
    ...base,
    color: '#8e7057'
  }),
  input: (base) => ({
    ...base,
    color: '#493324'
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({
    ...base,
    color: '#8e7057'
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid #ead8c1',
    boxShadow: '0 18px 32px rgba(59, 33, 14, 0.16)',
    zIndex: 30
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#8c522f' : state.isFocused ? '#f7efe4' : '#ffffff',
    color: state.isSelected ? '#ffffff' : '#493324',
    cursor: 'pointer'
  })
});

const buildHourOptions = () => {
  const rows = [{ value: 'all', label: 'Todas las horas' }];
  for (let hour = 0; hour < 24; hour += 1) {
    const label = `${String(hour).padStart(2, '0')}:00`;
    rows.push({ value: label, label });
  }
  return rows;
};

const OrdersFlowChart = ({
  data = [],
  usesFallback = false,
  selectedDate,
  onDateChange,
  selectedHour = 'all',
  onHourChange
}) => {
  const hourOptions = useMemo(() => buildHourOptions(), []);
  const selectedHourOption = useMemo(
    () => hourOptions.find((option) => option.value === selectedHour) || null,
    [hourOptions, selectedHour]
  );
  const highlightedPoint = useMemo(
    () => (selectedHour === 'all' ? null : data.find((row) => row?.hour === selectedHour) || null),
    [data, selectedHour]
  );
  const chartData = useMemo(
    () => data.map((row) => ({ ...row, foco: selectedHour !== 'all' && row?.hour === selectedHour })),
    [data, selectedHour]
  );
  const totalPedidos = useMemo(
    () => chartData.reduce((acc, row) => acc + (Number(row?.pedidos) || 0), 0),
    [chartData]
  );
  const focusedShare = highlightedPoint
    ? totalPedidos > 0
      ? ((Number(highlightedPoint.pedidos || 0) / totalPedidos) * 100).toFixed(1)
      : '0.0'
    : '0.0';

  return (
    <section className="inicio-panel inicio-panel--chart inicio-panel--wide">
      <header className="inicio-panel__head inicio-panel__head--stacked">
        <div>
          <h2>Flujo de pedidos por hora</h2>
          <p>Consulta la actividad operativa por fecha y enfócate en una hora específica del día.</p>
        </div>

        <div className="inicio-panel__filters" aria-label="Filtros del gráfico de pedidos">
          <label className="inicio-panel__filter">
            <span>Fecha</span>
            <input
              type="date"
              value={selectedDate || ''}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => onDateChange?.(event.target.value)}
              aria-label="Seleccionar fecha del flujo de pedidos"
            />
          </label>

          <label className="inicio-panel__filter">
            <span>Hora</span>
            <Select
              classNamePrefix="inicio-rs"
              className="inicio-rs"
              options={hourOptions}
              value={selectedHourOption}
              onChange={(option) => onHourChange?.(option?.value || 'all')}
              placeholder="Todas las horas"
              noOptionsMessage={() => 'No hay horas disponibles'}
              isSearchable
              isClearable={false}
              styles={buildPanelSelectStyles()}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              menuPosition="fixed"
              aria-label="Seleccionar hora del flujo de pedidos"
            />
          </label>
        </div>
      </header>

      <div className="inicio-chart-card">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="inicioOrdersFlow" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#a35d2b" stopOpacity={0.42} />
                <stop offset="100%" stopColor="#a35d2b" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(194, 177, 153, 0.35)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: '#6f6258', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#6f6258', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: 'rgba(140, 86, 47, 0.4)', strokeWidth: 1.2 }}
              contentStyle={tooltipStyle}
              formatter={(value) => [`${value}`, 'Pedidos']}
              labelFormatter={(label) => `Hora: ${label}`}
            />
            {selectedHour !== 'all' ? (
              <ReferenceLine x={selectedHour} stroke="#c94f43" strokeWidth={2} strokeDasharray="5 5" />
            ) : null}
            <Area
              type="monotone"
              dataKey="pedidos"
              stroke="#8c522f"
              strokeWidth={3}
              fill="url(#inicioOrdersFlow)"
              dot={(props) => (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={props.payload?.foco ? 6 : 4}
                  strokeWidth={2}
                  stroke={props.payload?.foco ? '#c94f43' : '#8c522f'}
                  fill="#fff"
                />
              )}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="inicio-panel__insight" role="status" aria-live="polite">
        <strong>{selectedDate || 'Sin fecha'}</strong>
        <span>
          {highlightedPoint
            ? `${highlightedPoint.pedidos} pedidos registrados a las ${highlightedPoint.hour}. Representa ${focusedShare}% del flujo del día.`
            : selectedHour === 'all'
              ? 'Selecciona una hora para ver el detalle puntual y su peso dentro del flujo diario.'
              : `No se registran pedidos a las ${selectedHour} para la fecha seleccionada.`}
        </span>
      </div>

      {usesFallback ? (
        <div className="inicio-chart-note" role="note">
          Mostrando datos temporales de referencia. Aún no existe una fuente horaria consolidada para esta consulta.
        </div>
      ) : null}
    </section>
  );
};

export default OrdersFlowChart;
