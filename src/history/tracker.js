import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.resolve(__dirname, '../../data/posted-history.json');
const MAX_HISTORY_ENTRIES = 500;

function readHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return { postedProducts: [], postedReels: [] };
  }
  const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed.postedProducts) parsed.postedProducts = [];
  if (!parsed.postedReels) parsed.postedReels = [];
  return parsed;
}

function writeHistory(history) {
  if (history.postedProducts.length > MAX_HISTORY_ENTRIES) {
    history.postedProducts = history.postedProducts.slice(-MAX_HISTORY_ENTRIES);
  }
  if (history.postedReels.length > MAX_HISTORY_ENTRIES) {
    history.postedReels = history.postedReels.slice(-MAX_HISTORY_ENTRIES);
  }

  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

export function filterUnpostedProducts(products) {
  const history = readHistory();
  const postedIds = new Set(history.postedProducts.map((p) => p.id));
  return products.filter((product) => !postedIds.has(product.id));
}

export function recordPostedProduct(product) {
  const history = readHistory();
  history.postedProducts.push({
    id: product.id,
    title: product.title,
    postedAt: new Date().toISOString(),
  });
  writeHistory(history);
}

export function resetProductHistory() {
  const history = readHistory();
  history.postedProducts = [];
  writeHistory(history);
}

export function recordPostedReel(reel) {
  const history = readHistory();
  history.postedReels.push({
    shortcode: reel.shortcode,
    mediaId: reel.mediaId,
    mandatory: !!reel.mandatory,
    postedAt: new Date().toISOString(),
  });
  writeHistory(history);
}

export function getReelsPostedToday() {
  const history = readHistory();
  const now = new Date();
  const bogotaOffsetMs = 5 * 60 * 60 * 1000;
  const bogotaNow = new Date(now.getTime() - bogotaOffsetMs);
  const todayKey = bogotaNow.toISOString().slice(0, 10);

  return history.postedReels.filter((r) => {
    const postedAt = new Date(r.postedAt);
    const postedBogota = new Date(postedAt.getTime() - bogotaOffsetMs);
    return postedBogota.toISOString().slice(0, 10) === todayKey;
  });
}
