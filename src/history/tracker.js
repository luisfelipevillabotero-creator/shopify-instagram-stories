import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.resolve(__dirname, '../../data/posted-history.json');
const MAX_HISTORY_ENTRIES = 200;

function readHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return { postedProducts: [] };
  }
  const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeHistory(history) {
  if (history.postedProducts.length > MAX_HISTORY_ENTRIES) {
    history.postedProducts = history.postedProducts.slice(-MAX_HISTORY_ENTRIES);
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
