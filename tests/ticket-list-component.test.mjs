import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { signal, computed, linkedSignal } from '@angular/core';

function load(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../src/app/${path}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected import: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

test('ticket list resets its page for filters, page size and workspace and opens catalog links', () => {
  const topicHelpers = load('core/services/ticket-topics');
  const helpers = load('core/services/ticket-list', { './ticket-topics': topicHelpers });
  const store = {
    tickets: signal(Array.from({ length: 61 }, (_, i) => ({ id: `${i}`, key: `A-${i}`, title: 'Ticket', project_id: 'p', topics: ['Hoteles'] }))),
    activeWorkspaceId: signal('a'),
    versions: signal(['1.0']),
  };
  const routeQuery = signal(new Map());
  const route = { queryParamMap: routeQuery, snapshot: { queryParamMap: routeQuery() } };
  const { TicketsComponent } = load('features/tickets/tickets.component', {
    '@angular/core': { Component: () => target => target, signal, computed, linkedSignal, inject: token => token === 'store' ? store : token === 'route' ? route : {} },
    '@angular/forms': {},
    '@angular/router': { ActivatedRoute: 'route' },
    '@angular/core/rxjs-interop': { toSignal: source => source },
    '../../core/services/workspace.service': { WorkspaceService: 'store' },
    '../../core/services/editor.service': {},
    '../../core/services/models': { STATUSES: [], PRIORITIES: [] },
    '../../core/services/ticket-list': helpers,
    '../../shared/components/form-controls.module': {},
    '../../shared/components/page-header.component': {},
    '../../shared/components/icon.component': {},
    '../../shared/components/ticket-table.component': {},
  });
  const page = new TicketsComponent();
  assert.equal(page.pagination().tickets.length, 25);
  page.page.set(3);
  assert.equal(page.pagination().start, 51);
  page.setFilter('query', 'Ticket');
  assert.equal(page.pagination().page, 1);
  page.page.set(2);
  page.pageSize.set(10);
  assert.equal(page.pagination().page, 1);
  page.setFilter('topic', 'Nada');
  assert.equal(page.pagination().end, 0);
  page.resetFilters();
  assert.equal(page.pagination().end, 10);
  routeQuery.set(new Map([['workspace', 'a'], ['topic', 'Hoteles']]));
  assert.equal(page.filters().topic, 'Hoteles');
  store.activeWorkspaceId.set('b');
  assert.equal(page.filters().topic, '');
  assert.equal(page.pagination().page, 1);
});
