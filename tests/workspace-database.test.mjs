import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
test('PostgreSQL: migration preserves historical data and isolates workspace relations', async (t) => {
  const db = new PGlite(),
    user = randomUUID(),
    other = randomUUID();
  const member = randomUUID(),
    project = randomUUID(),
    sprint = randomUUID(),
    ticket = randomUUID();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      insert into auth.users values ('${user}'),('${other}');`);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.exec(`set role authenticated; select set_config('test.user_id','${user}',false);`);
    await db.query('insert into members(id,name,email) values ($1,$2,$3)', [
      member,
      'Ana',
      'a@example.com',
    ]);
    await db.query('insert into projects(id,key,name,owner) values ($1,$2,$3,$4)', [
      project,
      'WEB',
      'Portal anterior',
      member,
    ]);
    await db.query('insert into sprints(id,project_id,name,start,"end") values ($1,$2,$3,$4,$5)', [
      sprint,
      project,
      'Sprint anterior',
      '2026-10-08',
      '2026-10-22',
    ]);
    await db.query(
      'insert into tickets(id,project_id,key,title,assignee,sprint_id) values ($1,$2,$3,$4,$5,$6)',
      [ticket, project, 'WEB-101', 'Ticket anterior', member, sprint],
    );
    await db.exec('reset role;');
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/20261008222620_workspace_isolation.sql', import.meta.url),
        'utf8',
      ),
    );
    await db.exec('set role authenticated;');
    let first, second, p2;
    await t.test(
      'backfill retains all IDs and does not generate duplicate notifications',
      async () => {
        const spaces = (await db.query('select * from workspaces')).rows;
        assert.equal(spaces.length, 1);
        first = spaces[0].id;
        assert.equal(spaces[0].name, 'Mi espacio personal');
        for (const table of ['members', 'projects', 'sprints', 'tickets', 'notifications']) {
          const rows = (await db.query('select * from ' + table)).rows;
          assert.equal(rows.length, 1);
          assert.equal(rows[0].workspace_id, first);
        }
        assert.equal((await db.query('select id from tickets')).rows[0].id, ticket);
      },
    );
    await t.test('new spaces can reuse keys while duplicates inside one space fail', async () => {
      second = (
        await db.query(
          "insert into workspaces(name,slug) values ('Producto nuevo','producto-nuevo') returning id",
        )
      ).rows[0].id;
      p2 = (
        await db.query(
          "insert into projects(workspace_id,key,name) values ($1,'WEB','Portal nuevo') returning id",
          [second],
        )
      ).rows[0].id;
      await assert.rejects(
        db.query("insert into projects(workspace_id,key,name) values ($1,'WEB','Duplicado')", [
          second,
        ]),
        /unique constraint/,
      );
      await db.query(
        "insert into tickets(workspace_id,project_id,key,title) values ($1,$2,'WEB-101','Ticket nuevo')",
        [second, p2],
      );
      assert.equal(
        (await db.query('select * from tickets where workspace_id=$1', [first])).rows.length,
        1,
      );
      assert.equal(
        (await db.query('select * from tickets where workspace_id=$1', [second])).rows.length,
        1,
      );
      const notification = (
        await db.query("select * from notifications where body like '%Ticket nuevo%'")
      ).rows[0];
      assert.equal(notification.workspace_id, second);
    });
    await t.test('projects, assignees and sprints cannot cross workspace boundaries', async () => {
      await assert.rejects(
        db.query(
          "insert into projects(workspace_id,key,name,owner) values ($1,'BAD','Otro espacio',$2)",
          [second, member],
        ),
        /foreign key constraint/,
      );
      await assert.rejects(
        db.query(
          "insert into tickets(workspace_id,project_id,key,title) values ($1,$2,'BAD-1','Proyecto ajeno')",
          [second, project],
        ),
        /foreign key constraint/,
      );
      await assert.rejects(
        db.query(
          "insert into tickets(workspace_id,project_id,key,title,assignee) values ($1,$2,'BAD-2','Responsable ajeno',$3)",
          [second, p2, member],
        ),
        /foreign key constraint/,
      );
      await assert.rejects(
        db.query(
          "insert into tickets(workspace_id,project_id,key,title,sprint_id) values ($1,$2,'BAD-3','Sprint ajeno',$3)",
          [second, p2, sprint],
        ),
        /foreign key constraint/,
      );
      await assert.rejects(
        db.query("update tickets set workspace_id=$1,key='MOVE-101' where id=$2", [second, ticket]),
        /foreign key constraint/,
      );
    });
    await t.test('invalid identifiers and duplicate slugs are rejected by PostgreSQL', async () => {
      for (const slug of ['ab', 'demo', 'invalid--slug', 'Uppercase'])
        await assert.rejects(
          db.query('insert into workspaces(name,slug) values ($1,$2)', ['Producto', slug]),
          /check constraint/,
        );
      await assert.rejects(
        db.query("insert into workspaces(name,slug) values ('Duplicado','producto-nuevo')"),
        /unique constraint/,
      );
    });
    await t.test(
      'another account cannot read, alter ownership or write into a foreign space',
      async () => {
        await assert.rejects(
          db.query('update workspaces set user_id=$1 where id=$2', [other, first]),
          /row-level security/,
        );
        await db.exec(`select set_config('test.user_id','${other}',false);`);
        assert.equal((await db.query('select * from workspaces')).rows.length, 0);
        assert.equal((await db.query('select * from projects')).rows.length, 0);
        assert.equal(
          (
            await db.query("update workspaces set name='Intrusión' where id=$1 returning id", [
              first,
            ])
          ).rows.length,
          0,
        );
        await assert.rejects(
          db.query(
            "insert into members(workspace_id,name,email) values ($1,'Intruso','i@example.com')",
            [first],
          ),
          /foreign key constraint/,
        );
        await assert.rejects(
          db.query(
            "insert into workspaces(user_id,name,slug) values ($1,'Intrusión','intrusion')",
            [user],
          ),
          /row-level security/,
        );
        // Identifiers are private to each account.
        await db.query(
          "insert into workspaces(name,slug) values ('Otro producto','producto-nuevo')",
        );
      },
    );
    await t.test('anonymous workspace access is revoked', async () => {
      await db.exec('reset role; set role anon;');
      await assert.rejects(db.query('select * from workspaces'), /permission denied/);
    });
  } finally {
    await db.close();
  }
});
