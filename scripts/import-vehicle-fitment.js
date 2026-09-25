#!/usr/bin/env node
/**
 * Importador de catálogo vehicular desde fotos CARROS + fitment por SKU.
 *
 * Uso:
 *   node scripts/import-vehicle-fitment.js scan [--dir PATH]
 *   node scripts/import-vehicle-fitment.js link --excel path.xlsx [--csv out.csv]
 *   node scripts/import-vehicle-fitment.js apply [--sql path]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEFAULT_CARROS =
  process.env.VEHICLE_PHOTOS_DIR ||
  "C:\\Users\\ORLANDO\\Pictures\\FOTOS\\CARROS";
const DEFAULT_SQL = path.join(ROOT, "supabase", "import_vehicle_catalog_from_carros.sql");
const FITMENT_SQL = path.join(ROOT, "supabase", "import_sku_vehicle_fitment.sql");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// ---------------------------------------------------------------------------
// Modelo → marca (Venezuela, autopartes)
// ---------------------------------------------------------------------------
const MODEL_TO_MAKE = {
  "4RUNNER": "TOYOTA",
  ACCENT: "HYUNDAI",
  AVEO: "CHEVROLET",
  ASTRA: "CHEVROLET",
  ACCORD: "HONDA",
  ARAUCA: "CHERY",
  AVALANCHE: "CHEVROLET",
  AVILA: "CHEVROLET",
  AMAROK: "VOLKSWAGEN",
  ALTIMA: "NISSAN",
  ALERO: "CHEVROLET",
  APACHE: "CHEVROLET",
  ASTRA: "CHEVROLET",
  ATOS: "HYUNDAI",
  AVALON: "TOYOTA",
  AVANZA: "TOYOTA",
  BEETLE: "VOLKSWAGEN",
  BLazer: "CHEVROLET",
  BLAZER: "CHEVROLET",
  BOLT: "CHEVROLET",
  BRONCO: "FORD",
  CELICA: "TOYOTA",
  CAMRY: "TOYOTA",
  CAPrice: "CHEVROLET",
  CAPRICE: "CHEVROLET",
  CAPTIVA: "CHEVROLET",
  CAPTUR: "RENAULT",
  CAVALIER: "CHEVROLET",
  CENTURY: "BUICK",
  CIVIC: "HONDA",
  COBALT: "CHEVROLET",
  COLORADO: "CHEVROLET",
  COROLLA: "TOYOTA",
  CORSA: "CHEVROLET",
  CRUZE: "CHEVROLET",
  CRUZ: "CHEVROLET",
  DMAX: "CHEVROLET",
  "D-MAX": "CHEVROLET",
  DUSTER: "RENAULT",
  ECOSPORT: "FORD",
  EDGE: "FORD",
  ESCAPE: "FORD",
  ESCORT: "FORD",
  EXPLORER: "FORD",
  FIESTA: "FORD",
  FOCUS: "FORD",
  FORTE: "KIA",
  FORTWO: "SMART",
  FRONTIER: "NISSAN",
  FUSION: "FORD",
  GALANT: "MITSUBISHI",
  GETZ: "HYUNDAI",
  GOL: "VOLKSWAGEN",
  GRAND: "CHEVROLET",
  GRANDVITARA: "SUZUKI",
  HILUX: "TOYOTA",
  IMPALA: "CHEVROLET",
  JETTA: "VOLKSWAGEN",
  JOURNEY: "DODGE",
  KANGOO: "RENAULT",
  KIA: "KIA",
  LANCER: "MITSUBISHI",
  LAND: "TOYOTA",
  LANDCRUISER: "TOYOTA",
  LOGAN: "RENAULT",
  LUV: "CHEVROLET",
  MALIBU: "CHEVROLET",
  MARCH: "NISSAN",
  MATRIX: "TOYOTA",
  MAZDA: "MAZDA",
  MERIVA: "CHEVROLET",
  MONZA: "CHEVROLET",
  MUSTANG: "FORD",
  NAVARA: "NISSAN",
  NISSAN: "NISSAN",
  OPTRA: "CHEVROLET",
  ORLANDO: "CHEVROLET",
  OUTLANDER: "MITSUBISHI",
  PALIO: "FIAT",
  PARTNER: "PEUGEOT",
  PASSAT: "VOLKSWAGEN",
  PATHFINDER: "NISSAN",
  PATROL: "NISSAN",
  PICANTO: "KIA",
  PILOT: "HONDA",
  PRIMERA: "NISSAN",
  PULSAR: "NISSAN",
  RAV4: "TOYOTA",
  RIO: "KIA",
  S10: "CHEVROLET",
  SAIL: "CHEVROLET",
  SANTA: "HYUNDAI",
  SANTAFE: "HYUNDAI",
  SENTRA: "NISSAN",
  SIERRA: "GMC",
  SIENNA: "TOYOTA",
  SILVERADO: "CHEVROLET",
  SONIC: "CHEVROLET",
  SPARK: "CHEVROLET",
  SPORTAGE: "KIA",
  SUBURBAN: "CHEVROLET",
  SWIFT: "SUZUKI",
  TAHOE: "CHEVROLET",
  TERRAIN: "GMC",
  TIIDA: "NISSAN",
  TIGGO: "CHERY",
  TIGUAN: "VOLKSWAGEN",
  TOPIC: "NISSAN",
  TRAILBLAZER: "CHEVROLET",
  TRAVERSE: "CHEVROLET",
  TUCSON: "HYUNDAI",
  UNO: "FIAT",
  URVAN: "NISSAN",
  VERSA: "NISSAN",
  VITARA: "SUZUKI",
  VOYAGER: "CHRYSLER",
  WRANGLER: "JEEP",
  XTRAIL: "NISSAN",
  YARIS: "TOYOTA",
  ZAFIRA: "CHEVROLET",
  ZX: "CHERY",
};

const SKIP_PATTERNS = [
  /^[A-Z]$/i,
  /^\d+[Xx]-?\d*$/,
  /^706027/i,
  /^(FONDO|LOGO|MARCA|PLANTILLA)/i,
];

const REAR_VIEW_SUFFIX = /\b(ATRAS|TRASERA|POSTERIOR|BACK)\b/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normKeyPart(s) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function buildSearchKey(make, model, yearFrom) {
  return [normKeyPart(make), normKeyPart(model), normKeyPart(yearFrom)].join("|");
}

function sqlEscape(val) {
  if (val == null) return "NULL";
  return `'${String(val).replace(/'/g, "''")}'`;
}

function expandYear(y) {
  const n = parseInt(y, 10);
  if (Number.isNaN(n)) return null;
  if (n >= 100) return n;
  if (n >= 0 && n <= 30) return 2000 + n;
  return 1900 + n;
}

function parseYearRange(text) {
  const m4 = text.match(/(\d{4})\s*[-–]\s*(\d{4})/);
  if (m4) return { yearFrom: parseInt(m4[1], 10), yearTo: parseInt(m4[2], 10) };

  const m2 = text.match(/(\d{2})\s*[-–]\s*(\d{2})/);
  if (m2) {
    const yf = expandYear(m2[1]);
    const yt = expandYear(m2[2]);
    if (yf && yt) return { yearFrom: yf, yearTo: yt };
  }

  const single = text.match(/\b(19\d{2}|20\d{2})\b/);
  if (single) {
    const y = parseInt(single[1], 10);
    return { yearFrom: y, yearTo: y };
  }

  return null;
}

function inferMakeFromModel(model) {
  const key = normKeyPart(model).replace(/_/g, "");
  for (const [modelName, make] of Object.entries(MODEL_TO_MAKE)) {
    if (key === normKeyPart(modelName).replace(/_/g, "")) return make;
  }
  for (const [modelName, make] of Object.entries(MODEL_TO_MAKE)) {
    const mk = normKeyPart(modelName).replace(/_/g, "");
    if (key.startsWith(mk) || mk.startsWith(key)) return make;
  }
  return null;
}

function shouldSkipBaseName(base) {
  if (!base || base.length < 2) return true;
  for (const re of SKIP_PATTERNS) {
    if (re.test(base)) return true;
  }
  return false;
}

function parseFilename(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext).trim();
  if (shouldSkipBaseName(base)) return { skip: true, reason: "patrón excluido", base };

  const isRear = REAR_VIEW_SUFFIX.test(base);

  // Pattern: 1968-ford-mustang
  const kebab = base.match(/^(\d{4})[-_\s]+([a-zA-Z]+)[-_\s]+(.+)$/i);
  if (kebab && parseInt(kebab[1], 10) >= 1900) {
    const year = parseInt(kebab[1], 10);
    const make = kebab[2].toUpperCase();
    const model = kebab[3].replace(/[-_]/g, " ").trim().toUpperCase();
    return {
      skip: false,
      make,
      model,
      yearFrom: year,
      yearTo: year,
      variant: isRear ? "ATRAS" : null,
      photoLocalPath: filename,
      searchKey: buildSearchKey(make, model, year),
    };
  }

  const years = parseYearRange(base);
  if (!years) return { skip: true, reason: "sin años", base };

  const withoutYears = base.replace(/(\d{4}|\d{2})\s*[-–]\s*(\d{4}|\d{2})/, "").trim();
  const tokens = withoutYears.split(/\s+/).filter(Boolean);
  if (!tokens.length) return { skip: true, reason: "sin modelo", base };

  const modelToken = tokens[0].toUpperCase();
  let make = inferMakeFromModel(modelToken);
  let model = modelToken;

  // Multi-word models: GRAND VITARA, LAND CRUISER, SANTA FE
  if (tokens.length >= 2) {
    const two = `${tokens[0]} ${tokens[1]}`.toUpperCase();
    const make2 = inferMakeFromModel(two.replace(/\s+/g, ""));
    if (make2) {
      model = two;
      make = make2;
    } else if (!make && inferMakeFromModel(tokens[1])) {
      model = `${tokens[0]} ${tokens[1]}`.toUpperCase();
      make = inferMakeFromModel(tokens[1]) || inferMakeFromModel(model.replace(/\s+/g, ""));
    }
  }

  if (!make) make = "DESCONOCIDO";

  const modelNorm = normKeyPart(model).replace(/_/g, "");
  const usedTokens = model.split(/\s+/).length;
  let variantParts = tokens.slice(usedTokens);
  if (isRear && !variantParts.some((t) => REAR_VIEW_SUFFIX.test(t))) {
    variantParts.push("ATRAS");
  }
  const variant = variantParts.length ? variantParts.join(" ").toUpperCase() : null;

  return {
    skip: false,
    make,
    model,
    yearFrom: years.yearFrom,
    yearTo: years.yearTo,
    variant,
    photoLocalPath: filename,
    searchKey: buildSearchKey(make, model, years.yearFrom),
    modelNorm,
  };
}

function listImageFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && IMAGE_EXT.has(path.extname(d.name).toLowerCase()))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "es"));
}

function generateCatalogSql(records) {
  const lines = [
    "-- Generado por scripts/import-vehicle-fitment.js",
    `-- Fecha: ${new Date().toISOString()}`,
    `-- Registros: ${records.length}`,
    "",
    "INSERT INTO public.vehicle_catalog (make, model, year_from, year_to, variant, photo_local_path, search_key)",
    "VALUES",
  ];

  const values = records.map((r) => {
    const variant = r.variant ? sqlEscape(r.variant) : "NULL";
    return `    (${sqlEscape(r.make)}, ${sqlEscape(r.model)}, ${r.yearFrom}, ${r.yearTo}, ${variant}, ${sqlEscape(r.photoLocalPath)}, ${sqlEscape(r.searchKey)})`;
  });

  lines.push(values.join(",\n"));
  lines.push(
    "ON CONFLICT (search_key) DO UPDATE SET",
    "    make = EXCLUDED.make,",
    "    model = EXCLUDED.model,",
    "    year_from = EXCLUDED.year_from,",
    "    year_to = EXCLUDED.year_to,",
    "    variant = EXCLUDED.variant,",
    "    photo_local_path = EXCLUDED.photo_local_path,",
    "    updated_at = now();",
    ""
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------
function cmdScan(args) {
  let dir = DEFAULT_CARROS;
  let outFile = DEFAULT_SQL;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && args[i + 1]) dir = args[++i];
    if (args[i] === "--out" && args[i + 1]) outFile = args[++i];
  }

  if (!fs.existsSync(dir)) {
    console.error(`❌ Carpeta no encontrada: ${dir}`);
    process.exit(1);
  }

  const files = listImageFiles(dir);
  const parsed = [];
  const skipped = [];
  const seenKeys = new Map();

  for (const file of files) {
    const result = parseFilename(file);
    if (result.skip) {
      skipped.push({ file, reason: result.reason || "omitido" });
      continue;
    }
    if (seenKeys.has(result.searchKey)) {
      skipped.push({ file, reason: `duplicado search_key ${result.searchKey}` });
      continue;
    }
    seenKeys.set(result.searchKey, file);
    parsed.push(result);
  }

  const sql = generateCatalogSql(parsed);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, sql, "utf8");

  const report = {
    dir,
    totalFiles: files.length,
    imported: parsed.length,
    skipped: skipped.length,
    sqlFile: outFile,
    unknownMake: parsed.filter((r) => r.make === "DESCONOCIDO").length,
  };

  fs.writeFileSync(
    path.join(ROOT, "supabase", "import_vehicle_catalog_report.json"),
    JSON.stringify({ ...report, skippedSample: skipped.slice(0, 30) }, null, 2),
    "utf8"
  );

  console.log("📸 Escaneo CARROS completado");
  console.log(`   Carpeta:     ${dir}`);
  console.log(`   Archivos:    ${report.totalFiles}`);
  console.log(`   Importables: ${report.imported}`);
  console.log(`   Omitidos:    ${report.skipped}`);
  console.log(`   Sin marca:   ${report.unknownMake}`);
  console.log(`   SQL:         ${outFile}`);
  return report;
}

// ---------------------------------------------------------------------------
// Link (SKU fitment desde Excel/CSV)
// ---------------------------------------------------------------------------
const MAKE_ALIASES = {
  TOYOTA: "TOYOTA",
  TY: "TOYOTA",
  HYUNDAI: "HYUNDAI",
  HY: "HYUNDAI",
  CHEVROLET: "CHEVROLET",
  CHEVY: "CHEVROLET",
  GM: "CHEVROLET",
  FORD: "FORD",
  HONDA: "HONDA",
  NISSAN: "NISSAN",
  KIA: "KIA",
  MAZDA: "MAZDA",
  MITSUBISHI: "MITSUBISHI",
  MITSU: "MITSUBISHI",
  JEEP: "JEEP",
  RENAULT: "RENAULT",
  FIAT: "FIAT",
  VW: "VOLKSWAGEN",
  VOLKSWAGEN: "VOLKSWAGEN",
  CHERY: "CHERY",
};

function extractVehicleHints(text) {
  if (!text) return [];
  const upper = String(text).toUpperCase();
  const hints = [];

  const re = new RegExp(
    `(?:${Object.keys(MAKE_ALIASES).join("|")})\\s+[A-Z0-9][A-Z0-9\\s./-]{1,30}?(?:\\s+(?:19|20)\\d{2}(?:\\s*[-–]\\s*(?:19|20)?\\d{2})?)?`,
    "gi"
  );

  let m;
  while ((m = re.exec(upper)) !== null) {
    hints.push(m[0].trim());
  }

  if (!hints.length) {
    for (const model of Object.keys(MODEL_TO_MAKE)) {
      const mr = new RegExp(`\\b${model.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
      if (mr.test(upper)) {
        const yr = parseYearRange(upper);
        hints.push(`${MODEL_TO_MAKE[model]} ${model}${yr ? ` ${yr.yearFrom}` : ""}`);
      }
    }
  }

  return [...new Set(hints)];
}

function hintToMatch(hint, catalogIndex) {
  const upper = hint.toUpperCase();
  let make = null;
  for (const alias of Object.keys(MAKE_ALIASES).sort((a, b) => b.length - a.length)) {
    if (upper.startsWith(alias + " ") || upper.includes(" " + alias + " ")) {
      make = MAKE_ALIASES[alias];
      break;
    }
  }
  if (!make) {
    const first = upper.split(/\s+/)[0];
    make = MAKE_ALIASES[first] || null;
  }

  const years = parseYearRange(upper);
  const year = years?.yearFrom;

  let model = null;
  if (make) {
    const afterMake = upper.replace(new RegExp(`\\b${make}\\b`, "i"), "").trim();
    const modelMatch = afterMake.match(/^([A-Z0-9][A-Z0-9\s./-]{0,25}?)(?:\s+(?:19|20)\d{2}|\s*$)/);
    if (modelMatch) model = modelMatch[1].trim().split(/\s+/).slice(0, 2).join(" ");
  }

  if (!model) {
    for (const mn of Object.keys(MODEL_TO_MAKE)) {
      if (upper.includes(mn)) {
        model = mn;
        make = make || MODEL_TO_MAKE[mn];
        break;
      }
    }
  }

  if (!make || !model) return null;

  const key = buildSearchKey(make, model, year || "");
  if (year && catalogIndex.has(key)) return catalogIndex.get(key);

  const prefix = `${normKeyPart(make)}|${normKeyPart(model)}|`;
  for (const [k, row] of catalogIndex.entries()) {
    if (k.startsWith(prefix)) {
      if (!year) return row;
      const rowYear = parseInt(k.split("|")[2], 10);
      if (years && rowYear >= years.yearFrom && rowYear <= years.yearTo) return row;
      if (years && years.yearFrom >= row.year_from && years.yearFrom <= row.year_to) return row;
    }
  }
  return null;
}

function loadCatalogFromSql(sqlPath) {
  const index = new Map();
  if (!fs.existsSync(sqlPath)) return index;
  const content = fs.readFileSync(sqlPath, "utf8");
  const rowRe = /\('([^']*)',\s*'([^']*)',\s*(\d+),\s*(\d+),\s*(?:NULL|'([^']*)'),\s*'([^']*)',\s*'([^']*)'\)/g;
  let m;
  while ((m = rowRe.exec(content)) !== null) {
    index.set(m[7], {
      make: m[1],
      model: m[2],
      year_from: parseInt(m[3], 10),
      year_to: parseInt(m[4], 10),
      variant: m[5] || null,
      photo_local_path: m[6],
      search_key: m[7],
    });
  }
  return index;
}

async function readExcelRows(excelPath) {
  const XLSX = require("xlsx");
  const wb = XLSX.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function readCsvRows(csvPath) {
  const XLSX = require("xlsx");
  const wb = XLSX.readFile(csvPath, { type: "file" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function findSkuColumn(row) {
  const keys = Object.keys(row);
  for (const k of keys) {
    const lk = k.toLowerCase();
    if (lk === "sku" || lk.includes("codigo") || lk.includes("código") || lk === "referencia") return k;
  }
  return keys[0];
}

function findTitleColumn(row) {
  const keys = Object.keys(row);
  for (const k of keys) {
    const lk = k.toLowerCase();
    if (lk.includes("titulo") || lk.includes("título") || lk.includes("descripcion") || lk.includes("descripción") || lk === "title" || lk === "nombre") return k;
  }
  return keys[1] || keys[0];
}

async function cmdLink(args) {
  let excelPath = null;
  let csvPath = null;
  let catalogSql = DEFAULT_SQL;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--excel" && args[i + 1]) excelPath = args[++i];
    if (args[i] === "--csv" && args[i + 1]) csvPath = args[++i];
    if (args[i] === "--catalog-sql" && args[i + 1]) catalogSql = args[++i];
  }

  if (!excelPath && !csvPath) {
    console.error("❌ Usa --excel path.xlsx o --csv path.csv");
    process.exit(1);
  }

  const inputPath = excelPath || csvPath;
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Archivo no encontrado: ${inputPath}`);
    process.exit(1);
  }

  const catalogIndex = loadCatalogFromSql(catalogSql);
  if (!catalogIndex.size) {
    console.warn("⚠️ Catálogo SQL vacío. Ejecuta 'scan' primero.");
  }

  const rows = excelPath ? await readExcelRows(excelPath) : readCsvRows(csvPath);
  const links = [];
  const unmatched = [];

  for (const row of rows) {
    const skuKey = findSkuColumn(row);
    const titleKey = findTitleColumn(row);
    const sku = String(row[skuKey] || "").trim();
    const title = String(row[titleKey] || "").trim();
    if (!sku) continue;

    const hints = extractVehicleHints(title);
    if (!hints.length) {
      unmatched.push({ sku, title, reason: "sin pista vehicular" });
      continue;
    }

    let matched = null;
    for (const hint of hints) {
      matched = hintToMatch(hint, catalogIndex);
      if (matched) break;
    }

    if (matched) {
      links.push({ sku, search_key: matched.search_key, source: "profit_import" });
    } else {
      unmatched.push({ sku, title, hints });
    }
  }

  const lines = [
    "-- Generado por scripts/import-vehicle-fitment.js (link)",
    `-- Fecha: ${new Date().toISOString()}`,
    `-- Vínculos: ${links.length}`,
    "",
    "INSERT INTO public.sku_vehicle_fitment (sku, vehicle_id, source)",
    "SELECT v.sku, c.id, v.source",
    "FROM (VALUES",
  ];

  const valueLines = links.map(
    (l) => `    (${sqlEscape(l.sku)}, ${sqlEscape(l.search_key)}, ${sqlEscape(l.source)})`
  );
  if (!valueLines.length) valueLines.push("    ('__NONE__', '__NONE__', 'manual')");

  lines.push(valueLines.join(",\n"));
  lines.push(
    ") AS v(sku, search_key, source)",
    "JOIN public.vehicle_catalog c ON c.search_key = v.search_key",
    "WHERE v.sku <> '__NONE__'",
    "ON CONFLICT (sku, vehicle_id) DO NOTHING;",
    ""
  );

  fs.writeFileSync(FITMENT_SQL, lines.join("\n"), "utf8");
  fs.writeFileSync(
    path.join(ROOT, "supabase", "import_fitment_report.json"),
    JSON.stringify({ links: links.length, unmatched: unmatched.length, unmatchedSample: unmatched.slice(0, 50) }, null, 2),
    "utf8"
  );

  console.log("🔗 Link fitment completado");
  console.log(`   Filas Excel:  ${rows.length}`);
  console.log(`   Vínculos:     ${links.length}`);
  console.log(`   Sin match:    ${unmatched.length}`);
  console.log(`   SQL:          ${FITMENT_SQL}`);
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------
async function cmdApply(args) {
  require("dotenv").config({ path: path.join(ROOT, ".env.local") });
  require("dotenv").config({ path: path.join(ROOT, ".env") });

  let sqlPath = DEFAULT_SQL;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sql" && args[i + 1]) sqlPath = args[++i];
  }

  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ SQL no encontrado: ${sqlPath}. Ejecuta 'scan' primero.`);
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.log("ℹ️ SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados.");
    console.log("   Ejecuta el SQL manualmente en Supabase → SQL Editor:");
    console.log(`   ${sqlPath}`);
    if (fs.existsSync(FITMENT_SQL)) console.log(`   ${FITMENT_SQL}`);
    return;
  }

  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, key);

  const catalogRecords = [];
  const content = fs.readFileSync(sqlPath, "utf8");
  const rowRe = /\('([^']*)',\s*'([^']*)',\s*(\d+),\s*(\d+),\s*(?:NULL|'([^']*)'),\s*'([^']*)',\s*'([^']*)'\)/g;
  let m;
  while ((m = rowRe.exec(content)) !== null) {
    catalogRecords.push({
      make: m[1],
      model: m[2],
      year_from: parseInt(m[3], 10),
      year_to: parseInt(m[4], 10),
      variant: m[5] || null,
      photo_local_path: m[6],
      search_key: m[7],
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`📤 Upserting ${catalogRecords.length} vehículos...`);
  const BATCH = 100;
  let upserted = 0;
  for (let i = 0; i < catalogRecords.length; i += BATCH) {
    const batch = catalogRecords.slice(i, i + BATCH);
    const { error } = await supabase.from("vehicle_catalog").upsert(batch, { onConflict: "search_key" });
    if (error) {
      console.error("❌ Error upsert vehicle_catalog:", error.message);
      process.exit(1);
    }
    upserted += batch.length;
    process.stdout.write(`   ${upserted}/${catalogRecords.length}\r`);
  }
  console.log(`\n✅ vehicle_catalog: ${upserted} registros`);

  if (fs.existsSync(FITMENT_SQL)) {
    const fitSql = fs.readFileSync(FITMENT_SQL, "utf8");
    const { Client } = require("pg");
    const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (dbUrl) {
      const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await client.connect();
      await client.query(fitSql);
      await client.end();
      console.log(`✅ sku_vehicle_fitment aplicado desde ${FITMENT_SQL}`);
    } else {
      console.log(`ℹ️ Ejecuta manualmente fitment SQL: ${FITMENT_SQL}`);
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function printHelp() {
  console.log(`
Importador de fitment vehicular

Comandos:
  scan [--dir PATH] [--out SQL]   Escanea CARROS y genera SQL catálogo
  link --excel FILE              Extrae fitment desde Excel Profit
  link --csv FILE                 Extrae fitment desde CSV
  apply [--sql PATH]              Upsert a Supabase (requiere .env.local)

Variables:
  VEHICLE_PHOTOS_DIR              Ruta a carpeta CARROS

Ejemplos:
  npm run import:fitment -- scan
  npm run import:fitment -- link --excel listado_marcas_profit.xlsx
  npm run import:fitment -- apply
`);
}

async function main() {
  const [,, cmd, ...args] = process.argv;

  switch (cmd) {
    case "scan":
      cmdScan(args);
      break;
    case "link":
      await cmdLink(args);
      break;
    case "apply":
      await cmdApply(args);
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      if (!cmd) printHelp();
      else {
        console.error(`Comando desconocido: ${cmd}`);
        printHelp();
        process.exit(1);
      }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
