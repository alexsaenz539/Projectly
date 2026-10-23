import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

function load(name, dependencies = {}) {
  const source = readFileSync(new URL(`../src/app/core/services/${name}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: path => {
    if (!(path in dependencies)) throw new Error(`Unexpected import: ${path}`);
    return dependencies[path];
  } });
  return exports;
}
const topics = load('ticket-topics');
const list = load('ticket-list', { './ticket-topics': topics });
const plain = value => JSON.parse(JSON.stringify(value));

test('topics normalize whitespace, case and Unicode without duplicating known labels', () => {
  assert.deepEqual(plain(topics.normalizeTopics([' hoteles ', 'HOTELES', ' Reservas   web ', '', 'Cafe\u0301', 'Café'], ['Hoteles'])), ['Hoteles', 'Reservas web', 'Café']);
  assert.equal(topics.ticketHasTopic({}, 'Hoteles'), false);
  assert.equal(topics.ticketHasTopic({ topics: ['Hoteles', 'Reservas'] }, ' HOTELES '), true);
});

const tickets = [
  { id: '1', key: 'A-1', title: 'Reserva', project_id: 'a', topics: ['Hoteles', 'Reservas'], status: 'Pendiente', priority: 'Alta', assignee: 'ana', type: 'Bug', target_version: '1.0', sprint_id: 's1' },
  { id: '2', key: 'B-2', title: 'Pago', project_id: 'b', topics: ['hoteles'], status: 'Completado', priority: 'Media', assignee: null, type: 'Tarea', target_version: null, sprint_id: null },
  { id: '3', key: 'A-3', title: 'Anterior', project_id: 'a', status: 'Pendiente', priority: 'Baja', assignee: null, type: 'Mejora' },
];
const filtered = filters => list.filterTickets(tickets, { ...list.EMPTY_TICKET_FILTERS, ...filters }).map(ticket => ticket.id);

test('topic filter collects tickets across projects and combines with all other criteria', () => {
  assert.deepEqual(plain(filtered({ topic: 'Hoteles' })), ['1', '2']);
  assert.deepEqual(plain(filtered({ topic: 'Hoteles', project: 'b' })), ['2']);
  assert.deepEqual(plain(filtered({ topic: 'Hoteles', status: 'Pendiente', priority: 'Alta', assignee: 'ana', type: 'Bug', version: '1.0', sprint: 's1' })), ['1']);
  assert.deepEqual(plain(filtered({ query: ' HOTELES ' })), ['1', '2']);
  assert.deepEqual(plain(filtered({ assignee: 'unassigned', version: ':none:', sprint: 'no-sprint' })), ['2', '3']);
  assert.deepEqual(plain(filtered({ type: 'Mejora', topic: 'Hoteles' })), []);
});

test('pagination limits rows, clamps stale pages and handles empty results', () => {
  const many = Array.from({ length: 61 }, (_, id) => ({ id }));
  const first = list.paginateTickets(many, 1, 25);
  assert.equal(first.tickets.length, 25);
  assert.equal(first.start, 1);
  assert.equal(first.end, 25);
  const last = list.paginateTickets(many, 99, 25);
  assert.equal(last.page, 3);
  assert.equal(last.tickets.length, 11);
  assert.equal(last.start, 51);
  assert.equal(last.end, 61);
  assert.equal(list.paginateTickets(many, -1, 10).page, 1);
  assert.equal(list.paginateTickets(many, 1, 0).tickets.length, 25);
  assert.deepEqual(plain(list.paginateTickets([], 9, 25)), { page: 1, pages: 1, start: 0, end: 0, tickets: [] });
});

test('topics migration preserves legacy tickets and validates arrays', async () => {
  const db = new PGlite();
  try {
    await db.exec("create table public.tickets(id text primary key); insert into public.tickets values ('old');");
    await db.exec(readFileSync(new URL('../supabase/migrations/20261023120000_ticket_topics.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await db.query('select topics from public.tickets')).rows[0].topics, []);
    for (const values of [[], ['Hoteles'], ['Hoteles', 'Reservas']]) {
      await db.query("update public.tickets set topics=$1 where id='old'", [values]);
      assert.deepEqual((await db.query('select topics from public.tickets')).rows[0].topics, values);
    }
    for (const values of [[''], [' '], [null], ['x'.repeat(61)], ['Hoteles', 'hoteles'], Array.from({ length: 21 }, (_, i) => `Tema ${i}`)]) {
      await assert.rejects(db.query("update public.tickets set topics=$1 where id='old'", [values]), /check constraint/);
    }
    await assert.rejects(db.exec("update public.tickets set topics=null"), /not-null constraint/);
    await assert.rejects(db.exec("update public.tickets set topics=ARRAY[['A','B'],['C','D']]"), /check constraint/);
  } finally {
    await db.close();
  }
});
