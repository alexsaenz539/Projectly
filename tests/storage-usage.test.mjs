import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(name, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../src/app/core/services/${name}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, ...globals, require: name => {
    assert.ok(name in dependencies, `Unexpected import: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const model = load('storage-usage-model');
const signal = initial => {
  let value = initial;
  const read = () => value;
  read.set = next => { value = next; };
  return read;
};

function service(demo = false) {
  const effects = [], timers = new Map(), documentEvents = new Map(), windowEvents = new Map();
  let calls = 0, respond = async () => ({ data: [{ used_bytes: '100000000', complete: true }], error: null }), cleanup;
  const auth = { isDemo: demo, user: signal(demo ? null : { id: 'user-a' }),
    client: { rpc: async name => { assert.equal(name, 'project_storage_usage'); calls++; return respond(); } } };
  const document = { visibilityState: 'visible', addEventListener: (name, fn) => documentEvents.set(name, fn), removeEventListener: name => documentEvents.delete(name) };
  const navigator = { onLine: true };
  const { StorageUsageService } = load('storage-usage.service', {
    '@angular/core': { Injectable: () => target => target, inject: () => auth, signal, computed: fn => fn, effect: fn => effects.push(fn), untracked: fn => fn() },
    '../auth/auth.service': {}, './storage-usage-model': model,
  }, { document, navigator,
    window: { addEventListener: (name, fn) => windowEvents.set(name, fn), removeEventListener: name => windowEvents.delete(name) },
    setInterval: (fn, delay) => { assert.equal(delay, 60000); timers.set(1, fn); return 1; },
    clearInterval: id => timers.delete(id),
  });
  const api = new StorageUsageService();
  return { api, auth, document, navigator, timers, documentEvents, windowEvents,
    calls: () => calls, respond: fn => { respond = fn; },
    runEffect: () => { cleanup?.(); cleanup = undefined; effects[0](fn => { cleanup = fn; }); },
  };
}
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test('storage values are validated and formatted without hiding small uploads', () => {
  assert.equal(model.formatStorageBytes(2500), '2,5 KB');
  assert.equal(model.formatStorageBytes(1250000), '1,25 MB');
  assert.equal(model.formatStorageBytes(1000000000), '1 GB');
  for (const invalid of [null, [], [{}], [{ used_bytes: -1, complete: true }], [{ used_bytes: '', complete: true }], [{ used_bytes: '9007199254740992', complete: true }]])
    assert.throws(() => model.parseStorageUsage(invalid));
});

test('storage is fetched on login, polls when visible and online, and cleans up on logout', async () => {
  const test = service();
  test.runEffect();
  await settle();
  assert.equal(test.api.usedLabel(), '100 MB');
  assert.equal(test.api.remainingLabel(), '900 MB');
  assert.equal(test.calls(), 1);
  test.document.visibilityState = 'hidden';
  test.timers.get(1)();
  assert.equal(test.calls(), 1);
  test.document.visibilityState = 'visible';
  test.navigator.onLine = false;
  test.timers.get(1)();
  assert.equal(test.calls(), 1);
  test.navigator.onLine = true;
  test.documentEvents.get('visibilitychange')();
  await settle();
  assert.equal(test.calls(), 2);
  test.auth.user.set(null);
  test.runEffect();
  assert.equal(test.api.usage(), null);
  assert.equal(test.timers.size + test.documentEvents.size + test.windowEvents.size, 0);
});

test('failed or incomplete usage never falls back to an invented free-space figure', async () => {
  const test = service();
  await test.api.refresh();
  test.respond(async () => ({ data: null, error: { code: 'PGRST202' } }));
  await test.api.refresh();
  assert.equal(test.api.usage(), null);
  assert.match(test.api.error(), /migración storage_usage/);
  test.respond(async () => ({ data: [{ used_bytes: '123', complete: false }], error: null }));
  await test.api.refresh();
  assert.equal(test.api.usage().complete, false);
  assert.equal(test.api.error(), '');
  test.respond(async () => ({ data: [{ used_bytes: '1100000000', complete: true }], error: null }));
  await test.api.refresh();
  assert.equal(test.api.remainingLabel(), '0 B');
  assert.equal(test.api.meterValue(), model.FILE_STORAGE_LIMIT);
});

test('late storage responses cannot replace newer values or leak across sessions', async () => {
  const test = service();
  let resolve;
  test.respond(() => new Promise(done => { resolve = done; }));
  const pending = test.api.refresh();
  test.respond(async () => ({ data: [{ used_bytes: '200', complete: true }], error: null }));
  await test.api.refresh();
  resolve({ data: [{ used_bytes: '100', complete: true }], error: null });
  await pending;
  assert.equal(test.api.usage().used, 200);
  test.respond(() => new Promise(done => { resolve = done; }));
  const oldSession = test.api.refresh();
  const resolveOld = resolve;
  test.respond(async () => ({ data: [{ used_bytes: '300', complete: true }], error: null }));
  test.auth.user.set({ id: 'user-b' });
  test.runEffect();
  resolveOld({ data: [{ used_bytes: '500', complete: true }], error: null });
  await oldSession;
  await settle();
  assert.equal(test.api.usage().used, 300);
});

test('demo never queries remote storage or starts polling', async () => {
  const test = service(true);
  test.runEffect();
  await test.api.refresh();
  assert.equal(test.calls(), 0);
  assert.equal(test.timers.size, 0);
});
