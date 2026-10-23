import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

function load(path, dependencies = {}, globals = {}) {
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
    URL,
    File,
    Blob,
    Uint8Array,
    crypto: webcrypto,
    require: (name) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
    ...globals,
  });
  return exports;
}
const model = load('src/app/core/services/profile-model.ts');
const validation = load('src/app/core/services/screenshot-validation.ts');
const draft = (avatar = 'orbit') => ({ name: ' Ana Morales ', bio: ' Desarrollo ', avatar });
function signal(value) {
  const read = () => value;
  read.set = (next) => {
    value = next;
  };
  return read;
}
function makeProfile({
  demo = false,
  metadata = {},
  updateError = null,
  uploadError = null,
  storageError = false,
} = {}) {
  const entries = new Map(),
    operations = [],
    effects = [];
  const user = { id: 'user-a', email: 'ana@example.com', user_metadata: metadata };
  const bucket = {
    upload: async (path, photo) => {
      operations.push(['upload', path, photo]);
      return { error: uploadError };
    },
    remove: async (paths) => {
      operations.push(['remove', ...paths]);
      return { error: null };
    },
    download: async (path) => {
      operations.push(['download', path]);
      return { data: new Blob(['photo']), error: null };
    },
  };
  const auth = {
    isDemo: demo,
    user: signal(demo ? null : user),
    hasAccess: () => true,
    client: {
      storage: {
        from: (name) => {
          assert.equal(name, 'profile-avatars');
          return bucket;
        },
      },
      auth: {
        updateUser: async ({ data }) => {
          operations.push(['update', data]);
          return {
            data: { user: { ...user, user_metadata: { ...metadata, ...data } } },
            error: updateError,
          };
        },
      },
    },
  };
  class AuthService {}
  class StorageUsageService {}
  let usageRefreshes = 0;
  const { ProfileService } = load(
    'src/app/core/services/profile.service.ts',
    {
      '@angular/core': {
        Injectable: () => (target) => target,
        computed: (fn) => fn,
        signal,
        effect: (fn) => effects.push(fn),
        untracked: (fn) => fn(),
        inject: token => token === StorageUsageService ? { refresh: async () => { usageRefreshes++; } } : auth,
      },
      '../auth/auth.service': { AuthService },
      './profile-model': model,
      './profile-photo': { photoDataUrl: async () => 'data:image/webp;base64,dGVzdA==' },
      './screenshot-validation': validation,
      './storage-usage.service': { StorageUsageService },
    },
    {
      localStorage: {
        getItem: (key) => entries.get(key) ?? null,
        setItem: (key, value) => {
          if (storageError) throw new Error('Quota exceeded');
          entries.set(key, value);
        },
      },
    },
  );
  return { service: new ProfileService(), auth, operations, entries, bucket, effects, usageRefreshes: () => usageRefreshes };
}
const photo = () =>
  new File([new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])], 'photo.webp', {
    type: 'image/webp',
  });

test('profile upload, replacement and removal refresh storage after completing the operation', async () => {
  const test = makeProfile({ metadata: { profile_avatar: 'custom', profile_photo_path: 'user-a/old.webp' } });
  await test.service.save(draft('custom'), photo());
  assert.equal(test.usageRefreshes(), 1);
  await test.service.save(draft(''), null);
  assert.equal(test.usageRefreshes(), 2);
  const demo = makeProfile({ demo: true });
  await demo.service.save(draft('custom'), photo());
  assert.equal(demo.usageRefreshes(), 0);
});

test('profile validates names, biography and trusted preset identifiers', () => {
  assert.equal(model.profileErrors(draft()), '');
  for (const invalid of [
    { ...draft(), name: ' ' },
    { ...draft(), name: 'a'.repeat(81) },
    { ...draft(), bio: 'a'.repeat(281) },
    draft('https://external.example/avatar.svg'),
  ])
    assert.ok(model.profileErrors(invalid));
  assert.equal(model.presetAvatar('https://external.example/a'), '');
  for (const preset of model.PROFILE_AVATARS)
    assert.ok(existsSync(new URL('../public/' + preset.url, import.meta.url)));
});

test('demo saves the profile only in local storage', async () => {
  const { service, operations, entries } = makeProfile({ demo: true });
  await service.save(draft('leaf'), null);
  assert.equal(service.name(), 'Ana Morales');
  assert.equal(service.bio(), 'Desarrollo');
  assert.equal(service.image(), 'avatars/leaf.svg');
  assert.equal(JSON.parse(entries.get('projectly-demo-profile-v1')).name, 'Ana Morales');
  assert.equal(operations.length, 0);
});

test('demo photo persists locally and switching to initials clears it', async () => {
  const { service, operations } = makeProfile({ demo: true });
  await service.save(draft('custom'), photo());
  assert.match(service.image(), /^data:image\/webp/);
  await service.save(draft(''), null);
  assert.equal(service.image(), '');
  assert.equal(operations.length, 0);
});

test('local storage failure does not claim to have saved changes', async () => {
  const { service } = makeProfile({ demo: true, storageError: true });
  await assert.rejects(service.save(draft(), null), /Quota/);
  assert.equal(service.name(), 'Usuario demo');
  assert.equal(service.busy(), false);
});

