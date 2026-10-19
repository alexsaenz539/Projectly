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

function avatar() {
  const profiles = { image: (member) => (member?.id === 'ana' ? 'avatars/leaf.svg' : '') };
  const dependencies = {
    '@angular/core': {
      Component: () => (value) => value,
      computed: (fn) => fn,
      inject: () => profiles,
      input: signal,
      signal,
    },
    '@angular/cdk/overlay': {},
    '../../../core/services/member-profile.service': {},
  };
  const source = readFileSync(
    new URL(
      '../src/app/shared/components/assignee-avatar/assignee-avatar.component.ts',
      import.meta.url,
    ),
    'utf8',
  );
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
      require: (name) => {
        assert.ok(name in dependencies, name);
        return dependencies[name];
      },
    },
  );
  return new exports.AssigneeAvatarComponent();
}

test('assignee avatar shows the matching profile photo and otherwise uses initials', () => {
  const c = avatar();
  assert.equal(c.name(), 'Sin asignar');
  assert.equal(c.initials(), '—');
  assert.equal(c.image(), '');
  c.member.set({ id: 'ana', name: 'Ana María Pérez', email: ' ANA@example.com ' });
  assert.equal(c.name(), 'Ana María Pérez');
  assert.equal(c.initials(), 'AP');
  assert.equal(c.image(), 'avatars/leaf.svg');
  c.member.set({ name: 'Luis', email: 'luis@example.com' });
  assert.equal(c.image(), '');
  assert.equal(c.initials(), 'L');
});

test('assignee tooltip appears on hover or focus and can be dismissed with Escape', () => {
  const c = avatar();
  assert.equal(c.showTooltip(), false);
  c.hovered.set(true);
  assert.equal(c.showTooltip(), true);
  c.focused.set(true);
  c.hovered.set(false);
  assert.equal(c.showTooltip(), true);
  c.dismissed.set(true);
  assert.equal(c.showTooltip(), false);
  c.dismissed.set(false);
  c.focused.set(false);
  assert.equal(c.showTooltip(), false);
});
