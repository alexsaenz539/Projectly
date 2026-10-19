import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const source = readFileSync(
    new URL('../src/app/shared/components/' + file, import.meta.url),
    'utf8',
  );
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
    Date,
    crypto: globalThis.crypto,
    require(name) {
      assert.ok(name in dependencies, 'Unexpected dependency: ' + name);
      return dependencies[name];
    },
  });
  return exports;
}
function signal(initial) {
  let value = initial;
  const getter = () => value;
  getter.set = (next) => {
    value = next;
  };
  return getter;
}
const input = Object.assign(signal, { required: () => signal(undefined) });
const angular = {
  Component: () => (target) => target,
  signal,
  input,
  computed: (fn) => fn,
  effect: () => {},
  output: () => ({
    values: [],
    emit(value) {
      this.values.push(value);
    },
  }),
  viewChild: () => signal(undefined),
  inject: () => ({}),
  forwardRef: (fn) => fn,
  booleanAttribute: Boolean,
  afterNextRender: () => {},
};
const calendar = load('calendar-utils.ts');
test('kanban cards expose read-only details without a status selector and retain drag and drop', () => {
  const template = readFileSync(
    new URL('../src/app/features/kanban/kanban.component.html', import.meta.url),
    'utf8',
  );
  const cards = template.slice(
    template.indexOf('<article class="kanban-card"'),
    template.indexOf('</article>'),
  );
  assert.doesNotMatch(cards, /<select\b|ngModelChange|Cambiar estado de/);
  assert.match(template, /editor\.viewTicket\(t\)/);
  assert.match(template, /cdkDragHandle/);
  assert.match(template, /\(cdkDropListDropped\)="drop\(\$event\)"/);
});
test('kanban detail button covers the card while keeping its drag handle separate', () => {
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.kanban-card\s*\{[^}]*position: relative/s);
  assert.match(styles, /\.kanban-card \.card-link::after\s*\{[^}]*inset: 0/s);
  assert.match(styles, /\.kanban-card \.card-link:focus-visible::after/);
  assert.match(styles, /\.kanban-card \.drag-handle\s*\{[^}]*z-index: 1/s);
});
const { DatePickerComponent } = load('date-picker.component.ts', {
  '@angular/core': angular,
  '@angular/forms': {},
  '@angular/cdk/overlay': {},
  '@angular/cdk/a11y': {},
  './icon.component': {},
  './calendar-utils': calendar,
});
const { SelectPanelComponent } = load('select-panel.component.ts', {
  '@angular/core': angular,
  './icon.component': {},
});
function key(key) {
  return {
    key,
    prevented: false,
    stopped: false,
    target: { hasAttribute: () => true },
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
  };
}

test('calendar rejects impossible dates and preserves local date-only values', () => {
  assert.equal(calendar.parseDate('2026-02-29'), null);
  assert.equal(calendar.parseDate('2026-13-01'), null);
  assert.equal(calendar.parseDate('18/10/2026'), null);
  assert.equal(calendar.dateValue(calendar.parseDate('2024-02-29')), '2024-02-29');
  assert.equal(calendar.dateValue(new Date(2026, 9, 18, 23, 59)), '2026-10-18');
});

test('calendar includes six complete weeks and crosses year boundaries', () => {
  const days = calendar.monthDays(new Date(2026, 11, 1));
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 0);
  assert.equal(calendar.dateValue(days[0]), '2026-11-29');
  assert.equal(calendar.dateValue(days[41]), '2027-01-09');
});

test('date picker emits ISO values, restores touched state, and honors limits', () => {
  const picker = new DatePickerComponent();
  let value = null,
    touched = 0;
  picker.registerOnChange((next) => {
    value = next;
  });
  picker.registerOnTouched(() => {
    touched++;
  });
  picker.min.set('2026-10-10');
  picker.max.set('2026-10-20');
  picker.open();
  picker.select('2026-10-09');
  assert.equal(value, null);
  assert.equal(picker.opened(), true);
  picker.select('2026-10-18');
  assert.equal(value, '2026-10-18');
  assert.equal(picker.opened(), false);
  assert.equal(touched, 1);
  picker.writeValue('2026-10-19');
  assert.equal(value, '2026-10-18', 'external writes must not emit model changes');
  assert.match(picker.display(), /19.*10.*2026/);
});

test('date picker validates required, malformed and out-of-range dates', () => {
  const picker = new DatePickerComponent();
  assert.equal(picker.validate({ value: '' }), null);
  picker.required.set(true);
  assert.equal(picker.validate({ value: '' }).required, true);
  assert.equal(picker.validate({ value: '2026-02-30' }).date, true);
  picker.min.set('2026-10-01');
  picker.max.set('2026-10-31');
  assert.ok(picker.validate({ value: '2026-09-30' }).minDate);
  assert.ok(picker.validate({ value: '2026-11-01' }).maxDate);
  assert.equal(picker.validate({ value: '2026-10-18' }), null);
});

