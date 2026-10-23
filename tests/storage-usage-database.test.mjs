import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('storage usage returns only project totals, tracks changes and retains private file isolation', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      grant usage on schema auth,storage to authenticated,anon;
      create table storage.objects(name text, metadata jsonb);
      alter table storage.objects enable row level security;
      grant select on storage.objects to authenticated;
      insert into storage.objects values ('private-a','{"size":100}'),('private-b','{"size":200}');
    `);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261023140000_storage_usage.sql', import.meta.url), 'utf8'));
    await db.exec("set role authenticated; select set_config('test.user_id','00000000-0000-0000-0000-000000000001',false)");
    assert.deepEqual((await db.query('select * from public.project_storage_usage()')).rows, [{ used_bytes: '300', complete: true }]);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    await db.exec("reset role; insert into storage.objects values ('new-photo','{\"size\":50}'); set role authenticated");
    assert.equal((await db.query('select used_bytes from public.project_storage_usage()')).rows[0].used_bytes, '350');
    await db.exec("reset role; delete from storage.objects where name='new-photo'; set role authenticated");
    assert.equal((await db.query('select used_bytes from public.project_storage_usage()')).rows[0].used_bytes, '300');
    await db.exec("reset role; insert into storage.objects values ('unknown','{}'); set role authenticated");
    assert.equal((await db.query('select complete from public.project_storage_usage()')).rows[0].complete, false);
    await db.exec("reset role; delete from storage.objects; set role authenticated");
    assert.deepEqual((await db.query('select * from public.project_storage_usage()')).rows, [{ used_bytes: '0', complete: true }]);
    await db.exec("select set_config('test.user_id','',false)");
    await assert.rejects(db.query('select * from public.project_storage_usage()'), /Inicia sesión/);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.project_storage_usage()'), /permission denied/);
  } finally {
    await db.close();
  }
});
