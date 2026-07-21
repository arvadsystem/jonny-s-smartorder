import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultVentasTemporalFilters,
  getTegucigalpaToday,
  getVentasCashierMinDate,
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
