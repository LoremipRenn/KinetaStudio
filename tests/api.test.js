import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.js';

async function setupTestServer() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kineta-test-'));
  const srcDataDir = path.join(process.cwd(), 'data');
  await fs.cp(srcDataDir, tempDir, { recursive: true });

  const app = createApp({ dataDir: tempDir });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    async cleanup() {
      await new Promise((resolve) => server.close(resolve));
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  };
}

test('GET /api/health and /api/shoes return valid studio catalog', async () => {
  const ctx = await setupTestServer();
  try {
    const healthRes = await fetch(`${ctx.baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.ok, true);

    const shoesRes = await fetch(`${ctx.baseUrl}/api/shoes`);
    assert.equal(shoesRes.status, 200);
    const shoes = await shoesRes.json();
    assert.equal(shoes.length, 10);

    const filteredRes = await fetch(`${ctx.baseUrl}/api/shoes?category=Air%20Cushion`);
    const filtered = await filteredRes.json();
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].id, 'air-pulse-90');
  } finally {
    await ctx.cleanup();
  }
});

test('POST /api/designs validates input, saves build, and DELETE removes it', async () => {
  const ctx = await setupTestServer();
  try {
    const badRes = await fetch(`${ctx.baseUrl}/api/designs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', shoeId: 'air-pulse-90', material: 'knit', colors: {} })
    });
    assert.equal(badRes.status, 400);

    const createRes = await fetch(`${ctx.baseUrl}/api/designs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Senja Studio',
        shoeId: 'air-pulse-90',
        material: 'suede',
        colors: {
          upper: '#ECE7DD',
          overlay: '#C24E2D',
          midsole: '#F8F6F1',
          outsole: '#242220',
          accent: '#B83B1B',
          laces: '#1E1D1B'
        }
      })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.name, 'Senja Studio');

    const listRes = await fetch(`${ctx.baseUrl}/api/designs`);
    const list = await listRes.json();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, created.id);

    const delRes = await fetch(`${ctx.baseUrl}/api/designs/${created.id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);

    const emptyRes = await fetch(`${ctx.baseUrl}/api/designs`);
    const emptyList = await emptyRes.json();
    assert.equal(emptyList.length, 0);
  } finally {
    await ctx.cleanup();
  }
});

test('POST /api/orders computes total on server and decrements stock', async () => {
  const ctx = await setupTestServer();
  try {
    const orderRes = await fetch(`${ctx.baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Raka Pratama',
        customerEmail: 'raka@example.com',
        shippingAddress: 'Jalan Kemang Raya No. 18, Jakarta Selatan',
        items: [
          {
            shoeId: 'air-pulse-90',
            sizeEu: 41,
            quantity: 2,
            colorwayName: 'Infrared 90',
            material: 'knit'
          }
        ]
      })
    });
    assert.equal(orderRes.status, 201);
    const order = await orderRes.json();
    assert.equal(order.totalIdr, 2190000 * 2);
    assert.ok(order.orderId.startsWith('KNT-'));

    const shoeRes = await fetch(`${ctx.baseUrl}/api/shoes/air-pulse-90`);
    const shoe = await shoeRes.json();
    const size41 = shoe.sizes.find((s) => s.eu === 41);
    assert.equal(size41.stock, 10);
  } finally {
    await ctx.cleanup();
  }
});
