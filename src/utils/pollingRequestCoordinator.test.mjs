import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePollingDelay, createPollingRequestCoordinator } from './pollingRequestCoordinator.mjs';

test('polling coordinator prevents overlapping requests', () => {
  const coordinator = createPollingRequestCoordinator();
  const first = coordinator.begin('sucursal:1');
  assert.ok(first);
  assert.equal(coordinator.begin('sucursal:1'), null);
  assert.equal(coordinator.hasActiveRequest(), true);
  assert.equal(coordinator.finish(first, { success: true }), true);
  assert.equal(coordinator.hasActiveRequest(), false);
});

test('cancel aborts the active request and rejects late responses', () => {
  const coordinator = createPollingRequestCoordinator();
  const stale = coordinator.begin('sucursal:1');
  coordinator.cancel();
  assert.equal(stale.controller.signal.aborted, true);
  assert.equal(coordinator.isCurrent(stale), false);
  assert.equal(coordinator.finish(stale, { success: true }), false);
  assert.ok(coordinator.begin('sucursal:2'));
});

test('temporary failures back off exponentially and success restores cadence', () => {
  const coordinator = createPollingRequestCoordinator({ baseDelayMs: 8_000, maxDelayMs: 32_000 });
  for (const expectedDelay of [16_000, 32_000, 32_000]) {
    const token = coordinator.begin();
    coordinator.finish(token, { success: false });
    assert.equal(coordinator.getNextDelay(), expectedDelay);
  }
  const recovered = coordinator.begin();
  coordinator.finish(recovered, { success: true });
  assert.equal(coordinator.getNextDelay(), 8_000);
});

test('delay calculation is bounded and normalizes invalid input', () => {
  assert.equal(calculatePollingDelay(-1, 10_000, 60_000), 10_000);
  assert.equal(calculatePollingDelay(1, 10_000, 60_000), 20_000);
  assert.equal(calculatePollingDelay(20, 10_000, 60_000), 60_000);
});

test('ten kitchen screens remain isolated and each caps concurrency at one', () => {
  const screens = Array.from({ length: 10 }, () => createPollingRequestCoordinator());
  const tokens = screens.map((screen, index) => screen.begin(`screen:${index}`));
  assert.equal(tokens.filter(Boolean).length, 10);
  screens.forEach((screen, index) => {
    assert.equal(screen.begin(`screen:${index}`), null);
    screen.finish(tokens[index], { success: true });
    assert.equal(screen.hasActiveRequest(), false);
  });
});

test('repeated navigation aborts every prior controller without leaking active work', () => {
  const coordinator = createPollingRequestCoordinator();
  const abortedSignals = [];
  for (let index = 0; index < 20; index += 1) {
    const token = coordinator.begin(`visit:${index}`);
    abortedSignals.push(token.controller.signal);
    coordinator.reset();
  }
  assert.equal(abortedSignals.every((signal) => signal.aborted), true);
  assert.equal(coordinator.hasActiveRequest(), false);
});
