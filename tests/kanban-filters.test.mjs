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

function board() {
  const tickets = [
    {
      id: '1',
      key: 'APP-1',
      title: 'Crear filtros',
      project_id: 'a',
      assignee: 'ana',
      priority: 'Alta',
      target_version: '1.2.0',
      status: 'Pendiente',
    },
    {
      id: '2',
      key: 'APP-2',
      title: 'Corregir error',
      project_id: 'a',
      assignee: null,
      priority: 'Urgente',
      target_version: null,
      status: 'En progreso',
    },
    {
      id: '3',
      key: 'WEB-3',
      title: 'Crear perfil',
      project_id: 'b',
      assignee: 'ana',
      priority: 'Media',
      target_version: '1.10.0',
      status: 'Completado',
    },
    {
      id: '4',
      key: 'APP-4',
      title: 'Revisar filtros',
      project_id: 'a',
      assignee: 'ana',
      priority: 'Alta',
      target_version: '1.2.0',
      status: 'En revisión',
    },
    {
      id: '5',
      key: 'WEB-5',
      title: 'Ticket anterior',
      project_id: 'b',
      assignee: null,
      priority: 'Baja',
      status: 'Pendiente',
    },
  ];
  const moves = [];
  let pauseRefresh, destroy;
  const store = {
    tickets: signal(tickets),
    activeWorkspaceId: signal('workspace-1'),
    moveTicket: (...args) => moves.push(args),
    startTicketAutoRefresh: (paused) => { pauseRefresh = paused; return () => {}; },
  };
  const effects = [];
  const dependencies = {
    '@angular/core': {
      Component: () => (target) => target,
      DestroyRef: 'destroy',
      computed: (fn) => fn,
      signal,
      effect: (fn) => effects.push(fn),
      untracked: (fn) => fn(),
      inject: (token) => token === 'workspace' ? store : token === 'destroy' ? { onDestroy: fn => { destroy = fn; } } : token === 'dialog' ? { openDialogs: [] } : {},
    },
    '@angular/forms': {},
    '@angular/cdk/drag-drop': {},
    '@angular/cdk/dialog': { Dialog: 'dialog' },
    '../../core/services/workspace.service': { WorkspaceService: 'workspace' },
    '../../core/services/editor.service': {},
    '../../core/services/models': {
      STATUSES: ['Pendiente', 'En progreso', 'En revisión', 'Bloqueado', 'Completado'],
      PRIORITIES: ['Urgente', 'Alta', 'Media', 'Baja'],
    },
    '../../shared/components/form-controls.module': {},
    '../../shared/components/page-header.component': {},
    '../../shared/components/icon.component': {},
    '../../shared/components/badge.component': {},
    '../../shared/components/assignee-avatar/assignee-avatar.component': {},
  };
  const exports = {};
  const source = readFileSync(
    new URL('../src/app/features/kanban/kanban.component.ts', import.meta.url),
    'utf8',
  );
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
        assert.ok(name in dependencies, name);
        return dependencies[name];
      },
    },
  );
  return { component: new exports.KanbanComponent(), store, moves, effects, paused: () => pauseRefresh(), destroy: () => destroy() };
}

test('kanban pauses automatic updates during dragging and dialogs', () => {
  const { component, paused, destroy } = board();
  assert.equal(paused(), false);
  component.dragging.set(true);
  assert.equal(paused(), true);
  component.dragging.set(false);
  component.dialog.openDialogs.push({});
  assert.equal(paused(), true);
  component.dialog.openDialogs.length = 0;
  assert.equal(paused(), false);
  destroy();
});

const ids = (component) => Array.from(component.visible(), (ticket) => ticket.id);

test('kanban combines search, project, responsible, priority and delivery version filters', () => {
  const { component: c } = board();
  assert.equal(c.visible().length, 5);
  c.query.set('  APP-1  ');
  assert.deepEqual(ids(c), ['1']);
  c.query.set('FILTROS');
  c.project.set('a');
  c.assignee.set('ana');
  c.priority.set('Alta');
  c.version.set('1.2.0');
  assert.deepEqual(ids(c), ['1', '4']);
  assert.equal(c.tickets('Pendiente').length, 1);
  assert.equal(c.tickets('En revisión').length, 1);
  assert.equal(c.tickets('Completado').length, 0);
  c.priority.set('Baja');
  assert.equal(c.visible().length, 0);
  c.clearFilters();
  assert.equal(c.visible().length, 5);
  assert.equal(c.hasFilters(), false);
});

test('kanban supports unassigned and legacy tickets without a delivery version', () => {
  const { component: c } = board();
  c.assignee.set('__none__');
  c.version.set('__none__');
  assert.deepEqual(ids(c), ['2', '5']);
  assert.deepEqual(Array.from(c.versions()), ['1.2.0', '1.10.0']);
  c.store.tickets.set([]);
  assert.deepEqual(ids(c), []);
  assert.equal(c.versions().length, 0);
});

test('kanban resets filters on workspace change and leaves ticket movement intact', () => {
  const { component: c, store, effects, moves } = board();
  c.project.set('a');
  c.query.set('filtros');
  store.activeWorkspaceId.set('workspace-2');
  effects[0]();
  assert.equal(c.hasFilters(), false);
  c.project.set('a');
  const ticket = store.tickets()[0];
  c.drop({ item: { data: ticket }, container: { data: 'Completado' } });
  assert.deepEqual(moves, [[ticket, 'Completado']]);
  store.tickets.set(
    store.tickets().map((t) => (t.id === ticket.id ? { ...t, status: 'Completado' } : t)),
  );
  assert.equal(c.tickets('Completado').length, 1);
  assert.equal(c.tickets('Pendiente').length, 0);
  c.drop({ item: { data: ticket }, container: { data: 'Pendiente' } });
  assert.equal(moves.length, 1);
});