test('date keyboard navigation clamps month ends and Escape does not close the parent dialog', () => {
  const picker = new DatePickerComponent();
  picker.writeValue('2026-01-31');
  picker.open();
  picker.keydown(key('PageDown'));
  assert.equal(picker.active(), '2026-02-28');
  picker.keydown(key('ArrowRight'));
  assert.equal(picker.active(), '2026-03-01');
  const escape = key('Escape');
  picker.keydown(escape);
  assert.equal(escape.stopped, true);
  assert.equal(picker.opened(), false);
  picker.setDisabledState(true);
  picker.open();
  assert.equal(picker.opened(), false);
});

test('select skips disabled options, wraps, searches and commits with keyboard', () => {
  const panel = new SelectPanelComponent();
  panel.options.set([
    { label: 'Seleccionar', value: '', disabled: true },
    { label: 'Urgente', value: 'Urgente', disabled: false },
    { label: 'Media', value: 'Media', disabled: false },
    { label: 'Baja', value: 'Baja', disabled: false },
  ]);
  panel.value.set('Media');
  panel.focus();
  assert.equal(panel.active(), 2);
  panel.keydown(key('Home'));
  assert.equal(panel.active(), 1);
  panel.keydown(key('ArrowUp'));
  assert.equal(panel.active(), 3);
  panel.keydown(key('m'));
  assert.equal(panel.active(), 2);
  panel.keydown(key('Enter'));
  assert.equal(panel.chosen.values[0], 'Media');
  const escape = key('Escape');
  panel.keydown(escape);
  assert.equal(escape.stopped, true);
  assert.equal(panel.dismissed.values.length, 1);
});

test('select with no enabled options is safe to navigate', () => {
  const panel = new SelectPanelComponent();
  panel.focus();
  panel.keydown(key('ArrowDown'));
  panel.keydown(key('Enter'));
  assert.equal(panel.active(), -1);
  assert.equal(panel.chosen.values.length, 0);
});

test('workspace switcher navigates only after a successful workspace change', async () => {
  class WorkspaceService {}
  class Router {}
  let selected = '',
    allowed = true;
  const navigation = [];
  const store = {
    activeWorkspaceId: () => 'current',
    selectWorkspace: async (id) => {
      selected = id;
      return allowed;
    },
  };
  const { WorkspaceSwitcherComponent } = load('workspace-switcher.component.ts', {
    '@angular/core': {
      ...angular,
      inject: (token) =>
        token === WorkspaceService ? store : { navigate: async (path) => navigation.push(path) },
    },
    '@angular/cdk/menu': {},
    '@angular/router': { Router },
    '../../core/services/workspace.service': { WorkspaceService },
    './icon.component': {},
  });
  const switcher = new WorkspaceSwitcherComponent();
  await switcher.selectWorkspace('current');
  assert.equal(selected, '');
  await switcher.selectWorkspace('other');
  assert.equal(selected, 'other');
  assert.equal(navigation.length, 1);
  assert.equal(navigation[0][0], '/dashboard');
  allowed = false;
  await switcher.selectWorkspace('blocked');
  assert.equal(navigation.length, 1);
});

test('all static app-icon names are registered with Lucide', () => {
  const config = readFileSync(new URL('../src/app/app.config.ts', import.meta.url), 'utf8');
  const provider = config.match(/provideLucideIcons\(([\s\S]*?)\)/)[1];
  const icons = new Set(
    Array.from(provider.matchAll(/Lucide([A-Za-z0-9]+)/g), ([, name]) =>
      name.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase(),
    ),
  );
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith('.html')) {
        const html = readFileSync(file, 'utf8');
        for (const [, name] of html.matchAll(/<app-icon\b[^>]*\sname="([^"]+)"/g))
          assert.ok(icons.has(name), `Unregistered Lucide icon: ${name} in ${file.pathname}`);
      }
    }
  }
  visit(new URL('../src/app/', import.meta.url));
});

function makeEditor(data = { kind: 'ticket' }) {
  class WorkspaceService {}
  class Dialog {}
  class DialogRef {}
  const DIALOG_DATA = Symbol('data');
  const projects = [{ id: 'project-1', key: 'UNO', name: 'Uno', status: 'Activo' }];
  const saved = [],
    closed = [];
  let relatedClosed;
  const store = {
    myMemberId: () => '',
    projects: () => projects,
    sprints: () => [],
    tickets: () => [],
    activeWorkspaceId: () => 'space-1',
    busy: () => false,
    project: (id) => projects.find((project) => project.id === id),
    save: async (collection, entity) => {
      saved.push({ collection, entity });
      return true;
    },
  };
  const dialog = {
    open: () => ({
      closed: {
        pipe: () => ({
          subscribe: (fn) => {
            relatedClosed = fn;
          },
        }),
      },
    }),
  };
  const { EntityEditorComponent } = load('entity-editor.component.ts', {
    '@angular/core': {
      ...angular,
      inject: (token) => {
        if (token === WorkspaceService) return store;
        if (token === DIALOG_DATA) return data;
        if (token === DialogRef) return { close: (entity) => closed.push(entity) };
        if (token === Dialog) return dialog;
        return {};
      },
    },
    '@angular/core/rxjs-interop': { takeUntilDestroyed: () => (value) => value },
    '@angular/forms': {},
    '@angular/cdk/dialog': { Dialog, DialogRef, DIALOG_DATA },
    '../../core/services/workspace.service': { WorkspaceService },
    '../../core/services/models': load('../../core/services/models.ts'),
    './icon.component': {},
    './form-controls.module': {},
    './ticket-screenshots.component': {},
    './toast-feedback.directive': {},
    '../../core/services/ticket-screenshots.service': {},
  });
  return {
    editor: new EntityEditorComponent(),
    saved,
    closed,
    related: (entity) => relatedClosed(entity),
  };
}

