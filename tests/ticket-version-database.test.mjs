import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('delivery version migration preserves legacy tickets and validates optional version labels', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create table public.tickets(id text primary key, title text); insert into public.tickets values ('old','Existing ticket');",
    );
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/20261019180000_ticket_target_version.sql', import.meta.url),
        'utf8',
      ),
    );
    assert.deepEqual((await db.query('select * from public.tickets')).rows[0], {
      id: 'old',
      title: 'Existing ticket',
      target_version: null,
    });
    for (const version of ['0.1.6', 'v1.2.0-beta.1', '2026.10', null]) {
      await db.query("update public.tickets set target_version=$1 where id='old'", [version]);
      assert.equal(
        (await db.query('select target_version from public.tickets')).rows[0].target_version,
        version,
      );
    }
    for (const invalid of ['', 'x'.repeat(41), 'bad version', '<script>'])
      await assert.rejects(
        db.query("update public.tickets set target_version=$1 where id='old'", [invalid]),
        /check constraint/,
      );
  } finally {
    await db.close();
  }
});
