/**
 * scripts/photo-bridge.js
 * Micro-servicio HTTP en Windows (puerto 8088) para servir las 39,123+ fotos
 * de \\192.168.1.10\e\FOTOS (o F:\ / Pictures\FOTOS) al servidor Dell R630 (192.168.1.58:3001)
 * en modo ESTRICTAMENTE SOLO LECTURA.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PHOTO_BRIDGE_PORT || '8088', 10);

const CANDIDATE_DIRS = [
  '\\\\192.168.1.10\\e\\FOTOS',
  '\\\\Servidor\\e\\FOTOS',
  'F:\\',
  'C:\\Users\\ORLANDO\\Pictures\\FOTOS',
];

let cachedList = null;
let cachedDir = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60000;

function resolvePhotosList() {
  const now = Date.now();
  if (cachedList && (now - cacheTime) < CACHE_TTL_MS) {
    return { dir: cachedDir, files: cachedList };
  }
  for (const dir of CANDIDATE_DIRS) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        if (files.length > 0) {
          cachedDir = dir;
          cachedList = files;
          cacheTime = now;
          return { dir, files };
        }
      }
    } catch (e) {
      // try next
    }
  }
  return { dir: null, files: [] };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (urlObj.pathname === '/health') {
      const { dir, files } = resolvePhotosList();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', dir, count: files.length }));
    }

    if (urlObj.pathname === '/list') {
      const { dir, files } = resolvePhotosList();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, dir, count: files.length, files }));
    }

    if (urlObj.pathname === '/file') {
      const rawName = urlObj.searchParams.get('name') || urlObj.searchParams.get('file') || '';
      const sub = urlObj.searchParams.get('sub') || ''; // optional 'CARROS' or 'LOGOS'
      if (!rawName) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Missing file name');
      }

      const safeName = path.basename(rawName);
      const safeSub = sub ? path.basename(sub) : '';

      for (const baseDir of CANDIDATE_DIRS) {
        try {
          const targetDir = safeSub ? path.join(baseDir, safeSub) : baseDir;
          const fullPath = path.join(targetDir, safeName);
          if (fs.existsSync(fullPath)) {
            const buf = await fs.promises.readFile(fullPath);
            const ext = path.extname(safeName).toLowerCase();
            const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
            res.writeHead(200, {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
            });
            return res.end(buf);
          }
        } catch (err) {
          // continue
        }
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Photo not found');
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Error: ' + err.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const { dir, files } = resolvePhotosList();
  console.log(`✅ Photo Bridge activo en http://0.0.0.0:${PORT} -> Sirviendo ${files.length} fotos desde ${dir}`);
});
