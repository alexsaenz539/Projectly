import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const template = readFileSync(new URL('../src/app/core/layouts/workspace-layout.component.html', import.meta.url), 'utf8');

test('live file storage appears in the sidebar footer before sign out', () => {
  const footer = template.slice(template.indexOf('<div class="sidebar-footer">'));
  assert.ok(footer.indexOf('storage-summary') < footer.indexOf('Cerrar sesión'));
  assert.match(footer, /@if \(!store\.auth\.isDemo\)/);
  assert.match(footer, /storageUsage\.remainingLabel\(\)/);
  assert.match(footer, /storageUsage\.usedLabel\(\)/);
  assert.match(footer, /otros proyectos no incluidos/);
  assert.doesNotMatch(footer, /Según captura|No se actualiza automáticamente|≈ 1 GB disponible/);
});

test('storage reference uses an accessible meter and theme-aware styling', () => {
  assert.match(template, /aria-labelledby="storage-summary-title"/);
  assert.match(template, /<meter[^>]+\[max\]="storageUsage.limit"[^>]+\[value\]="storageUsage.meterValue\(\)"[^>]+\[attr.aria-label\]=/);
  const css = readFileSync(new URL('../src/app/core/layouts/workspace-layout.component.css', import.meta.url), 'utf8');
  assert.match(css, /var\(--surface-muted\)/);
  assert.match(css, /var\(--text-primary\)/);
});
