import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('registered assignees use private profile photos without exposing unrelated accounts or files', async () => {
  const db = new PGlite();
  const owner = randomUUID(),
    person = randomUUID(),
    outsider = randomUUID(),
    pending = randomUUID();
  const space = randomUUID(),
    foreignSpace = randomUUID(),
    member = randomUUID(),
    contact = randomUUID();
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      grant usage on schema auth,storage,public to authenticated,anon;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
      create table public.workspaces(id uuid primary key,user_id uuid references auth.users(id));
      create table public.members(id uuid primary key,user_id uuid,workspace_id uuid,email text,name text);
      create table public.tickets(id uuid primary key default gen_random_uuid(),user_id uuid,workspace_id uuid,assignee uuid,title text);
      alter table public.members enable row level security;
      alter table public.tickets enable row level security;
      create policy own_members on public.members for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
      create policy own_tickets on public.tickets for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
      grant select,insert,update on public.members,public.tickets to authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select,insert,delete on storage.objects to authenticated;
      insert into auth.users(id,email,email_confirmed_at) values
        ('${owner}','owner@example.com',now()),('${person}','person@example.com',now()),
        ('${outsider}','outsider@example.com',now()),('${pending}','pending@example.com',null);
      update auth.users set raw_user_meta_data=jsonb_build_object('profile_avatar','custom','profile_photo_path','${person}/current.webp') where id='${person}';
      insert into public.workspaces values ('${space}','${owner}'),('${foreignSpace}','${outsider}');
      insert into public.members values ('${member}','${owner}','${space}',' Person@example.com ','Persona'),('${contact}','${owner}','${space}','pending@example.com','Pendiente');
      insert into public.tickets(user_id,workspace_id,assignee,title) values ('${owner}','${space}','${contact}','Histórico');
    `);
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/20261017000000_profile_avatars.sql', import.meta.url),
        'utf8',
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          '../supabase/migrations/20261019190000_member_account_profiles.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    assert.equal(
      (await db.query('select account_id from public.members where id=$1', [member])).rows[0]
        .account_id,
      person,
    );
    await db.exec(`insert into storage.objects(bucket_id,name) values ('profile-avatars','${person}/current.webp'),('profile-avatars','${person}/old.webp'),('ticket-screenshots','${person}/current.webp');
      set role authenticated; select set_config('test.user_id','${owner}',false);`);
    const images = await db.query('select * from public.member_profile_images($1)', [space]);
    assert.equal(images.rows.length, 1);
    assert.equal(images.rows[0].photo_path, `${person}/current.webp`);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 0);
    await assert.rejects(
      db.query("insert into storage.objects(bucket_id,name) values ('profile-avatars',$1)", [
        `${person}/injected.webp`,
      ]),
      /row-level security/,
    );
    await assert.rejects(db.query('select * from auth.users'), /permission denied/);
    assert.equal(
      (await db.query('select * from public.member_profile_images($1)', [foreignSpace])).rows
        .length,
      0,
    );
    await db.query('update public.members set account_id=$1 where id=$2', [outsider, member]);
    assert.equal(
      (await db.query('select account_id from public.members where id=$1', [member])).rows[0]
        .account_id,
      person,
    );
    await db.query(
      "insert into public.tickets(user_id,workspace_id,assignee,title) values ($1,$2,$3,'Nuevo')",
      [owner, space, member],
    );
    const selfMember = randomUUID();
    await db.query('insert into public.members(id,user_id,workspace_id,email,name) values ($1,$2,$3,$4,$5)', [selfMember, owner, space, 'owner@example.com', 'Yo']);
    assert.equal((await db.query('select account_id from public.members where id=$1', [selfMember])).rows[0].account_id, owner);
    await db.query("insert into public.tickets(user_id,workspace_id,assignee,title) values ($1,$2,$3,'Asignado a mí')", [owner, space, selfMember]);
    await assert.rejects(
      db.query(
        "insert into public.tickets(user_id,workspace_id,assignee,title) values ($1,$2,$3,'Inválido')",
        [owner, space, contact],
      ),
      /cuenta registrada/,
    );
    await db.query("update public.tickets set title='Histórico conservado' where assignee=$1", [
      contact,
    ]);
    await db.exec(`select set_config('test.user_id','${outsider}',false);`);
    assert.equal(
      (await db.query('select * from public.member_profile_images($1)', [space])).rows.length,
      0,
    );
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    await db.exec(
      `reset role; update auth.users set email_confirmed_at=now() where id='${pending}';`,
    );
    assert.equal(
      (await db.query('select account_id from public.members where id=$1', [contact])).rows[0]
        .account_id,
      pending,
    );
    // Metadatos manipulados no deben autorizar fotos de otra cuenta.
    await db.exec(`update auth.users set raw_user_meta_data=jsonb_build_object('profile_avatar','custom','profile_photo_path','${outsider}/private.webp') where id='${person}';
      set role authenticated; select set_config('test.user_id','${owner}',false);`);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    assert.equal(
      (
        await db.query(
          'select photo_path from public.member_profile_images($1) where member_id=$2',
          [space, member],
        )
      ).rows[0].photo_path,
      '',
    );
    await db.exec(`reset role; delete from auth.users where id='${person}';`);
    assert.equal(
      (await db.query('select account_id from public.members where id=$1', [member])).rows[0]
        .account_id,
      null,
    );
    await db.exec('set role anon;');
    await assert.rejects(
      db.query('select * from public.member_profile_images($1)', [space]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
