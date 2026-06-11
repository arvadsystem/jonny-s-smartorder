export const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const resolveSalesRangeWindow = (rangeKey = 'day') => {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);

  if (rangeKey === 'week') {
    const dayOfWeek = end.getDay();
    const mondayOffset = (dayOfWeek + 6) % 7;
    start.setDate(end.getDate() - mondayOffset);
  } else if (rangeKey === 'month') {
    start.setDate(1);
  }

  const fechaDesde = formatDateInput(start);
  const fechaHasta = formatDateInput(end);

  if (rangeKey === 'week') {
    return {
      fechaDesde,
      fechaHasta,
      rangeLabel: 'Semana actual',
      summaryLabel: `${fechaDesde} al ${fechaHasta}`
    };
  }

  if (rangeKey === 'month') {
    return {
      fechaDesde,
      fechaHasta,
      rangeLabel: 'Mes actual',
      summaryLabel: `${fechaDesde} al ${fechaHasta}`
    };
  }

  return {
    fechaDesde,
    fechaHasta,
    rangeLabel: 'Día actual',
    summaryLabel: fechaHasta
  };
};

export const resolvePreviousSalesRangeWindow = ({ fechaDesde, fechaHasta, rangeLabel }) => {
  const start = new Date(`${fechaDesde}T00:00:00`);
  const end = new Date(`${fechaHasta}T00:00:00`);
  const diffDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  const previousEnd = new Date(start);
  previousEnd.setDate(start.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - diffDays);

  return {
    fechaDesde: formatDateInput(previousStart),
    fechaHasta: formatDateInput(previousEnd),
    rangeLabel: `Comparativo ${rangeLabel.toLowerCase()}`,
    summaryLabel: `${formatDateInput(previousStart)} al ${formatDateInput(previousEnd)}`
  };
};
