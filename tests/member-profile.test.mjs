import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function signal(value) {
  const read = () => value;
  read.set = (next) => {
    value = next;
  };
  return read;
}

function setup() {
  const storeToken = Symbol('workspace'),
    profileToken = Symbol('profile'),
    destroyToken = Symbol('destroy');
  const members = [
    { id: 'own', account_id: 'owner', name: 'Yo', email: 'old@example.com' },
    { id: 'one', account_id: 'other', name: 'Otra persona', email: 'other@example.com' },
    { id: 'duplicate', account_id: 'other', name: 'Otra persona', email: 'other@example.com' },
    { id: 'preset', account_id: 'preset-account', name: 'Avatar', email: 'preset@example.com' },
  ];
  const records = [
    { member_id: 'one', account_id: 'other', avatar: 'custom', photo_path: 'other/current.webp' },
    {
      member_id: 'duplicate',
      account_id: 'other',
      avatar: 'custom',
      photo_path: 'other/current.webp',
    },
    { member_id: 'preset', account_id: 'preset-account', avatar: 'leaf', photo_path: '' },
  ];
  const revoked = [],
    downloads = [],
    calls = [];
  const client = {
    rpc: async (...args) => {
      calls.push(args);
      return { data: records };
    },
    storage: {
      from: (bucket) => ({
        download: async (path) => {
          downloads.push({ bucket, path });
          return { data: {} };
        },
      }),
    },
  };
  const store = {
    auth: { user: signal({ id: 'owner', email: 'new@example.com' }), client, isDemo: false },
    members: signal(members),
    activeWorkspaceId: signal('workspace'),
  };
  const profile = { image: signal('blob:own') };
  let destroy;
  const dependencies = {
    '@angular/core': {
      Injectable: () => (value) => value,
      effect: () => {},
      untracked: (fn) => fn(),
      signal,
      DestroyRef: destroyToken,
      inject: (token) =>
        token === storeToken
          ? store
          : token === profileToken
            ? profile
            : {
                onDestroy: (fn) => {
                  destroy = fn;
                },
              },
    },
    './workspace.service': { WorkspaceService: storeToken },
    './profile.service': { ProfileService: profileToken },
    './profile-model': { presetAvatar: (id) => (id === 'leaf' ? 'avatars/leaf.svg' : '') },
  };
  const exports = {};
  const source = readFileSync(
    new URL('../src/app/core/services/member-profile.service.ts', import.meta.url),
    'utf8',
  );
  let nextUrl = 0;
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
      URL: {
        createObjectURL: () => `blob:photo-${++nextUrl}`,
        revokeObjectURL: (url) => revoked.push(url),
      },
      require: (name) => {
        assert.ok(name in dependencies, name);
        return dependencies[name];
      },
    },
  );
  return {
    service: new exports.MemberProfileService(),
    store,
    members,
    records,
    client,
    downloads,
    revoked,
    calls,
    destroy: () => destroy(),
  };
}

test('member images download real linked account photos once per account and retain the live own photo', async () => {
  const { service, members, downloads, revoked, destroy, calls } = setup();
  await service.load('workspace', 'owner', members);
  assert.equal(calls[0][0], 'member_profile_images');
  assert.equal(calls[0][1].p_workspace_id, 'workspace');
  assert.deepEqual(downloads, [{ bucket: 'profile-avatars', path: 'other/current.webp' }]);
  assert.equal(service.image(members[0]), 'blob:own');
  assert.equal(service.image(members[1]), 'blob:photo-1');
  assert.equal(service.image(members[2]), 'blob:photo-1');
  assert.equal(service.image(members[3]), 'avatars/leaf.svg');
  destroy();
  assert.deepEqual(revoked, ['blob:photo-1']);
});

test('member photo lookup rejects unbound members and paths outside the linked account', async () => {
  const { service, members, records, downloads } = setup();
  records[0].photo_path = 'foreign/private.webp';
  records[1].account_id = 'unlinked';
  await service.load('workspace', 'owner', members);
  assert.equal(downloads.length, 0);
  assert.equal(service.image(members[1]), '');
});

test('workspace/account changes discard late downloaded photos and release blob URLs', async () => {
  const { service, members, client, revoked } = setup();
  let finish;
  client.storage.from = () => ({
    download: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const loading = service.load('workspace', 'owner', members);
  await new Promise((resolve) => setImmediate(resolve));
  await service.load(null, '', []);
  finish({ data: {} });
  await loading;
  assert.equal(service.image(members[1]), '');
  assert.deepEqual(revoked, ['blob:photo-1']);
});

test('failed profile RPC keeps initials available and exposes an actionable error', async () => {
  const { service, members, client } = setup();
  client.rpc = async () => ({ error: new Error('missing function') });
  await service.load('workspace', 'owner', members);
  assert.equal(service.image(members[1]), '');
  assert.match(service.error(), /migración/);
});