test('new tickets honor their project context and save the assigned responsible', async () => {
  const { editor, saved, closed } = makeEditor({ kind: 'ticket', projectId: 'project-1' });
  assert.equal(editor.model.project_id, 'project-1');
  editor.model.title = 'Mi ticket';
  editor.model.assignee = 'member-1';
  await editor.save();
  assert.equal(saved[0].collection, 'tickets');
  assert.equal(saved[0].entity.project_id, 'project-1');
  assert.equal(saved[0].entity.assignee, 'member-1');
  assert.equal(closed.length, 1);
});

test('creating related projects and members retains the ticket draft and selects the result', () => {
  const { editor, related } = makeEditor();
  editor.model.title = 'Conservar borrador';
  editor.model.sprint_id = 'old-sprint';
  editor.createRelated('project');
  related({ id: 'new-project', name: 'Nuevo' });
  assert.equal(editor.model.project_id, 'new-project');
  assert.equal(editor.model.sprint_id, '');
  assert.equal(editor.model.title, 'Conservar borrador');
  editor.createRelated('member');
  related({ id: 'new-member', name: 'Persona' });
  assert.equal(editor.model.assignee, 'new-member');
  editor.createRelated('member');
  related(undefined);
  assert.equal(
    editor.model.assignee,
    'new-member',
    'cancelling must not clear the current responsible',
  );
});

test('ticket delivery version is saved, trimmed, cleared and validated', async () => {
  const { editor, saved } = makeEditor({ kind: 'ticket', projectId: 'project-1' });
  editor.model.title = 'Versionado';
  editor.model.target_version = ' 1.2.0-beta.1 ';
  await editor.save();
  assert.equal(saved[0].entity.target_version, '1.2.0-beta.1');
  editor.model.target_version = '';
  await editor.save();
  assert.equal(saved[1].entity.target_version, null);
  for (const invalid of ['x'.repeat(41), 'versión con espacios', '<script>']) {
    editor.model.target_version = invalid;
    await editor.save();
    assert.match(editor.error, /versión admite/);
  }
  assert.equal(saved.length, 2);
});

test('project and member editors return their saved entities to the ticket form', async () => {
  const project = makeEditor({ kind: 'project' });
  project.editor.model.name = 'Proyecto nuevo';
  project.editor.model.key = 'NUEVO';
  await project.editor.save();
  assert.equal(project.closed[0].id, project.saved[0].entity.id);
  const member = makeEditor({ kind: 'member' });
  member.editor.model.name = 'Responsable';
  member.editor.model.email = 'responsable@example.com';
  await member.editor.save();
  assert.equal(member.closed[0].id, member.saved[0].entity.id);
});

test('destructive confirmation requires an exact match and never confirms a blank or wrong name', () => {
  const DIALOG_DATA = Symbol('data');
  class DialogRef {}
  const closed = [];
  const { ConfirmDialogComponent } = load('confirm-dialog.component.ts', {
    '@angular/core': {
      ...angular,
      inject: (token) =>
        token === DIALOG_DATA
          ? { confirmationText: 'Espacio importante' }
          : { close: (result) => closed.push(result) },
    },
    '@angular/forms': {},
    '@angular/cdk/dialog': { DIALOG_DATA, DialogRef },
  });
  const dialog = new ConfirmDialogComponent();
  dialog.confirm();
  dialog.confirmation = 'Otro nombre';
  dialog.confirm();
  assert.equal(closed.length, 0);
  dialog.confirmation = 'Espacio importante';
  dialog.confirm();
  assert.equal(closed.length, 1);
  assert.equal(closed[0], true);
});

test('failed screenshot persistence keeps the dialog open and retries the same ticket ID', async () => {
  const { editor, saved, closed } = makeEditor({ kind: 'ticket', projectId: 'project-1' });
  editor.model.title = 'Ticket con capturas';
  editor.screenshots.set({
    persist: async () => {
      throw new Error('Sin conexión');
    },
  });
  await editor.save();
  assert.equal(saved.length, 1);
  assert.equal(closed.length, 0);
  assert.match(editor.error, /ticket quedó guardado/);
  assert.equal(editor.saving(), false);
  editor.screenshots.set({ persist: async () => {} });
  await editor.save();
  assert.equal(saved[0].entity.id, saved[1].entity.id);
  assert.equal(saved[0].entity.key, saved[1].entity.key);
  assert.equal(closed.length, 1);
});
