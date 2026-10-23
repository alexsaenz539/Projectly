import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const source = readFileSync(new URL('../src/app/core/services/' + file, import.meta.url), 'utf8');
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
      File,
      Blob,
      URL,
      crypto: globalThis.crypto,
      require(name) {
        assert.ok(name in dependencies, 'Unexpected dependency: ' + name);
        return dependencies[name];
      },
    },
  );
  return exports;
}
const validation = load('screenshot-validation.ts');
const png = () =>
  new File(
    [
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ZkAAAAASUVORK5CYII=',
        'base64',
      ),
    ],
    'Captura de diseño.png',
    { type: 'image/png' },
  );
function service(bucket, user = { id: 'account-a' }) {
  class AuthService {}
  class SupabaseService {}
  class StorageUsageService {}
  let usageRefreshes = 0;
  const auth = { isDemo: false, user: () => user };
  const { TicketScreenshotsService } = load('ticket-screenshots.service.ts', {
    '@angular/core': {
      Injectable: () => (target) => target,
      inject: (token) =>
        token === AuthService
          ? auth
          : token === StorageUsageService ? { refresh: async () => { usageRefreshes++; } }
          : {
              client: {
                storage: {
                  from: (name) => {
                    assert.equal(name, 'ticket-screenshots');
                    return bucket;
                  },
                },
              },
            },
    },
    '../auth/auth.service': { AuthService },
    './supabase.service': { SupabaseService },
    './screenshot-validation': validation,
    './storage-usage.service': { StorageUsageService },
  });
  return { service: new TicketScreenshotsService(), auth, usageRefreshes: () => usageRefreshes };
}

test('successful screenshot uploads and deletions refresh storage without estimating bytes locally', async () => {
  const test = service({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) });
  const uploaded = await test.service.upload('workspace', 'ticket', png());
  assert.equal(test.usageRefreshes(), 1);
  await test.service.remove('workspace', 'ticket', uploaded.path);
  assert.equal(test.usageRefreshes(), 2);
  URL.revokeObjectURL(uploaded.url);
});

test('screenshots reject unsupported, empty, oversize and disguised files', async () => {
  await validation.validateScreenshot(png());
  await assert.rejects(
    validation.validateScreenshot(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })),
    /PNG/,
  );
  await assert.rejects(
    validation.validateScreenshot(new File([], 'x.png', { type: 'image/png' })),
    /5 MB/,
  );
  await assert.rejects(
    validation.validateScreenshot({ type: 'image/png', size: validation.SCREENSHOT_MAX_BYTES + 1 }),
    /5 MB/,
  );
  await assert.rejects(
    validation.validateScreenshot(
      new File(['<script>bad</script>'], 'x.png', { type: 'image/png' }),
    ),
    /formato/,
  );
  assert.equal(
    validation.screenshotFilename({ name: '../../Captura de diseño.exe', type: 'image/png' }),
    'Captura-de-diseno.png',
  );
});
test('uploads use account/workspace/ticket paths, detected MIME and never overwrite files', async () => {
  const uploads = [];
  const { service: api } = service({
    upload: async (...args) => {
      uploads.push(args);
      return { error: null };
    },
  });
  const image = await api.upload('space-a', 'ticket-a', png());
  assert.match(image.path, /^account-a\/space-a\/ticket-a\/[a-f0-9-]{36}_Captura-de-diseno.png$/);
  assert.equal(uploads[0][2].upsert, false);
  assert.equal(uploads[0][2].contentType, 'image/png');
  assert.ok(image.url.startsWith('blob:'));
  URL.revokeObjectURL(image.url);
  await assert.rejects(api.upload('../other', 'ticket-a', png()), /no es válido/);
});
test('listing signs private files and rejects stale session responses', async () => {
  const { service: api, auth } = service({
    list: async () => ({ data: [{ id: 'file', name: 'image.png' }], error: null }),
    createSignedUrls: async (paths, seconds) => {
      assert.equal(seconds, 3600);
      assert.equal(paths[0], 'account-a/space-a/ticket-a/image.png');
      return { data: [{ signedUrl: 'https://example.test/private-signed-image' }], error: null };
    },
  });
  assert.equal(
    (await api.list('space-a', 'ticket-a'))[0].url,
    'https://example.test/private-signed-image',
  );
  auth.user = () => ({ id: 'account-b' });
  await assert.rejects(
    api.remove('space-a', 'ticket-a', 'account-a/space-a/ticket-a/image.png'),
    /no pertenece/,
  );
  const late = service({
    list: async () => {
      late.auth.user = () => ({ id: 'another-account' });
      return { data: [], error: null };
    },
  });
  await assert.rejects(late.service.list('space-a', 'ticket-a'), /sesión ha cambiado/);
});
test('deletion cannot target another ticket and upload failures remain explicit', async () => {
  const removed = [];
  const { service: api } = service({
    remove: async (paths) => {
      removed.push(...paths);
      return { error: null };
    },
    upload: async () => ({ error: { message: 'offline' } }),
  });
  await assert.rejects(
    api.remove('space-a', 'ticket-a', 'account-a/space-a/ticket-b/image.png'),
    /no pertenece/,
  );
  assert.equal(removed.length, 0);
  await api.remove('space-a', 'ticket-a', 'account-a/space-a/ticket-a/image.png');
  assert.equal(removed.length, 1);
  await assert.rejects(api.upload('space-a', 'ticket-a', png()), /No se pudo subir/);
});
test('workspace cleanup lists its own subtree and removes only files within it', async () => {
  const removed = [];
  const { service: api } = service({
    list: async (prefix) => ({
      data:
        prefix === 'account-a/space-a'
          ? [{ id: null, name: 'ticket-a' }]
          : [{ id: 'file', name: 'image.png' }],
      error: null,
    }),
    remove: async (paths) => {
      removed.push(...paths);
      return { error: null };
    },
  });
  await api.cleanup('space-a');
  assert.deepEqual(removed, ['account-a/space-a/ticket-a/image.png']);
});
