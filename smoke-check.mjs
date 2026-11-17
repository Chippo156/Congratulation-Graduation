import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import mysql from 'mysql2/promise';
import { createApp } from './server/app.js';

if (!process.env.MYSQL_TEST_URL) throw new Error('Đặt MYSQL_TEST_URL cho MySQL thử nghiệm riêng trước khi chạy npm test.');
const testUrl = new URL(process.env.MYSQL_TEST_URL);
const schema = `graduation_test_${randomUUID().replaceAll('-', '')}`;
const admin = await mysql.createConnection({ uri: testUrl.href, charset: 'utf8mb4', timezone: 'Z' });
await admin.query('CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [schema]);
testUrl.pathname = `/${schema}`;
const database = { uri: testUrl.href };
const dir = mkdtempSync(join(tmpdir(), 'graduation-migration-'));
const databasePath = join(dir, 'wishes.sqlite');
async function launch(options) {
  const instance = await createApp({ database, ...options });
  const server = instance.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: async () => { await new Promise((resolve) => server.close(resolve)); await instance.close(); } };
}
async function send(server, payload) {
  return fetch(`${server.url}/api/wishes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
let server;
try {
  server = await launch({ rateLimit: 100 });
  let response = await send(server, { name: '  Bạn thân  ', message: "  Chúc mừng! \u{1F393} '); DROP TABLE wishes; -- <script>alert(1)</script>  " });
  assert.equal(response.status, 201);
  const saved = (await response.json()).wish;
  assert.equal(saved.name, 'Bạn thân');
  assert.equal(saved.message, "Chúc mừng! \u{1F393} '); DROP TABLE wishes; -- <script>alert(1)</script>");
  for (let i = 0; i < 14; i++) assert.equal((await send(server, { name: `Bạn ${i}`, message: `Chúc mừng hành trình ${i}` })).status, 201);
  let data = await (await fetch(`${server.url}/api/wishes`)).json();
  assert.equal(data.total, 15); assert.equal(data.wishes.length, 12); assert.equal(data.hasMore, true);
  const ids = data.wishes.map((wish) => wish.id);
  const next = await (await fetch(`${server.url}/api/wishes?before=${ids.at(-1)}`)).json();
  assert.equal(next.wishes.length, 3); assert.equal(next.hasMore, false);
  assert.equal(new Set([...ids, ...next.wishes.map((wish) => wish.id)]).size, 15);
  for (const invalid of [{ name: ' ', message: 'ok' }, { name: 'a', message: ' ' }, { name: 'x'.repeat(61), message: 'ok' }, { name: 'a', message: 'x'.repeat(601) }, { name: {}, message: 'a' }, { name: 'a', message: 12 }]) assert.equal((await send(server, invalid)).status, 400);
  for (const query of ['limit=0', 'limit=31', 'limit=no', 'before=-1', 'before=9007199254740992']) assert.equal((await fetch(`${server.url}/api/wishes?${query}`)).status, 400);
  response = await fetch(`${server.url}/api/wishes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(response.status, 400);
  assert.equal((await send(server, { name: 'a', message: 'x'.repeat(10000) })).status, 413);
  assert.equal((await fetch(`${server.url}/api/missing`)).status, 404);
  await server.close(); server = null;
  server = await launch({ rateLimit: 2 });
  data = await (await fetch(`${server.url}/api/wishes?before=2`)).json();
  assert.deepEqual(data.wishes[0], saved); assert.equal(data.total, 15);
  assert.equal((await send(server, { name: 'A', message: 'Một' })).status, 201);
  assert.equal((await send(server, { name: 'B', message: 'Hai' })).status, 201);
  response = await send(server, { name: 'C', message: 'Ba' });
  assert.equal(response.status, 429); assert.ok(Number(response.headers.get('retry-after')) > 0);
  await server.close(); server = null;
  await admin.query('DROP TABLE ??.wishes', [schema]);
  const source = new DatabaseSync(databasePath);
  source.exec('CREATE TABLE wishes (id INTEGER PRIMARY KEY, name TEXT, message TEXT, created_at TEXT)');
  const insert = source.prepare('INSERT INTO wishes VALUES (?, ?, ?, ?)');
  insert.run(1, saved.name, saved.message, saved.createdAt);
  insert.run(9, 'Nguyễn Minh Anh', 'Chúc mừng hành trình mới!', '2026-11-17T03:04:05.678Z');
  source.close();
  const migrate = () => spawnSync(process.execPath, ['server/migrate-sqlite.js', databasePath], {
    cwd: import.meta.dirname, env: { ...process.env, MYSQL_URL: testUrl.href }, encoding: 'utf8', timeout: 30_000,
  });
  let migration = migrate();
  assert.equal(migration.status, 0, migration.stderr);
  server = await launch({ rateLimit: 100 });
  data = await (await fetch(`${server.url}/api/wishes`)).json();
  assert.equal(data.total, 2);
  assert.deepEqual(data.wishes.map(wish => wish.id), [9, 1]);
  assert.equal(data.wishes[0].createdAt, '2026-11-17T03:04:05.678Z');
  assert.deepEqual(data.wishes[1], saved);
  assert.equal((await send(server, { name: 'Sau chuyển đổi', message: 'Tiếp tục viết những trang mới.' })).status, 201);
  migration = migrate();
  assert.equal(migration.status, 0, migration.stderr);
  const migrated = await (await fetch(`${server.url}/api/wishes`)).json();
  assert.equal(migrated.total, 3);
  assert.ok(migrated.wishes[0].id > 9);
  const changedSource = new DatabaseSync(databasePath);
  changedSource.prepare('UPDATE wishes SET message = ? WHERE id = 1').run('Không được ghi đè');
  changedSource.close();
  assert.equal(migrate().status, 1);
  assert.deepEqual(await (await fetch(`${server.url}/api/wishes`)).json(), migrated);
  await server.close(); server = null;
  await admin.query('DELETE FROM ??.wishes', [schema]);
  const invalidSource = new DatabaseSync(databasePath);
  invalidSource.prepare('UPDATE wishes SET name = ? WHERE id = 9').run('x'.repeat(61));
  invalidSource.close();
  assert.equal(migrate().status, 1);
  const [[remaining]] = await admin.query('SELECT COUNT(*) AS total FROM ??.wishes', [schema]);
  assert.equal(remaining.total, 0, 'Failed migration must roll back every inserted wish');
  console.log('PASS: MySQL persistence across restart; cursor pagination; exact Vietnamese text; validation; rate limiting; timestamp/ID migration; repeat migration; conflict protection; rollback.');
} finally {
  if (server) await server.close();
  await admin.query('DROP DATABASE ??', [schema]);
  await admin.end();
  rmSync(dir, { recursive: true, force: true });
}
