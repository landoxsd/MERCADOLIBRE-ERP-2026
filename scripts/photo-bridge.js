/**
 * scripts/photo-bridge.js
 * Micro-servicio HTTP en Windows (puerto 8088) para:
 * 1) Servir las 39,126+ fotos de \\192.168.1.10\e\FOTOS al servidor Dell R630 (192.168.1.58:3001) en modo SOLO LECTURA.
 * 2) Proveer el Buscador de Publicaciones de Terceros (/serp) usando el token OAuth whitelisted de Integraly
 *    (App ID 377188858949192, desencriptado por DPAPI desde user.config con auto-refresh vía Integraly Backend),
 *    consultando directamente GET https://api.mercadolibre.com/sites/MLV/search sin bloqueos Anubis ni 403 PolicyAgent.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

// ================================================================
// Puente Integraly OAuth (App ID 377188858949192) para /sites/MLV/search
// ================================================================
let integralyAuthCache = null; // { token, refreshToken, usuario, usuarioId, fetchedAt }
const INTEGRALY_KEY = 'wXgBlf3D1WoG17dy0RG8U6C4Prjhd5BAr3hfv1I7RoI=';
const INTEGRALY_BACKENDS = ['https://integraly.net', 'https://drapi.net', 'https://integraly2.net'];

function readIntegralyDpapiConfig() {
  try {
    const psScript = `
Add-Type -AssemblyName System.Security
$configs = Get-ChildItem -Path "$env:LOCALAPPDATA\\Apps\\2.0\\Data" -Recurse -Filter "user.config" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
foreach ($c in $configs) {
  $raw = [System.IO.File]::ReadAllText($c.FullName)
  if ($raw -match "UsuariosToken") {
    [xml]$doc = $raw
    $node = $doc.SelectSingleNode("//setting[@name='UsuariosToken']/value")
    if ($node -and $node.InnerText) {
      $inner = $node.InnerText.Trim()
      if ($inner.StartsWith("DP1:")) {
        $b = [Convert]::FromBase64String($inner.Substring(4))
        $inner = [System.Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect($b, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))
      }
      [xml]$uDoc = $inner
      $u = $uDoc.ArrayOfSettingsUsuario.SettingsUsuario | Where-Object { $_.Token } | Select-Object -First 1
      if ($u) {
        $tok = $u.Token
        if ($tok.StartsWith("DP1:")) {
          $tb = [Convert]::FromBase64String($tok.Substring(4))
          $tok = [System.Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect($tb, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))
        }
        $rt = $u.RefreshToken
        if ($rt -and $rt.StartsWith("DP1:")) {
          $rtb = [Convert]::FromBase64String($rt.Substring(4))
          $rt = [System.Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect($rtb, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))
        }
        $out = @{ token = $tok; refreshToken = $rt; usuario = $u.Usuario; usuarioId = $u.UsuarioId; fecha = $u.FechaToken }
        Write-Output ($out | ConvertTo-Json -Compress)
        break
      }
    }
  }
}
`;
    const stdout = execFileSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
      encoding: 'utf8',
      timeout: 8000,
    }).trim();
    if (stdout) {
      const parsed = JSON.parse(stdout);
      if (parsed.token) {
        integralyAuthCache = {
          ...parsed,
          fetchedAt: Date.now(),
        };
        return integralyAuthCache;
      }
    }
  } catch (err) {
    console.warn('[PhotoBridge] Error leyendo DPAPI de Integraly:', err.message);
  }
  return integralyAuthCache;
}

async function refreshIntegralyToken(auth) {
  if (!auth?.refreshToken) return null;
  for (const base of INTEGRALY_BACKENDS) {
    try {
      const res = await fetch(`${base}/auth/ValidacionTokenRefresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integraly-Key': INTEGRALY_KEY,
        },
        body: JSON.stringify({
          code: auth.refreshToken,
          version: '(v2.2.0.6)',
          usuario: auth.usuario || 'CORPORACIONRWCCA',
          usuario_id: String(auth.usuarioId || '248086934'),
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.at) {
          integralyAuthCache = {
            ...auth,
            token: data.at,
            refreshToken: data.rt || auth.refreshToken,
            fetchedAt: Date.now(),
          };
          console.log(`🔄 [PhotoBridge] Token Integraly refrescado vía ${base}`);
          return integralyAuthCache;
        }
      }
    } catch (e) {
      // try next backend
    }
  }
  return null;
}

async function getValidIntegralyToken(forceRefresh = false) {
  if (!integralyAuthCache || (Date.now() - integralyAuthCache.fetchedAt) > 15 * 60 * 1000) {
    readIntegralyDpapiConfig();
  }
  if (!integralyAuthCache) return null;
  if (forceRefresh) {
    // Re-read disk first in case Excel refreshed it recently
    readIntegralyDpapiConfig();
    const refreshed = await refreshIntegralyToken(integralyAuthCache);
    if (refreshed) return refreshed.token;
  }
  return integralyAuthCache.token;
}

async function searchMlvViaIntegraly({ query = '', nickname = '', category = '', limit = 48, offset = 0, myItemIds = [] }) {
  const startTime = Date.now();
  let token = await getValidIntegralyToken(false);
  if (!token) {
    return { ok: false, error: 'No se encontró sesión activa de Integraly en Windows.' };
  }

  const buildSearchUrl = () => {
    const params = new URLSearchParams();
    params.set('limit', String(Math.min(50, Math.max(1, limit))));
    params.set('offset', String(Math.max(0, offset)));
    if (nickname) params.set('nickname', nickname.trim());
    if (category) params.set('category', category.trim());
    if (query) params.set('q', query.trim());
    return `https://api.mercadolibre.com/sites/MLV/search?${params.toString()}`;
  };

  const searchUrl = buildSearchUrl();
  let res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 401 || res.status === 403) {
    token = await getValidIntegralyToken(true);
    if (token) {
      res = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
    }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `ML Search HTTP ${res.status}: ${errText}` };
  }

  const data = await res.json();
  const rawItems = Array.isArray(data.results) ? data.results : [];

  // Enriquecer los primeros 20 ítems con /items?ids=... para obtener atributos, SKU y cantidad vendida real
  const top20Ids = rawItems.slice(0, 20).map(r => r.id).filter(Boolean);
  const detailsMap = new Map();
  if (top20Ids.length > 0) {
    try {
      const multiRes = await fetch(`https://api.mercadolibre.com/items?ids=${top20Ids.join(',')}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (multiRes.ok) {
        const multiData = await multiRes.json();
        if (Array.isArray(multiData)) {
          for (const entry of multiData) {
            const body = entry?.body || entry;
            if (body?.id) detailsMap.set(body.id, body);
          }
        }
      }
    } catch (e) {
      // opcional
    }
  }

  const results = rawItems.map((r, idx) => {
    const det = detailsMap.get(r.id) || {};
    const skuAttr = (det.attributes || r.attributes || []).find(a => a.id === 'SELLER_SKU' || a.id === 'PART_NUMBER');
    return {
      position: offset + idx + 1,
      id: r.id,
      title: r.title,
      price: r.price,
      price_usd: r.currency_id === 'USD' ? r.price : r.price,
      currency_id: r.currency_id || 'USD',
      seller: r.seller?.nickname || String(r.seller?.id || ''),
      seller_id: r.seller?.id || det.seller_id || null,
      official_store_id: r.official_store_id || det.official_store_id || null,
      sold_quantity: det.sold_quantity ?? r.sold_quantity ?? 0,
      available_quantity: det.available_quantity ?? r.available_quantity ?? 1,
      free_shipping: Boolean(r.shipping?.free_shipping || det.shipping?.free_shipping),
      logistic_type: r.shipping?.logistic_type || det.shipping?.logistic_type || null,
      category_id: r.category_id || det.category_id || null,
      condition: r.condition || det.condition || 'new',
      listing_type_id: r.listing_type_id || det.listing_type_id || null,
      sku: det.seller_custom_field || skuAttr?.value_name || null,
      thumbnail: r.thumbnail || det.thumbnail || null,
      url: r.permalink || det.permalink || `https://articulo.mercadolibre.com.ve/${r.id}`,
      permalink: r.permalink || det.permalink || null,
      attributes: det.attributes || r.attributes || [],
    };
  });

  const my_positions = {};
  for (const myId of (myItemIds || [])) {
    const found = results.find(it => it.id === myId);
    if (found) my_positions[myId] = found.position;
  }

  return {
    ok: true,
    source: 'integraly_mlv_api',
    query,
    nickname,
    url: searchUrl,
    total_found: data.paging?.total || results.length,
    paging: data.paging || { total: results.length, offset, limit },
    results,
    my_positions,
    elapsed_seconds: Number(((Date.now() - startTime) / 1000).toFixed(2)),
  };
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (urlObj.pathname === '/health') {
      const { dir, files } = resolvePhotosList();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        dir,
        count: files.length,
        integraly_search: true,
      }));
    }

    if (urlObj.pathname === '/serp') {
      let params = {};
      if (req.method === 'POST') {
        params = await readJsonBody(req);
      } else {
        params = {
          query: urlObj.searchParams.get('q') || urlObj.searchParams.get('query') || '',
          nickname: urlObj.searchParams.get('nickname') || '',
          category: urlObj.searchParams.get('category') || '',
          max_results: parseInt(urlObj.searchParams.get('limit') || '48', 10),
          offset: parseInt(urlObj.searchParams.get('offset') || '0', 10),
        };
      }

      const serpRes = await searchMlvViaIntegraly({
        query: params.query || params.q || '',
        nickname: params.nickname || '',
        category: params.category || '',
        limit: params.max_results || params.limit || 48,
        offset: params.offset || 0,
        myItemIds: params.my_item_ids || [],
      });

      res.writeHead(serpRes.ok ? 200 : 502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(serpRes));
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
  readIntegralyDpapiConfig();
  console.log(`✅ Photo & Integraly Search Bridge activo en http://0.0.0.0:${PORT} -> Fotos: ${files.length} (${dir}) | Integraly Auth: ${integralyAuthCache ? integralyAuthCache.usuario : 'No detectado'}`);
});
