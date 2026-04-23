import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), '.erp_settings.json');

export function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error leyendo settings:", e.message);
  }
  return {
    photosPath: '',
    defaultMargin: 30,
    categoryMap: {} // { "SUBLINEA_PROFIT": "ML_CATEGORY_ID" }
  };
}

export function saveSettings(settings) {
  try {
    const current = getSettings();
    const newData = { ...current, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newData, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
