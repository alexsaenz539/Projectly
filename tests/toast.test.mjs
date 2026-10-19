import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function makeToasts() {
  const timers = new Map();
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
      setTimeout: (callback) => {
        timers.set(++timerId, callback);
        return timerId;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  );
  return { toasts: new exports.ToastService(), timers };
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
