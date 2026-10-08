import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
function compile(path, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    Error,
    Date,
    crypto: webcrypto,
    structuredClone,
    setTimeout: () => 0,
    clearTimeout: () => {},
    ...globals,
    require: (name) => {
      assert.ok(name in dependencies, 'Unexpected dependency: ' + name);
      return dependencies[name];
    },
  });
  return exports;
}
class MemoryStorage {
  values = new Map();
  failKey = '';
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    if (key === this.failKey) throw new Error('Storage quota exceeded');
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}
const record = compile('src/app/core/services/workspace-record.ts');
const models = compile('src/app/core/services/models.ts');
const seed = compile('src/app/core/services/seed.ts', { './models': models });
const local = compile('src/app/core/services/local-workspaces.ts', {
  './seed': seed,
  './workspace-record': record,
});
const empty = () => structuredClone(local.EMPTY_WORKSPACE);
function makeStore(storage, client = null) {
  const effects = [];
  class AuthService {}
  const user = { id: 'account-a' };
  const auth = {
    isDemo: !client,
    client,
    ready: Promise.resolve(),
    user: () => (client ? user : null),
  };
  const angular = {
    Injectable: () => (target) => target,
    computed: (expression) => expression,
    effect: (callback) => effects.push(callback),
    signal: (value) => {
      const get = () => value;
      get.set = (next) => {
        value = next;
      };
      get.update = (fn) => {
        value = fn(value);
      };
      return get;
    },
    inject: (token) => {
      assert.equal(token, AuthService);
      return auth;
    },
  };
  const { WorkspaceService } = compile(
    'src/app/core/services/workspace.service.ts',
    {
      '@angular/core': angular,
      '../auth/auth.service': { AuthService },
      './models': models,
      './seed': seed,
      './workspace-record': record,
      './local-workspaces': local,
    },
    { localStorage: storage },
  );
  const store = new WorkspaceService();
  store.flushAuthEffect = () => effects[0]();
  return store;
}
test('identifiers normalize accents and reject invalid or duplicate values', () => {
  assert.equal(record.workspaceSlug('  Área de Diseño y QA  '), 'area-de-diseno-y-qa');
  assert.ok(record.workspaceSlug('a'.repeat(100)).length <= 32);
  for (const slug of ['ab', 'Invalid', 'bad--id', '-bad', 'bad-', 'demo'])
    assert.ok(record.workspaceErrors('Producto', slug, '', []).slug);
  assert.ok(record.workspaceErrors('Producto', 'producto', '', [{ slug: 'producto' }]).slug);
  assert.equal(record.workspaceErrors('Producto', 'producto', '', []).slug, '');
});
test('local creation preserves legacy demo and isolates workspace data across reloads', () => {
  const storage = new MemoryStorage(),
    repo = new local.LocalWorkspaces(storage);
  const demo = empty();
  demo.projects.push({ id: 'legacy', name: 'Proyecto anterior' });
  storage.setItem('project-os-angular-demo-v1', JSON.stringify(demo));
  const first = repo.create('Producto', 'producto', 'Primero');
  const second = repo.create('Operaciones', 'operaciones', '');
  assert.equal(repo.selected(), second.id);
  assert.equal(repo.read(first.id).projects.length, 0);
  const data = empty();
  data.projects.push({ id: 'new', name: 'Proyecto privado' });
  repo.write(first.id, data);
  const reloaded = new local.LocalWorkspaces(storage);
  assert.equal(reloaded.read(first.id).projects[0].name, 'Proyecto privado');
  assert.equal(reloaded.read(second.id).projects.length, 0);
  assert.equal(reloaded.select('demo').projects[0].name, 'Proyecto anterior');
  assert.equal(reloaded.list().find((space) => space.id === first.id).projectCount, 1);
  assert.throws(() => repo.create('Duplicado', 'producto', ''), /ya está en uso/);
});
test('failed storage creation rolls back registry, active selection and new data', () => {
  const storage = new MemoryStorage(),
    repo = new local.LocalWorkspaces(storage);
  repo.select('demo');
  const before = JSON.stringify([...storage.values]);
  storage.failKey = 'projectly-workspaces-v1';
  assert.throws(() => repo.create('Producto', 'producto', ''), /quota/);
  assert.equal(JSON.stringify([...storage.values]), before);
});
test('corrupt registry is reported and never overwritten by creation', () => {
  const storage = new MemoryStorage(),
    repo = new local.LocalWorkspaces(storage);
  storage.setItem('projectly-workspaces-v1', 'broken-json');
  assert.throws(() => repo.create('Producto', 'producto', ''), /lista de espacios/);
  assert.equal(storage.getItem('projectly-workspaces-v1'), 'broken-json');
});
test('store saves only in selected space, restores data and resets only the demo', async () => {
  const storage = new MemoryStorage(),
    store = makeStore(storage);
  const originalIds = store.projects().map((project) => project.id);
  const one = await store.createWorkspace('Producto', 'producto', '');
  const two = await store.createWorkspace('Operaciones', 'operaciones', '');
  assert.equal(store.projects().length, 0);
  await store.selectWorkspace(one.id);
  const project = {
    id: 'new',
    key: 'NEW',
    name: 'Proyecto nuevo',
    description: '',
    owner: null,
    status: 'Activo',
  };
  assert.equal(await store.save('projects', project), true);
  await store.selectWorkspace(two.id);
  assert.equal(store.projects().length, 0);
  await store.selectWorkspace(one.id);
  assert.equal(store.projects()[0].name, 'Proyecto nuevo');
  store.resetDemo();
  assert.equal(store.projects()[0].name, 'Proyecto nuevo');
  assert.equal(store.workspaceSummaries().find((space) => space.id === one.id).projectCount, 1);
  await store.selectWorkspace('demo');
  // The preexisting demonstration remains independent from the new spaces.
  assert.deepEqual(
    store.projects().map((project) => project.id),
    originalIds,
  );
  const reloaded = makeStore(storage);
  await reloaded.selectWorkspace(one.id);
  assert.equal(reloaded.projects()[0].name, 'Proyecto nuevo');
  store.busy.set(true);
  assert.equal(await store.selectWorkspace(two.id), false);
  assert.equal(store.activeWorkspaceId(), 'demo');
});
function fakeClient(run) {
  return {
    channel() {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: async () => {},
    from(table) {
      const query = { table, filters: {}, operation: 'select', payload: null };
      const builder = {
        select() {
          return builder;
        },
        order() {
          return builder;
        },
        eq(key, value) {
          query.filters[key] = value;
          return builder;
        },
        upsert(payload) {
          query.operation = 'upsert';
          query.payload = payload;
          return builder;
        },
        insert(payload) {
          query.operation = 'insert';
          query.payload = payload;
          return builder;
        },
        delete() {
          query.operation = 'delete';
          return builder;
        },
        single() {
          return run(query);
        },
        then(resolve, reject) {
          return run(query).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}
test('initial auth effect reuses the directory request already started by navigation', async () => {
  let directoryRequests = 0;
  const client = fakeClient(async (query) => {
    if (query.table === 'workspaces') {
      directoryRequests++;
      return {
        data: [
          {
            id: 'workspace-a',
            name: 'Producto',
            slug: 'producto',
            description: '',
            created_at: '',
          },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  });
  const store = makeStore(new MemoryStorage(), client);
  const navigationRequest = store.loadWorkspaces();
  await Promise.resolve();
  store.flushAuthEffect();
  assert.equal(await navigationRequest, true);
  store.flushAuthEffect();
  assert.equal(directoryRequests, 1);
  assert.equal(store.hasWorkspace(), true);
});
test('cloud queries and writes always include the selected workspace', async () => {
  const requests = [],
    storage = new MemoryStorage();
  const space = {
    id: 'workspace-a',
    name: 'Producto',
    slug: 'producto',
    description: '',
    created_at: '',
  };
  const client = fakeClient(async (query) => {
    requests.push(query);
    if (query.table === 'workspaces') return { data: [space], error: null };
    return { data: query.operation === 'upsert' ? query.payload : [], error: null };
  });
  const store = makeStore(storage, client);
  assert.equal(await store.loadWorkspaces(), true);
  await store.refresh();
  const project = {
    id: 'p1',
    key: 'NEW',
    name: 'Proyecto',
    description: '',
    owner: null,
    status: 'Activo',
  };
  assert.equal(await store.save('projects', project), true);
  const saved = requests.find((query) => query.operation === 'upsert');
  assert.equal(saved.payload.workspace_id, space.id);
  assert.equal(saved.payload.user_id, 'account-a');
  for (const query of requests.filter(
    (query) => query.operation === 'select' && query.table !== 'workspaces',
  )) {
    assert.equal(query.filters.workspace_id, space.id);
    assert.equal(query.filters.user_id, 'account-a');
  }
});
test('late responses from the previous space never replace current data', async () => {
  const releases = [],
    storage = new MemoryStorage();
  const spaces = ['a', 'b'].map((id) => ({
    id,
    name: id,
    slug: id,
    description: '',
    created_at: '',
  }));
  const client = fakeClient((query) => {
    if (query.table === 'workspaces') return Promise.resolve({ data: spaces, error: null });
    if (query.filters.workspace_id === 'a')
      return new Promise((resolve) =>
        releases.push(() =>
          resolve({
            data: query.table === 'projects' ? [{ id: 'old-space-project' }] : [],
            error: null,
          }),
        ),
      );
    return Promise.resolve({
      data: query.table === 'projects' ? [{ id: 'current-space-project' }] : [],
      error: null,
    });
  });
  const store = makeStore(storage, client);
  await store.loadWorkspaces();
  await store.selectWorkspace('b');
  await store.refresh();
  for (const release of releases) release();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(store.activeWorkspaceId(), 'b');
  assert.equal(store.projects()[0].id, 'current-space-project');
});