test('connected profile updates account metadata without replacing unrelated metadata', async () => {
  const { service, auth, operations } = makeProfile({ metadata: { unrelated: 'keep' } });
  await service.save(draft(), null);
  assert.equal(auth.user().user_metadata.full_name, 'Ana Morales');
  assert.equal(auth.user().user_metadata.unrelated, 'keep');
  assert.equal(service.image(), 'avatars/orbit.svg');
  assert.equal(operations[0][0], 'update');
});

test('custom photo upload is owned and old photo is removed only after metadata save', async () => {
  const previous = 'user-a/old.webp';
  const { service, operations, auth } = makeProfile({
    metadata: { profile_avatar: 'custom', profile_photo_path: previous },
  });
  await service.save(draft('custom'), photo());
  assert.deepEqual(
    operations.map((op) => op[0]),
    ['upload', 'update', 'remove'],
  );
  assert.match(auth.user().user_metadata.profile_photo_path, /^user-a\/[a-f0-9-]+\.webp$/);
  assert.equal(operations[2][1], previous);
});

test('failed metadata save rolls back new upload and retains previous photo', async () => {
  const { service, operations, auth } = makeProfile({
    metadata: { profile_photo_path: 'user-a/old.webp' },
    updateError: new Error('offline'),
  });
  await assert.rejects(service.save(draft('custom'), photo()), /offline/);
  assert.deepEqual(
    operations.map((op) => op[0]),
    ['upload', 'update', 'remove'],
  );
  assert.equal(operations[2][1], operations[0][1]);
  assert.equal(auth.user().user_metadata.profile_photo_path, 'user-a/old.webp');
  assert.equal(service.busy(), false);
});

test('missing photo and invalid files cannot modify the profile', async () => {
  const { service, operations } = makeProfile();
  await assert.rejects(service.save(draft('custom'), null), /Selecciona una foto/);
  await assert.rejects(
    service.save(draft('custom'), new File(['not an image'], 'x.svg', { type: 'image/svg+xml' })),
    /PNG/,
  );
  await assert.rejects(
    service.save(draft('custom'), new File(['fake'], 'x.png', { type: 'image/png' })),
    /formato/,
  );
  assert.equal(operations.length, 0);
});

test('foreign photo paths are never downloaded or deleted', async () => {
  const { service, effects, operations } = makeProfile({
    metadata: { profile_avatar: 'custom', profile_photo_path: 'user-b/private.webp' },
  });
  effects[0]();
  await service.save(draft(), null);
  assert.deepEqual(
    operations.map((op) => op[0]),
    ['update'],
  );
});

test('account change during upload prevents metadata write into another account', async () => {
  const { service, auth, bucket, operations } = makeProfile();
  bucket.upload = async (path) => {
    operations.push(['upload', path]);
    auth.user.set({ id: 'user-b', user_metadata: {} });
    return { error: null };
  };
  await assert.rejects(service.save(draft('custom'), photo()), /sesión ha cambiado/);
  assert.deepEqual(
    operations.map((op) => op[0]),
    ['upload', 'remove'],
  );
  assert.equal(auth.user().id, 'user-b');
});

test('photo preparation validates input, square-crops, resizes and closes bitmap', async () => {
  let closed = false,
    drawArgs;
  const canvas = {
    getContext: () => ({
      drawImage: (...args) => {
        drawArgs = args;
      },
    }),
    toBlob: (callback) => callback(new Blob(['compressed'], { type: 'image/webp' })),
  };
  const { prepareProfilePhoto } = load(
    'src/app/core/services/profile-photo.ts',
    { './screenshot-validation': validation },
    {
      createImageBitmap: async () => ({
        width: 1200,
        height: 800,
        close: () => {
          closed = true;
        },
      }),
      document: { createElement: () => canvas },
    },
  );
  const result = await prepareProfilePhoto(photo());
  assert.equal(canvas.width, 512);
  assert.equal(canvas.height, 512);
  assert.deepEqual(drawArgs.slice(1), [200, 0, 800, 800, 0, 0, 512, 512]);
  assert.equal(result.type, 'image/webp');
  assert.equal(closed, true);
  await assert.rejects(
    prepareProfilePhoto(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
    ),
    /5 MB/,
  );
});

test('profile route is account-protected but does not require a workspace', () => {
  const routes = readFileSync(new URL('../src/app/app.routes.ts', import.meta.url), 'utf8');
  const guard = readFileSync(
    new URL('../src/app/core/guards/workspace.guard.ts', import.meta.url),
    'utf8',
  );
  assert.match(routes, /canActivate: \[authGuard\]/);
  assert.match(routes, /path: 'profile'/);
  assert.match(guard, /\['workspaces', 'settings', 'profile'\]/);
  const migration = readFileSync(
    new URL('../supabase/migrations/20261017000000_profile_avatars.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /'profile-avatars', 'profile-avatars', false/);
  assert.equal((migration.match(/auth\.uid\(\)/g) ?? []).length, 3);
});
