import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('private screenshot policies isolate accounts and require the correct saved ticket', async () => {
  const db = new PGlite();
  const user = randomUUID(),
    other = randomUUID(),
    workspace = randomUUID(),
    sibling = randomUUID();
  const ticket = randomUUID(),
    foreignTicket = randomUUID();
  const path = `${user}/${workspace}/${ticket}/capture.png`;
  try {
    // Storage API tables are represented here to exercise the real migration's RLS.
    // Binary MIME/size enforcement and signed URLs still require Supabase Storage.
    await db.exec(`
      create role anon; create role authenticated; create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      grant usage on schema auth,storage to authenticated,anon;
      create table public.tickets(id uuid primary key,workspace_id uuid not null,user_id uuid not null);
      alter table public.tickets enable row level security;
      create policy own_tickets on public.tickets for select to authenticated using(user_id=(select auth.uid()));
      grant select on public.tickets to authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
      alter table storage.objects enable row level security;
      grant select,insert,delete,update on storage.objects to authenticated;
      insert into public.tickets values ('${ticket}','${workspace}','${user}'),('${foreignTicket}','${sibling}','${other}');
    `);
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/20261016230000_ticket_screenshots.sql', import.meta.url),
        'utf8',
      ),
    );
    const bucket = (await db.query("select * from storage.buckets where id='ticket-screenshots'"))
      .rows[0];
    assert.equal(bucket.public, false);
    assert.equal(Number(bucket.file_size_limit), 5 * 1024 * 1024);
    assert.deepEqual(bucket.allowed_mime_types, ['image/png', 'image/jpeg', 'image/webp']);
    await db.exec(`set role authenticated; select set_config('test.user_id','${user}',false);`);
    await db.query("insert into storage.objects(bucket_id,name) values ('ticket-screenshots',$1)", [
      path,
    ]);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    for (const invalid of [
      `${user}/${sibling}/${ticket}/wrong-workspace.png`,
      `${user}/${sibling}/${foreignTicket}/foreign-ticket.png`,
      `${other}/${workspace}/${ticket}/wrong-owner.png`,
      `${user}/${workspace}/${randomUUID()}/not-saved.png`,
      `${user}/${workspace}/${ticket}/nested/invalid.png`,
    ])
      await assert.rejects(
        db.query("insert into storage.objects(bucket_id,name) values ('ticket-screenshots',$1)", [
          invalid,
        ]),
        /row-level security/,
      );
    assert.equal(
      (await db.query("update storage.objects set name='overwrite' returning id")).rows.length,
      0,
    );
    await db.exec(`select set_config('test.user_id','${other}',false);`);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 0);
    await db.exec(
      `reset role; delete from public.tickets where id='${ticket}'; set role authenticated; select set_config('test.user_id','${user}',false);`,
    );
    assert.equal(
      (await db.query('delete from storage.objects returning id')).rows.length,
      1,
      'the owner can clean up files after deleting the ticket',
    );
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from storage.objects'), /permission denied/);
  } finally {
    await db.close();
  }
});
