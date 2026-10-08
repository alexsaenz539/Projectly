import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL: permisos y consistencia del espacio personal', async (t) => {
  const db = new PGlite();
  const a = '11111111-1111-4111-8111-111111111111',
    b = '22222222-2222-4222-8222-222222222222';
  const member = '33333333-3333-4333-8333-333333333333',
    project = '44444444-4444-4444-8444-444444444444';
  const sprint = '55555555-5555-4555-8555-555555555555',
    ticket = '66666666-6666-4666-8666-666666666666';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      insert into auth.users values ('${a}'),('${b}');`);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.exec(`set role authenticated; select set_config('test.user_id','${a}',false);`);
    await t.test('Crea entidades y genera notificaciones al cambiar tickets', async () => {
      await db.query('insert into members(id,name,email) values ($1,$2,$3)', [
        member,
        'Ana',
        'ana@ejemplo.com',
      ]);
      await db.query('insert into projects(id,key,name,owner) values ($1,$2,$3,$4)', [
        project,
        'WEB',
        'Portal',
        member,
      ]);
      await db.query(
        'insert into sprints(id,project_id,name,start,"end") values ($1,$2,$3,$4,$5)',
        [sprint, project, 'Sprint', '2026-10-08', '2026-10-22'],
      );
      await db.query(
        'insert into tickets(id,project_id,key,title,assignee,sprint_id) values ($1,$2,$3,$4,$5,$6)',
        [ticket, project, 'WEB-101', 'Revisar registro', member, sprint],
      );
      assert.equal((await db.query('select * from notifications')).rows.length, 1);
      await db.query('update tickets set status=$1 where id=$2', ['Completado', ticket]);
      assert.equal((await db.query('select * from notifications')).rows.length, 2);
    });
    await t.test('Rechaza fechas inválidas y claves repetidas', async () => {
      await assert.rejects(
        db.query('insert into sprints(project_id,name,start,"end") values ($1,$2,$3,$4)', [
          project,
          'Inválido',
          '2026-10-22',
          '2026-10-08',
        ]),
        /check constraint/,
      );
      await assert.rejects(
        db.query('insert into tickets(project_id,key,title) values ($1,$2,$3)', [
          project,
          'WEB-101',
          'Duplicado',
        ]),
        /unique constraint/,
      );
    });
    await t.test('Otra cuenta no puede leer, modificar ni eliminar datos ajenos', async () => {
      await db.exec(`select set_config('test.user_id','${b}',false);`);
      assert.equal((await db.query('select * from tickets')).rows.length, 0);
      assert.equal(
        (
          await db.query('update tickets set title=$1 where id=$2 returning id', [
            'Intrusión',
            ticket,
          ])
        ).rows.length,
        0,
      );
      assert.equal(
        (await db.query('delete from tickets where id=$1 returning id', [ticket])).rows.length,
        0,
      );
      await assert.rejects(
        db.query('insert into projects(user_id,key,name) values ($1,$2,$3)', [
          a,
          'BAD',
          'Intrusión',
        ]),
        /row-level security/,
      );
      await assert.rejects(
        db.query('insert into tickets(project_id,key,title) values ($1,$2,$3)', [
          project,
          'BAD-101',
          'Proyecto ajeno',
        ]),
        /foreign key constraint/,
      );
    });
    await t.test('No transfiere propiedad ni mezcla sprints de proyectos distintos', async () => {
      await db.exec(`select set_config('test.user_id','${a}',false);`);
      await assert.rejects(
        db.query('update tickets set user_id=$1 where id=$2', [b, ticket]),
        /row-level security/,
      );
      const p2 = (
        await db.query("insert into projects(key,name) values ('OPS','Operaciones') returning id")
      ).rows[0].id;
      await assert.rejects(
        db.query('insert into tickets(project_id,key,title,sprint_id) values ($1,$2,$3,$4)', [
          p2,
          'OPS-101',
          'Sprint ajeno',
          sprint,
        ]),
        /foreign key constraint/,
      );
      assert.equal(
        (await db.query('select status from tickets where id=$1', [ticket])).rows[0].status,
        'Completado',
      );
    });
    await t.test('El acceso anónimo está revocado', async () => {
      await db.exec('reset role; set role anon;');
      await assert.rejects(db.query('select * from tickets'), /permission denied/);
    });
  } finally {
    await db.close();
  }
});
