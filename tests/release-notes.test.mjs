import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createReleaseNotes } = require('../electron/release-notes.cjs');

test('installed releases are shown until acknowledged, once per version across restarts', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'projectly-notes-'));
  const file = path.join(directory, 'seen.json');
  const options = {
    version: '1.0.0',
    enabled: true,
    file,
    notes: { '1.0.0': ['Perfil nuevo'], '1.1.0': ['Otra mejora'] },
  };
  try {
    const notes = createReleaseNotes(options);
    assert.deepEqual(await notes.pending(), { version: '1.0.0', changes: ['Perfil nuevo'] });
    assert.ok(await notes.pending(), 'reading must not acknowledge');
    await notes.acknowledge();
    assert.equal(JSON.parse(await readFile(file, 'utf8')).version, '1.0.0');
    assert.equal(await createReleaseNotes(options).pending(), null);
    const next = createReleaseNotes({ ...options, version: '1.1.0' });
    assert.deepEqual((await next.pending()).changes, ['Otra mejora']);
    await next.acknowledge();
    assert.equal(await next.pending(), null);
    await writeFile(file, 'invalid JSON');
    assert.ok(await next.pending(), 'corrupt marker must not hide the release');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('development does not show notes or write a marker', async () => {
  const notes = createReleaseNotes({
    enabled: false,
    storage: {
      readFile() {
        throw new Error('unexpected read');
      },
      writeFile() {
        throw new Error('unexpected write');
      },
    },
  });
  assert.equal(await notes.pending(), null);
  await notes.acknowledge();
});

test('missing release notes have a fallback and write failures remain retryable', async () => {
  const notes = createReleaseNotes({
    version: '9.0.0',
    enabled: true,
    file: 'seen.json',
    notes: {},
    storage: {
      async readFile() {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      },
      async writeFile() {
        throw new Error('disk full');
      },
    },
  });
  assert.match((await notes.pending()).changes[0], /No se han incluido notas/);
  await assert.rejects(notes.acknowledge(), /disk full/);
  assert.ok(await notes.pending());
});

test('current release includes nonempty plain-text notes in the installer', () => {
  const { version } = require('../package.json');
  const notes = require('../electron/release-notes.json');
  assert.ok(notes[version]?.length, 'Add release notes for the package version before shipping');
  for (const change of notes[version]) assert.ok(typeof change === 'string' && change.trim());
  const config = require('../electron-builder.config.cjs');
  assert.ok(config.files.includes('electron/**/*'));
});
