import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../supabase/templates/confirmation.html', import.meta.url), 'utf8');

test('confirmation email preserves Supabase links and accessible Spanish content', () => {
  assert.match(html, /<html lang="es">/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<h1\b/);
  assert.equal((html.match(/href="{{ \.ConfirmationURL }}"/g) ?? []).length, 2);
  assert.match(html, />{{ \.ConfirmationURL }}<\/a>/);
  assert.match(html, /Confirmar mi correo/);
  assert.match(html, /Si no creaste esta cuenta/);
  assert.match(html, /No compartas este enlace/);
  assert.doesNotMatch(html, /<script|<form|<iframe|\.Token\b|\.Data\b/i);
});

test('confirmation email has resilient email styling without remote assets', () => {
  assert.match(html, /role="presentation"/);
  assert.match(html, /prefers-color-scheme: dark/);
  assert.match(html, /max-width: 600px/);
  assert.match(html, /word-break: break-all/);
  assert.match(html, /mso-padding-alt/);
  assert.match(html, /#111827/);
  assert.match(html, /#10b981/);
  assert.doesNotMatch(html, /<img|@import|url\(|<link\b/i);
});
