import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../src/app/' + path, import.meta.url), 'utf8');

function page() {
  class WorkspaceService {}
  class ActivatedRoute {}
  const ticket = { id: 'ticket-a', sprint_id: 'sprint-a', description: 'Contenido completo' };
  let workspace = 'space-a';
  let id = 'ticket-a';
  const store = {
    activeWorkspaceId: () => workspace,
    tickets: () => [ticket],
    sprints: () => [{ id: 'sprint-a', name: 'Sprint de prueba' }],
  };
  const params = { get: () => id };
  const query = { get: () => 'space-a' };
  const route = { paramMap: params, queryParamMap: query, snapshot: { paramMap: params, queryParamMap: query } };
  const dependencies = {
    '@angular/core': { Component: () => target => target, computed: fn => fn, inject: token => token === WorkspaceService ? store : route },
    '@angular/common': {},
    '@angular/router': { ActivatedRoute },
    '@angular/core/rxjs-interop': { toSignal: value => () => value },
    '../../core/services/workspace.service': { WorkspaceService },
    '../../shared/components/badge.component': {},
    '../../shared/components/assignee-avatar/assignee-avatar.component': {},
    '../../shared/components/ticket-screenshots.component': {},
  };
  const exports = {};
  const compiled = ts.transpileModule(read('features/tickets/ticket-page.component.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText;
  vm.runInNewContext(compiled, { exports, require: name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  } });
  return { component: new exports.TicketPageComponent(), changeWorkspace: value => workspace = value, changeId: value => id = value };
}

test('ticket page reads current ticket and sprint and reacts to route and workspace changes', () => {
  const { component, changeWorkspace, changeId } = page();
  assert.equal(component.ticket().description, 'Contenido completo');
  assert.equal(component.sprintName(), 'Sprint de prueba');
  changeWorkspace('space-b');
  assert.equal(component.wrongWorkspace(), true);
  assert.equal(component.ticket(), undefined);
  changeWorkspace('space-a');
  changeId('missing');
  assert.equal(component.ticket(), undefined);
  assert.equal(component.sprintName(), 'Sin sprint');
});

test('ticket detail has its own protected route and read-only full content with a return link', () => {
  const routes = read('app.routes.ts');
  const template = read('features/tickets/ticket-page.component.html');
  const service = read('core/services/editor.service.ts');
  const details = read('shared/components/ticket-details.component.ts');
  assert.match(routes, /path: 'tickets\/:id'/);
  assert.match(service, /dialog\.open\(TicketDetailsComponent/);
  assert.match(details, /router\.navigate\(\['\/tickets', this.ticket.id\]/);
  assert.match(details, /queryParams: \{ workspace: this.workspaceId \}/);
  assert.match(read('shared/components/ticket-details.component.html'), /\(click\)="openPage\(\)"/);
  for (const field of ['title', 'description', 'key', 'project_id', 'assignee', 'type', 'status', 'priority', 'due', 'id']) {
    assert.ok(template.includes('ticket.' + field), field);
  }
  assert.match(template, /sprintName\(\)/);
  assert.match(template, /\[readOnly\]="true"/);
  assert.match(template, /routerLink="\/kanban"/);
  assert.doesNotMatch(template, /ngModel|<input|<select|<textarea/);
});

test('ticket headings show the key and title separated by a hyphen without the read-only caption', () => {
  for (const path of ['features/tickets/ticket-page.component.html', 'shared/components/ticket-details.component.html']) {
    const template = read(path);
    assert.match(template, /{{ ticket.key }} - {{ ticket.title }}/);
    assert.doesNotMatch(template, /Solo lectura|·/);
  }
});
