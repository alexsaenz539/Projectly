import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('profile avatar storage is private and enforces account ownership on reads and writes', async () => {
  const db = new PGlite();
  const user = randomUUID(),
    other = randomUUID();
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      grant usage on schema auth,storage to authenticated,anon;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
      alter table storage.objects enable row level security;
      grant select,insert,delete,update on storage.objects to authenticated;
    `);
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/20261017000000_profile_avatars.sql', import.meta.url),
        'utf8',
      ),
    );
    const bucket = (await db.query("select * from storage.buckets where id='profile-avatars'"))
      .rows[0];
    assert.equal(bucket.public, false);
    assert.equal(Number(bucket.file_size_limit), 512 * 1024);
    assert.deepEqual(bucket.allowed_mime_types, ['image/png', 'image/jpeg', 'image/webp']);
    await db.exec(`set role authenticated; select set_config('test.user_id','${user}',false);`);
    await db.query("insert into storage.objects(bucket_id,name) values ('profile-avatars',$1)", [
      `${user}/photo.webp`,
    ]);
    for (const path of [
      `${other}/foreign.webp`,
      `${user}/nested/photo.webp`,
      `${user}/photo.svg`,
      `${user}/../photo.webp`,
    ])
      await assert.rejects(
        db.query("insert into storage.objects(bucket_id,name) values ('profile-avatars',$1)", [
          path,
        ]),
        /row-level security/,
      );
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    assert.equal(
      (await db.query("update storage.objects set name='overwrite' returning id")).rows.length,
      0,
    );
    await db.exec(`select set_config('test.user_id','${other}',false);`);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 0);
    await db.exec(`select set_config('test.user_id','${user}',false);`);
    assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 1);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from storage.objects'), /permission denied/);
  } finally {
    await db.close();
  }
});
