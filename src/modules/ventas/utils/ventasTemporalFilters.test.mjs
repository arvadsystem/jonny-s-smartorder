import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultVentasTemporalFilters,
  getMillisecondsUntilNextTegucigalpaDay,
  getTegucigalpaToday,
  getVentasCashierMinDate,
  resolveVentasFiltersForTegucigalpaDayChange,
  validateVentasTemporalFilters
} from './ventasTemporalFilters.js';

const NOW = new Date('2026-07-21T18:30:00.000Z');

test('los valores iniciales usan hoy en Tegucigalpa y no la zona del navegador', () => {
  assert.equal(getTegucigalpaToday(new Date('2026-07-21T03:30:00.000Z')), '2026-07-20');
  assert.deepEqual(createDefaultVentasTemporalFilters(NOW), {
    fechaDesde: '2026-07-21',
    fechaHasta: '2026-07-21',
    horaDesde: '',
    horaHasta: ''
  });
});

test('acepta un dia completo y un rango horario creciente', () => {
  assert.equal(validateVentasTemporalFilters({ fechaDesde: '2026-07-20', fechaHasta: '2026-07-20' }, { now: NOW }).ok, true);
  assert.equal(validateVentasTemporalFilters({
    fechaDesde: '2026-07-20', fechaHasta: '2026-07-20', horaDesde: '08:00', horaHasta: '12:00'
  }, { now: NOW }).ok, true);
});

test('bloquea fecha futura, rango invertido y horas invalidas', () => {
  assert.equal(validateVentasTemporalFilters({ fechaDesde: '2026-07-22', fechaHasta: '2026-07-22' }, { now: NOW }).code, 'VENTAS_FECHA_FUTURA');
  assert.equal(validateVentasTemporalFilters({ fechaDesde: '2026-07-20', fechaHasta: '2026-07-19' }, { now: NOW }).code, 'VENTAS_RANGO_FECHAS_INVALIDO');
  assert.equal(validateVentasTemporalFilters({ fechaDesde: '2026-07-20', fechaHasta: '2026-07-20', horaDesde: '08:00' }, { now: NOW }).code, 'VENTAS_HORAS_INCOMPLETAS');
  assert.equal(validateVentasTemporalFilters({ fechaDesde: '2026-07-20', fechaHasta: '2026-07-20', horaDesde: '12:00', horaHasta: '12:00' }, { now: NOW }).code, 'VENTAS_RANGO_HORAS_INVALIDO');
  assert.equal(validateVentasTemporalFilters({ fechaDesde: '2026-07-19', fechaHasta: '2026-07-20', horaDesde: '08:00', horaHasta: '09:00' }, { now: NOW }).code, 'VENTAS_HORAS_REQUIEREN_UN_DIA');
});

test('expone el dia minimo visual y valida el limite exacto de 72 horas', () => {
  assert.equal(getVentasCashierMinDate(NOW), '2026-07-18');
  assert.equal(validateVentasTemporalFilters({
    fechaDesde: '2026-07-18', fechaHasta: '2026-07-18', horaDesde: '12:30', horaHasta: '13:00'
  }, { now: NOW, limitedToLast72Hours: true }).ok, true);
  assert.equal(validateVentasTemporalFilters({
    fechaDesde: '2026-07-18', fechaHasta: '2026-07-18', horaDesde: '12:29', horaHasta: '13:00'
  }, { now: NOW, limitedToLast72Hours: true }).code, 'VENTAS_RANGO_72H_EXCEDIDO');
});

test('redondea el corte de 72 horas al inicio del minuto', () => {
  for (const now of [
    '2026-07-21T18:30:00.000Z',
    '2026-07-21T18:30:01.000Z',
    '2026-07-21T18:30:45.000Z',
    '2026-07-21T18:30:59.999Z'
  ]) {
    assert.equal(validateVentasTemporalFilters({
      fechaDesde: '2026-07-18', fechaHasta: '2026-07-18', horaDesde: '12:30', horaHasta: '12:31'
    }, { now: new Date(now), limitedToLast72Hours: true }).ok, true, now);
  }
  assert.equal(validateVentasTemporalFilters({
    fechaDesde: '2026-07-18', fechaHasta: '2026-07-18', horaDesde: '12:29', horaHasta: '12:31'
  }, { now: new Date('2026-07-21T18:30:59.999Z'), limitedToLast72Hours: true }).code, 'VENTAS_RANGO_72H_EXCEDIDO');
});

test('el corte cruza correctamente dia, mes, anio y febrero bisiesto', () => {
  const cases = [
    { now: '2026-07-22T05:05:45.000Z', date: '2026-07-18', from: '23:05' },
    { now: '2026-03-01T06:15:45.000Z', date: '2026-02-26', from: '00:15' },
    { now: '2026-01-01T06:15:45.000Z', date: '2025-12-29', from: '00:15' },
    { now: '2024-03-01T06:15:45.000Z', date: '2024-02-27', from: '00:15' }
  ];
  for (const item of cases) {
    assert.equal(validateVentasTemporalFilters({
      fechaDesde: item.date, fechaHasta: item.date, horaDesde: item.from, horaHasta: '23:59'
    }, { now: new Date(item.now), limitedToLast72Hours: true }).ok, true, JSON.stringify(item));
  }
});

test('calcula la proxima medianoche exclusivamente en Tegucigalpa', () => {
  assert.equal(getMillisecondsUntilNextTegucigalpaDay(new Date('2026-07-22T05:59:59.000Z')), 1000);
  assert.equal(getMillisecondsUntilNextTegucigalpaDay(new Date('2026-07-22T06:00:00.000Z')), 24 * 60 * 60 * 1000);
});

test('cambio de dia actualiza solo el rango predeterminado y conserva otros filtros', () => {
  const current = {
    search: 'ana', idSucursal: 4, estado: 'COMPLETADA',
    fechaDesde: '2026-07-21', fechaHasta: '2026-07-21', horaDesde: '', horaHasta: '', page: 3
  };
  const result = resolveVentasFiltersForTegucigalpaDayChange(current, {
    previousToday: '2026-07-21', nextToday: '2026-07-22', followDefaultRange: true
  });
  assert.equal(result.changed, true);
  assert.deepEqual(result.filters, {
    ...current, fechaDesde: '2026-07-22', fechaHasta: '2026-07-22', page: 1
  });
});

test('cambio de dia respeta fecha manual, rango horario y modo manual', () => {
  const options = { previousToday: '2026-07-21', nextToday: '2026-07-22', followDefaultRange: true };
  const manualDate = { fechaDesde: '2026-07-20', fechaHasta: '2026-07-20', horaDesde: '', horaHasta: '', page: 2 };
  const manualHours = { fechaDesde: '2026-07-21', fechaHasta: '2026-07-21', horaDesde: '08:00', horaHasta: '09:00', page: 2 };
  const defaultButManual = { fechaDesde: '2026-07-21', fechaHasta: '2026-07-21', horaDesde: '', horaHasta: '', page: 2 };
  assert.equal(resolveVentasFiltersForTegucigalpaDayChange(manualDate, options).changed, false);
  assert.equal(resolveVentasFiltersForTegucigalpaDayChange(manualHours, options).changed, false);
  assert.equal(resolveVentasFiltersForTegucigalpaDayChange(defaultButManual, { ...options, followDefaultRange: false }).changed, false);
});
