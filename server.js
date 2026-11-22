import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_MATERIALS = new Set(['knit', 'leather', 'suede']);
const COLOR_ZONES = ['upper', 'overlay', 'midsole', 'outsole', 'accent', 'laces'];

function createFileQueue() {
  let chain = Promise.resolve();
  return function enqueue(fn) {
    const next = chain.then(fn, fn);
    chain = next.catch(() => {});
    return next;
  };
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
}

function validateColors(colors) {
  if (!colors || typeof colors !== 'object') {
    return 'Konfigurasi warna tidak valid.';
  }
  for (const zone of COLOR_ZONES) {
    if (typeof colors[zone] !== 'string' || !HEX_COLOR_RE.test(colors[zone])) {
      return `Warna pada zona "${zone}" harus berupa kode hex 6 digit.`;
    }
  }
  return null;
}

export function createApp(options = {}) {
  const dataDir = options.dataDir || path.join(__dirname, 'data');
  const shoesPath = path.join(dataDir, 'shoes.json');
  const designsPath = path.join(dataDir, 'designs.json');
  const ordersPath = path.join(dataDir, 'orders.json');

  const enqueueWrite = createFileQueue();
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three'), {
    maxAge: '1d'
  }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'kineta-studio' });
  });

  app.get('/api/shoes', async (req, res, next) => {
    try {
      const shoes = await readJson(shoesPath);
      const { category } = req.query;
      if (typeof category === 'string' && category.trim() && category !== 'all') {
        const filtered = shoes.filter(
          (item) => item.category.toLowerCase() === category.trim().toLowerCase()
        );
        return res.json(filtered);
      }
      return res.json(shoes);
    } catch (err) {
      return next(err);
    }
  });

  app.get('/api/shoes/:id', async (req, res, next) => {
    try {
      const shoes = await readJson(shoesPath);
      const shoe = shoes.find((item) => item.id === req.params.id);
      if (!shoe) {
        return res.status(404).json({ error: 'Model sepatu tidak ditemukan.' });
      }
      return res.json(shoe);
    } catch (err) {
      return next(err);
    }
  });

  app.get('/api/designs', async (_req, res, next) => {
    try {
      const designs = await readJson(designsPath);
      return res.json(designs);
    } catch (err) {
      return next(err);
    }
  });

  app.post('/api/designs', async (req, res, next) => {
    try {
      const { name, shoeId, material, colors } = req.body || {};
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName || cleanName.length > 48) {
        return res.status(400).json({ error: 'Nama racikan harus 1 sampai 48 karakter.' });
      }
      if (!VALID_MATERIALS.has(material)) {
        return res.status(400).json({ error: 'Material upper tidak valid.' });
      }
      const colorError = validateColors(colors);
      if (colorError) {
        return res.status(400).json({ error: colorError });
      }

      const shoes = await readJson(shoesPath);
      const shoe = shoes.find((item) => item.id === shoeId);
      if (!shoe) {
        return res.status(400).json({ error: 'Model sepatu referensi tidak ditemukan.' });
      }

      const created = await enqueueWrite(async () => {
        const designs = await readJson(designsPath);
        const entry = {
          id: `dsn_${crypto.randomUUID().slice(0, 8)}`,
          name: cleanName,
          shoeId,
          shoeName: shoe.name,
          material,
          colors: Object.fromEntries(COLOR_ZONES.map((z) => [z, colors[z].toUpperCase()])),
          createdAt: new Date().toISOString()
        };
        const updated = [entry, ...designs].slice(0, 24);
        await writeJson(designsPath, updated);
        return entry;
      });

      return res.status(201).json(created);
    } catch (err) {
      return next(err);
    }
  });

  app.delete('/api/designs/:id', async (req, res, next) => {
    try {
      const removed = await enqueueWrite(async () => {
        const designs = await readJson(designsPath);
        const index = designs.findIndex((item) => item.id === req.params.id);
        if (index === -1) return false;
        designs.splice(index, 1);
        await writeJson(designsPath, designs);
        return true;
      });

      if (!removed) {
        return res.status(404).json({ error: 'Racikan tidak ditemukan.' });
      }
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  app.post('/api/orders', async (req, res, next) => {
    try {
      const { customerName, customerEmail, shippingAddress, items } = req.body || {};
      const cleanName = typeof customerName === 'string' ? customerName.trim() : '';
      const cleanEmail = typeof customerEmail === 'string' ? customerEmail.trim() : '';
      const cleanAddress = typeof shippingAddress === 'string' ? shippingAddress.trim() : '';

      if (cleanName.length < 2 || cleanName.length > 80) {
        return res.status(400).json({ error: 'Nama penerima harus diisi (minimal 2 karakter).' });
      }
      if (!EMAIL_RE.test(cleanEmail)) {
        return res.status(400).json({ error: 'Format alamat email tidak valid.' });
      }
      if (cleanAddress.length < 10 || cleanAddress.length > 240) {
        return res.status(400).json({ error: 'Alamat pengiriman minimal 10 karakter.' });
      }
      if (!Array.isArray(items) || items.length === 0 || items.length > 10) {
        return res.status(400).json({ error: 'Keranjang pesanan kosong atau melebihi batas.' });
      }

      const result = await enqueueWrite(async () => {
        const shoes = await readJson(shoesPath);
        const orders = await readJson(ordersPath);
        let totalIdr = 0;
        const verifiedItems = [];

        for (const reqItem of items) {
          const shoe = shoes.find((s) => s.id === reqItem?.shoeId);
          if (!shoe) {
            return { status: 400, error: 'Terdapat model sepatu yang tidak valid di keranjang.' };
          }
          const sizeEu = Number(reqItem.sizeEu);
          const quantity = Number(reqItem.quantity);
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
            return { status: 400, error: `Jumlah untuk ${shoe.name} harus antara 1 sampai 5.` };
          }
          const sizeEntry = shoe.sizes.find((s) => s.eu === sizeEu);
          if (!sizeEntry) {
            return { status: 400, error: `Ukuran EU ${sizeEu} tidak tersedia untuk ${shoe.name}.` };
          }
          if (sizeEntry.stock < quantity) {
            return {
              status: 409,
              error: `Stok ${shoe.name} ukuran EU ${sizeEu} tersisa ${sizeEntry.stock} pasang.`
            };
          }

          sizeEntry.stock -= quantity;
          const lineTotal = shoe.priceIdr * quantity;
          totalIdr += lineTotal;

          verifiedItems.push({
            shoeId: shoe.id,
            shoeName: shoe.name,
            sizeEu,
            quantity,
            unitPriceIdr: shoe.priceIdr,
            lineTotalIdr: lineTotal,
            colorwayName: typeof reqItem.colorwayName === 'string' && reqItem.colorwayName.trim()
              ? reqItem.colorwayName.trim().slice(0, 48)
              : 'Custom Studio',
            material: VALID_MATERIALS.has(reqItem.material)
              ? reqItem.material
              : shoe.architecture.upperDefaultMaterial
          });
        }

        const order = {
          orderId: `KNT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          customerName: cleanName,
          customerEmail: cleanEmail,
          shippingAddress: cleanAddress,
          items: verifiedItems,
          totalIdr,
          status: 'confirmed',
          createdAt: new Date().toISOString()
        };

        await writeJson(shoesPath, shoes);
        await writeJson(ordersPath, [order, ...orders]);
        return { status: 201, order };
      });

      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(201).json(result.order);
    } catch (err) {
      return next(err);
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  });

  return app;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  const app = createApp();
  app.listen(port, () => {
    console.log(`Kineta Studio berjalan di http://localhost:${port}`);
  });
}
