import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('catalog migration backfills labels and enforces account/workspace isolation', async () => {
  const db = new PGlite();
  const user = randomUUID(), other = randomUUID(), first = randomUUID(), second = randomUUID();
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      insert into auth.users values ('${user}'),('${other}');
      create table public.workspaces(id uuid primary key, user_id uuid not null, unique(id,user_id));
      insert into public.workspaces values ('${first}','${user}'),('${second}','${user}');
      grant select on public.workspaces to authenticated;
      create table public.tickets(id text primary key, user_id uuid not null, workspace_id uuid not null, target_version text);
      grant select,insert,update on public.tickets to authenticated;
      insert into public.tickets values ('old','${user}','${first}','1.0');
    `);
    for (const file of ['20261023120000_ticket_topics.sql']) {
      await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    await db.exec("update public.tickets set topics=ARRAY['Hoteles','Reservas']");
    await db.exec(readFileSync(new URL('../supabase/migrations/20261023130000_ticket_catalogs.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query('select count(*)::int as count from ticket_catalog')).rows[0].count, 3);
    assert.deepEqual((await db.query("select topics,target_version from tickets where id='old'")).rows[0], { topics: ['Hoteles', 'Reservas'], target_version: '1.0' });
    await db.exec(`set role authenticated; select set_config('test.user_id','${user}',false)`);
    await db.exec("update tickets set topics=ARRAY['Reservas'], target_version='1.0' where id='old'");
    await assert.rejects(db.exec("update tickets set topics=ARRAY['No existe'] where id='old'"), /catálogo/);
    await assert.rejects(db.exec("update tickets set target_version='2.0' where id='old'"), /catálogo/);
    await db.query("insert into ticket_catalog(workspace_id,kind,name) values ($1,'version','2.0')", [second]);
    await assert.rejects(db.exec("update tickets set target_version='2.0' where id='old'"), /catálogo/);
    await db.query("insert into ticket_catalog(workspace_id,kind,name) values ($1,'topic','Pagos')", [first]);
    await db.exec("update tickets set topics=ARRAY['Pagos'] where id='old'");
    await assert.rejects(db.exec("update ticket_catalog set name='Otro'"), /permission denied/);
    await assert.rejects(db.exec('delete from ticket_catalog'), /permission denied/);
    await db.exec(`select set_config('test.user_id','${other}',false)`);
    assert.equal((await db.query('select * from ticket_catalog')).rows.length, 0);
    await assert.rejects(db.query("insert into ticket_catalog(workspace_id,kind,name) values ($1,'topic','Ajeno')", [first]), /row-level security|foreign key/);
    await db.exec('set role anon');
    await assert.rejects(db.exec('select * from ticket_catalog'), /permission denied/);
  } finally {
    await db.close();
  }
});
