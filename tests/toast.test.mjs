import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function makeToasts() {
  const timers = new Map();
  const delays = new Map();
  let now = 0;
  let timerId = 0;
  const signal = (value) => {
    const read = () => value;
    read.set = (next) => {
      value = next;
    };
    read.update = (update) => {
      value = update(value);
    };
    return read;
  };
  const source = readFileSync(
    new URL('../src/app/core/services/toast.service.ts', import.meta.url),
    'utf8',
  );
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.equal(name, '@angular/core');
        return { Injectable: () => (target) => target, signal };
      },
      Date: { now: () => now },
      setTimeout: (callback, delay) => {
        timers.set(++timerId, callback);
        delays.set(timerId, delay);
        return timerId;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  );
  return {
    toasts: new exports.ToastService(),
    timers,
    delays,
    advance: (ms) => {
      now += ms;
    },
  };
}

test('toasts support kinds, skip blanks, deduplicate and limit visible messages', () => {
  const { toasts } = makeToasts();
  assert.equal(toasts.info(' '), 0);
  const first = toasts.error(' Error de conexión ');
  assert.equal(toasts.error('Error de conexión'), first);
  toasts.success('Guardado');
  toasts.warning('Revisa');
  toasts.info('Información');
  assert.equal(toasts.messages().length, 4);
  toasts.info('Otro');
  assert.equal(toasts.messages().length, 4);
  assert.equal(
    toasts.messages().some((item) => item.id === first),
    false,
  );
  toasts.ngOnDestroy();
});

test('errors remain visible; other toasts pause, resume and auto-dismiss without retaining timers', () => {
  const { toasts, timers } = makeToasts();
  const error = toasts.error('No se pudo guardar');
  assert.equal(timers.size, 0);
  const success = toasts.success('Guardado');
  assert.equal(timers.size, 1);
  toasts.pause(success);
  assert.equal(timers.size, 0);
  toasts.resume(success);
  [...timers.values()][0]();
  assert.equal(toasts.messages().length, 1);
  assert.equal(toasts.messages()[0].id, error);
  assert.equal(timers.size, 0);
  toasts.dismiss(error);
  assert.equal(toasts.messages().length, 0);
  toasts.info('Temporal');
  toasts.ngOnDestroy();
  assert.equal(timers.size, 0);
});

test('ticket rows preserve native keyboard button and expose delivery version', () => {
  const template = readFileSync(
    new URL('../src/app/shared/components/ticket-table.component.html', import.meta.url),
    'utf8',
  );
  assert.match(template, /<tr class="ticket-row" \(click\)="editor.open\('ticket', t\)"/);
  assert.match(template, /\$event.stopPropagation\(\); editor.open/);
  assert.match(template, /<button type="button"/);
  assert.match(template, /target_version \|\| 'Sin versión'/);
});

test('toast countdown preserves remaining time across overlapping hover and focus pauses', () => {
  const { toasts, timers, delays, advance } = makeToasts();
  const id = toasts.success('Guardado');
  assert.equal([...delays.values()].at(-1), 6000);
  advance(2000);
  toasts.pause(id, 'hover');
  assert.equal(toasts.messages()[0].paused, true);
  advance(1000);
  toasts.pause(id, 'focus');
  toasts.resume(id, 'hover');
  assert.equal(timers.size, 0);
  assert.equal(toasts.messages()[0].paused, true);
  advance(1000);
  toasts.resume(id, 'focus');
  assert.equal(toasts.messages()[0].paused, false);
  assert.equal([...delays.values()].at(-1), 4000);
  toasts.resume(id, 'hover');
  assert.equal(timers.size, 1);
  advance(1000);
  toasts.pause(id, 'hover');
  toasts.resume(id, 'hover');
  assert.equal([...delays.values()].at(-1), 3000);
  toasts.ngOnDestroy();
  assert.equal(timers.size, 0);
});

test('new toasts append below existing ones without resetting their countdown', () => {
  const { toasts, timers, advance } = makeToasts();
  const first = toasts.info('Primero');
  advance(2000);
  const second = toasts.success('Segundo');
  assert.deepEqual(
    Array.from(toasts.messages(), (item) => item.id),
    [first, second],
  );
  [...timers.values()][0]();
  assert.deepEqual(
    Array.from(toasts.messages(), (item) => item.id),
    [second],
  );
  toasts.ngOnDestroy();
});

test('compact toast uses registered status icons, an accessible hidden label and the countdown', () => {
  const base = '../src/app/shared/components/toast/';
  const component = readFileSync(new URL(base + 'toast.component.ts', import.meta.url), 'utf8');
  const template = readFileSync(new URL(base + 'toast.component.html', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../src/app/app.config.ts', import.meta.url), 'utf8');
  for (const [name, symbol] of [
    ['circle-check', 'LucideCircleCheck'],
    ['circle-alert', 'LucideCircleAlert'],
    ['triangle-alert', 'LucideTriangleAlert'],
    ['info', 'LucideInfo'],
  ]) {
    assert.ok(component.includes(`'${name}'`));
    assert.equal((config.match(new RegExp('\\b' + symbol + '\\b', 'g')) || []).length, 2);
  }
  assert.doesNotMatch(template, /<strong/);
  assert.match(template, /class="sr-only"/);
  assert.match(template, /\[name\]="icons\[item.kind\]"/);
  assert.match(template, /item.kind !== 'error'/);
  assert.match(template, /toast-countdown-fill/);
  assert.match(template, /toasts.dismiss\(item.id\)/);
});
