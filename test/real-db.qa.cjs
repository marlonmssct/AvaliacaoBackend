const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { mkdir, readdir, rm } = require('node:fs/promises');
const { join, resolve, sep } = require('node:path');
const { tmpdir } = require('node:os');
const { Client } = require('pg');
require('dotenv').config();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/L1sAAAAASUVORK5CYII=',
  'base64',
);

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL é obrigatória');
  assert.ok(process.env.API_KEY, 'API_KEY é obrigatória');

  const databaseName = `qa_test_${randomBytes(8).toString('hex')}`;
  const baseUrl = new URL(process.env.DATABASE_URL);
  const databaseUrl = new URL(baseUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const port = 35000 + Math.floor(Math.random() * 20000);
  const root = `http://127.0.0.1:${port}`;
  const uploadRoot = join(tmpdir(), databaseName + '_uploads');
  const uploadDir = join(uploadRoot, 'banners');
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl.toString(),
    PORT: String(port),
    VIACEP_URL: 'http://127.0.0.1:9',
    EXTERNAL_API_TIMEOUT: '100',
    UPLOAD_DEST: uploadDir,
  };
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await mkdir(uploadDir, { recursive: true });
  let server;
  let serverLog = '';

  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    const migration = spawnSync(
      process.platform === 'win32' ? 'cmd.exe' : 'npx',
      process.platform === 'win32'
        ? ['/c', 'npx.cmd prisma migrate deploy']
        : ['prisma', 'migrate', 'deploy'],
      { cwd: process.cwd(), env, encoding: 'utf8' },
    );
    assert.equal(migration.status, 0, migration.stdout + migration.stderr);

    server = spawn(process.execPath, ['dist/src/main.js'], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', (data) => { serverLog += data; });
    server.stderr.on('data', (data) => { serverLog += data; });

    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        const response = await fetch(`${root}/events`, {
          headers: { 'x-api-key': process.env.API_KEY },
        });
        ready = response.ok;
        if (ready) break;
      } catch { /* servidor ainda iniciando */ }
      if (server.exitCode !== null) break;
      await sleep(250);
    }
    assert.ok(ready, `Servidor não iniciou: ${serverLog.slice(-1000)}`);

    async function json(method, route, body, token) {
      const response = await fetch(root + route, {
        method,
        headers: {
          'x-api-key': process.env.API_KEY,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    }

    const register = (name, role) => json('POST', '/auth/register', {
      name,
      email: `${name.toLowerCase()}@example.invalid`,
      password: 'Password123',
      role,
    });
    assert.equal((await register('Admin', 'ADMIN')).status, 400);
    const organizer = await register('Organizer', 'ORGANIZER');
    const other = await register('Other', 'ORGANIZER');
    const customer = await register('Customer', 'CUSTOMER');
    assert.equal(organizer.status, 201);
    assert.equal(other.status, 201);
    assert.equal(customer.status, 201);
    const ownerToken = organizer.body.accessToken;
    const otherToken = other.body.accessToken;
    const customerToken = customer.body.accessToken;
    const rawTokenResponse = await fetch(`${root}/users/me`, {
      headers: { 'x-api-key': process.env.API_KEY, authorization: ownerToken },
    });
    assert.equal(rawTokenResponse.status, 401);

    const event = await json('POST', '/events', {
      title: 'QA Event', description: 'QA', locationCep: '01001000',
      locationAddress: 'Rua A', locationCity: 'Sao Paulo', locationState: 'SP',
      startsAt: '2026-12-01T20:00:00Z', endsAt: '2026-12-01T23:00:00Z',
    }, ownerToken);
    assert.equal(event.status, 201);
    const eventId = event.body.id;
    assert.equal((await json('GET', `/events/${eventId}`)).status, 404);
    assert.equal((await json('GET', `/events/${eventId}`, undefined, ownerToken)).status, 200);
    assert.equal((await json('PATCH', `/events/${eventId}`, { title: 'Hijacked' }, otherToken)).status, 403);
    assert.equal((await json('PATCH', `/events/${eventId}`, {
      endsAt: '2026-11-01T00:00:00Z',
    }, ownerToken)).status, 400);

    const sector = await json('POST', '/sectors', {
      name: 'Pista', capacity: 2, eventId,
    }, ownerToken);
    assert.equal(sector.status, 201);
    const batch = await json('POST', '/ticket-batches', {
      name: 'Lote', price: 10, totalQuantity: 2,
      startSaleDate: '2026-01-01T00:00:00Z',
      endSaleDate: '2026-12-01T00:00:00Z', sectorId: sector.body.id,
    }, ownerToken);
    assert.equal(batch.status, 201);
    const smallSector = await json('POST', '/sectors', {
      name: 'Camarote', capacity: 1, eventId,
    }, ownerToken);
    assert.equal(smallSector.status, 201);
    const smallBatchBody = {
      name: 'Lote concorrente', price: 10, totalQuantity: 1,
      startSaleDate: '2026-01-01T00:00:00Z',
      endSaleDate: '2026-12-01T00:00:00Z', sectorId: smallSector.body.id,
    };
    const batchRace = await Promise.all([
      json('POST', '/ticket-batches', smallBatchBody, ownerToken),
      json('POST', '/ticket-batches', smallBatchBody, ownerToken),
    ]);
    assert.deepEqual(batchRace.map((result) => result.status).sort(), [201, 409]);
    assert.equal((await json('GET', `/sectors/event/${eventId}`)).status, 404);
    assert.equal((await json('GET', `/sectors/${sector.body.id}`)).status, 404);
    assert.equal((await json('GET', `/ticket-batches/sector/${sector.body.id}`)).status, 404);
    assert.equal((await json('GET', `/ticket-batches/${batch.body.id}`)).status, 404);
    assert.equal((await json('GET', `/ticket-batches/${batch.body.id}`, undefined, ownerToken)).status, 200);
    assert.equal((await json('PATCH', `/ticket-batches/${batch.body.id}`, {
      endSaleDate: '2025-01-01T00:00:00Z',
    }, ownerToken)).status, 400);
    assert.equal((await json('PATCH', `/events/${eventId}/status`, {
      status: 'PUBLISHED',
    }, ownerToken)).status, 200);

    const purchaseBody = {
      ticketBatchId: batch.body.id, quantity: 1, paymentMethod: 'PIX',
    };
    const first = await json('POST', '/purchases', purchaseBody, customerToken);
    assert.equal(first.status, 201);
    const simultaneous = await Promise.all([
      json('POST', '/purchases', purchaseBody, customerToken),
      json('POST', '/purchases', purchaseBody, customerToken),
    ]);
    assert.deepEqual(simultaneous.map((result) => result.status).sort(), [201, 409]);

    const checkInBody = { ticketIdentifier: first.body.tickets[0].code };
    assert.equal((await json('POST', '/check-ins', checkInBody, ownerToken)).status, 201);
    assert.equal((await json('POST', '/check-ins', checkInBody, ownerToken)).status, 409);
    assert.equal((await json('DELETE', `/users/${customer.body.user.id}`, undefined, customerToken)).status, 409);

    async function upload(content, mime, filename, token) {
      const form = new FormData();
      form.append('file', new Blob([content], { type: mime }), filename);
      const response = await fetch(`${root}/events/${eventId}/banner`, {
        method: 'POST',
        headers: { 'x-api-key': process.env.API_KEY, authorization: `Bearer ${token}` },
        body: form,
      });
      return response.status;
    }
    assert.equal(await upload(Buffer.from('not image'), 'image/png', 'fake.png', ownerToken), 400);
    assert.equal(await upload(image, 'image/png', 'valid.png', otherToken), 403);
    assert.deepEqual(await readdir(uploadDir), []);
    assert.equal(await upload(image, 'image/png', 'valid.png', ownerToken), 200);

    assert.equal((await json('PATCH', `/events/${eventId}/status`, {
      status: 'FINISHED',
    }, ownerToken)).status, 200);
    assert.equal((await json('PATCH', `/events/${eventId}/status`, {
      status: 'PUBLISHED',
    }, ownerToken)).status, 409);

    const db = new Client({ connectionString: databaseUrl.toString() });
    await db.connect();
    try {
      const tickets = await db.query('SELECT count(*)::int AS count FROM tickets');
      const remaining = await db.query('SELECT available_quantity FROM ticket_batches WHERE id = $1', [batch.body.id]);
      const userIdType = await db.query(
        "SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id'",
      );
      assert.equal(tickets.rows[0].count, 2);
      assert.equal(remaining.rows[0].available_quantity, 0);
      assert.equal(userIdType.rows[0].data_type, 'integer');
    } finally {
      await db.end();
    }
    console.log('PASS: migration, RBAC, ownership, datas, concorrência, check-in, upload e estados');
  } finally {
    if (server) {
      server.kill();
      await sleep(300);
    }
    const resolvedRoot = resolve(uploadRoot);
    assert.ok(resolvedRoot.startsWith(resolve(tmpdir()) + sep));
    await rm(resolvedRoot, { recursive: true, force: true });
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
