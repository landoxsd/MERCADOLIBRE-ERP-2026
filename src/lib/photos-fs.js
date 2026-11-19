// ================================================================
// src/lib/photos-fs.js
// Resolución compartida de la carpeta de fotos de repuestos.
//
// POR QUÉ \\Servidor\e\FOTOS NO BASTA EN PRODUCCIÓN:
// La app en Coolify corre dentro de un contenedor Linux (Dell R630).
// Node en Linux NO puede abrir rutas UNC de Windows (\\Servidor\... o
// \\192.168.1.10\...). Hace falta UNA de estas vías:
//   1) Bind-mount CIFS en el host → /mnt/fotos dentro del contenedor
//   2) Photo Bridge HTTP en la PC Windows que SÍ ve el share
//      (scripts/photo-bridge.js en 192.168.1.97:8088 → lee F: o UNC)
// En Windows local, sí funciona \\Servidor\e\FOTOS / F:\ directamente.
// ================================================================
import fs from "fs";
import path from "path";
import os from "os";

const isWin = process.platform === "win32";

/** Rutas candidatas en orden de preferencia. */
export function getPhotoDirCandidates(extra = []) {
  const list = [
    ...(Array.isArray(extra) ? extra : [extra]),
    process.env.PHOTOS_PATH || "",
    "/mnt/fotos",
    // UNC / letras solo tienen sentido en Windows (o si el proceso las proyecta)
    ...(isWin
      ? [
          "F:\\",
          "\\\\Servidor\\e\\FOTOS",
          "\\\\servidor\\e\\FOTOS",
          "\\\\192.168.1.10\\e\\FOTOS",
          "C:\\Users\\ORLANDO\\Pictures\\FOTOS",
        ]
      : []),
    "/fotos",
  ];
  return [...new Set(list.map((p) => String(p || "").trim()).filter(Boolean))];
}

/** URLs del Photo Bridge (PC Windows con acceso al share). */
export function getPhotoBridgeUrls() {
  const list = [
    process.env.PHOTO_BRIDGE_URL || "",
    "http://192.168.1.97:8088",
    "http://127.0.0.1:8088",
    "http://host.docker.internal:8088",
  ];
  return [...new Set(list.map((u) => String(u || "").trim().replace(/\/$/, "")).filter(Boolean))];
}

/**
 * Primer directorio local/montado que exista y tenga al menos 1 archivo.
 * En Linux no intenta UNC (inútil / puede colgar).
 */
export function resolveLocalPhotosDir(extra = []) {
  for (const dir of getPhotoDirCandidates(extra)) {
    try {
      if (!fs.existsSync(dir)) continue;
      const sample = fs.readdirSync(dir);
      if (sample.length > 0) return dir;
    } catch {
      // siguiente
    }
  }
  return null;
}

let photosMapCache = null;
let photosCacheTime = 0;
let photosCacheSource = null;
const PHOTOS_CACHE_TTL_MS = 60_000;
const EMPTY_CACHE_TTL_MS = 5_000;

/**
 * Mapa filename.lower → filename original (SKU-0.jpg, etc.).
 * Fuente: disco local/mount o Photo Bridge HTTP.
 */
export async function getLocalPhotosMap(extraDirs = []) {
  const now = Date.now();
  const ttl = photosMapCache && photosMapCache.size > 0 ? PHOTOS_CACHE_TTL_MS : EMPTY_CACHE_TTL_MS;
  if (photosMapCache && now - photosCacheTime < ttl) {
    return photosMapCache;
  }

  const map = new Map();
  let source = null;

  const localDir = resolveLocalPhotosDir(extraDirs);
  if (localDir) {
    try {
      for (const file of fs.readdirSync(localDir)) {
        const lower = file.toLowerCase();
        if (!map.has(lower)) map.set(lower, file);
      }
      if (map.size > 0) source = `fs:${localDir}`;
    } catch {
      // continuar al bridge
    }
  }

  if (map.size === 0) {
    for (const bridgeUrl of getPhotoBridgeUrls()) {
      try {
        const res = await fetch(`${bridgeUrl}/list`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const data = await res.json();
        const files = Array.isArray(data.files) ? data.files : [];
        for (const file of files) {
          const lower = String(file).toLowerCase();
          if (!map.has(lower)) map.set(lower, file);
        }
        if (map.size > 0) {
          source = `bridge:${bridgeUrl}${data.dir ? `→${data.dir}` : ""}`;
          break;
        }
      } catch {
        // siguiente bridge
      }
    }
  }

  photosMapCache = map;
  photosCacheTime = now;
  photosCacheSource = source;
  if (map.size === 0) {
    console.warn(
      `[photos-fs] 0 fotos. host=${os.hostname()} platform=${process.platform}. ` +
        `En Linux/Docker hace falta /mnt/fotos o Photo Bridge (ahora caído). ` +
        `UNC \\\\Servidor\\e\\FOTOS solo funciona en Windows.`
    );
  } else {
    console.log(`[photos-fs] ${map.size} fotos vía ${source}`);
  }
  return map;
}

export function getPhotosCacheInfo() {
  return {
    size: photosMapCache?.size || 0,
    source: photosCacheSource,
    ageMs: photosMapCache ? Date.now() - photosCacheTime : null,
  };
}

/** Lee un archivo de foto por nombre seguro (local o bridge). */
export async function readPhotoFile(rawFilename, extraDirs = []) {
  const safeFilename = path.basename(rawFilename || "");
  if (!safeFilename) return null;

  for (const baseDir of getPhotoDirCandidates(extraDirs)) {
    try {
      const fullPath = path.join(baseDir, safeFilename);
      if (fs.existsSync(fullPath)) {
        const buffer = await fs.promises.readFile(fullPath);
        return { buffer, source: `fs:${fullPath}` };
      }
    } catch {
      // siguiente
    }
  }

  for (const bridgeUrl of getPhotoBridgeUrls()) {
    try {
      const bridgeRes = await fetch(`${bridgeUrl}/file?name=${encodeURIComponent(safeFilename)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!bridgeRes.ok) continue;
      const arrayBuf = await bridgeRes.arrayBuffer();
      return { buffer: Buffer.from(arrayBuf), source: `bridge:${bridgeUrl}` };
    } catch {
      // siguiente
    }
  }

  return null;
}

export function invalidatePhotosCache() {
  photosMapCache = null;
  photosCacheTime = 0;
  photosCacheSource = null;
}
