import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the real TypeScript logic with controlled dependency injection and Auth API responses.
function load(path, dependencies = {}) {
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
    require: (name) => {
      assert.ok(name in dependencies, 'Unexpected dependency: ' + name);
      return dependencies[name];
    },
  });
  return exports;
}
const validation = load('src/app/core/auth/auth-validation.ts');
function makeAuth(client = null, configured = Boolean(client)) {
  class SupabaseService {}
  const supabase = { client, configured, ready: Promise.resolve() };
  const angular = {
    Injectable: () => (target) => target,
    inject: (token) => {
      assert.equal(token, SupabaseService);
      return supabase;
    },
    signal: (value) => {
      const get = () => value;
      get.set = (next) => {
        value = next;
      };
      return get;
    },
    computed: (expression) => expression,
  };
  const { AuthService } = load('src/app/core/auth/auth.service.ts', {
    '@angular/core': angular,
    '../services/supabase.service': { SupabaseService },
  });
  return { service: new AuthService(), AuthService };
}
function api(overrides = {}) {
  return {
    auth: {
      onAuthStateChange: () => {},
      getSession: async () => ({ data: { session: null }, error: null }),
      ...overrides,
    },
  };
}

test('login rejects blank and malformed emails and short passwords', () => {
  for (const email of ['', '  ', 'hola', 'hola@', 'hola@example', 'a b@example.com'])
    assert.ok(validation.emailError(email));
  assert.equal(validation.emailError('  persona@example.com  '), '');
  assert.ok(validation.passwordError(''));
  assert.ok(validation.passwordError('1234567'));
  assert.equal(validation.passwordError('12345678'), '');
});
test('registration requires a name and matching password confirmation', () => {
  const errors = validation.registrationErrors(' ', 'wrong', 'short', 'different');
  assert.ok(Object.values(errors).every(Boolean));
  const valid = validation.registrationErrors(
    'Ana Morales',
    'ana@example.com',
    'demo-pass',
    'demo-pass',
  );
  assert.ok(Object.values(valid).every((value) => value === ''));
});
test('demo has no access until sign-in and loses access on sign-out', async () => {
  const { service } = makeAuth();
  await service.ready;
  assert.equal(service.hasAccess(), false);
  assert.equal(await service.signUp('demo@example.com', 'demo-pass', 'Demo'), false);
  assert.equal(service.hasAccess(), false);
  await service.signIn('demo@example.com', 'demo-pass');
  assert.equal(service.hasAccess(), true);
  assert.equal(service.user(), null);
  await service.signOut();
  assert.equal(service.hasAccess(), false);
});
test('configured but unavailable backend never opens demo access', async () => {
  const { service } = makeAuth(null, true);
  await assert.rejects(service.signIn('a@example.com', 'demo-pass'), /Supabase/);
  await assert.rejects(service.signUp('a@example.com', 'demo-pass', 'Ana'), /Supabase/);
  assert.equal(service.hasAccess(), false);
});
test('Supabase sign-in passes credentials to Auth and updates the user', async () => {
  const user = { id: 'account-a', email: 'ana@example.com' };
  let request;
  const { service } = makeAuth(
    api({
      signInWithPassword: async (input) => {
        request = input;
        return { data: { user }, error: null };
      },
      signOut: async () => ({ error: null }),
    }),
  );
  await service.signIn('ana@example.com', 'demo-pass');
  assert.equal(request.email, 'ana@example.com');
  assert.equal(request.password, 'demo-pass');
  assert.equal(service.user(), user);
  assert.equal(service.hasAccess(), true);
  await service.signOut();
  assert.equal(service.hasAccess(), false);
});
test('email confirmation does not grant access; confirmed signup sets a session', async () => {
  let request;
  const { service } = makeAuth(
    api({
      signUp: async (input) => {
        request = input;
        return { data: { session: null }, error: null };
      },
    }),
  );
  assert.equal(await service.signUp('ana@example.com', 'demo-pass', 'Ana Morales'), false);
  assert.equal(request.options.data.full_name, 'Ana Morales');
  assert.equal(service.hasAccess(), false);
  const user = { id: 'account-a' };
  const immediate = makeAuth(
    api({ signUp: async () => ({ data: { session: { user } }, error: null }) }),
  ).service;
  assert.equal(await immediate.signUp('ana@example.com', 'demo-pass', 'Ana'), true);
  assert.equal(immediate.user(), user);
});
test('authentication failure does not grant access', async () => {
  const { service } = makeAuth(
    api({
      signInWithPassword: async () => ({
        data: { user: null },
        error: new Error('Invalid login credentials'),
      }),
    }),
  );
  await assert.rejects(service.signIn('ana@example.com', 'demo-pass'), /Invalid login credentials/);
  assert.equal(service.hasAccess(), false);
});
test('route guard redirects anonymous demo and permits explicit sign-in', async () => {
  const { service, AuthService } = makeAuth();
  class Router {}
  const router = { createUrlTree: (paths) => paths.join('/') };
  const { authGuard } = load('src/app/core/guards/auth.guard.ts', {
    '@angular/core': { inject: (token) => (token === AuthService ? service : router) },
    '@angular/router': { Router },
    '../auth/auth.service': { AuthService },
  });
  assert.equal(await authGuard(), '/login');
  await service.signIn('demo@example.com', 'demo-pass');
  assert.equal(await authGuard(), true);
  await service.signOut();
  assert.equal(await authGuard(), '/login');
});
