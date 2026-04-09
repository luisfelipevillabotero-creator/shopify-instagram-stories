import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REELS_CONFIG_FILE = path.resolve(__dirname, '../../data/reels-config.json');
const REELS_MAP_FILE = path.resolve(__dirname, '../../data/reels-map.json');
const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

export function loadReelsConfig() {
  const raw = fs.readFileSync(REELS_CONFIG_FILE, 'utf-8');
  return JSON.parse(raw);
}

export function loadReelsMap() {
  if (!fs.existsSync(REELS_MAP_FILE)) {
    return {};
  }
  const raw = fs.readFileSync(REELS_MAP_FILE, 'utf-8');
  return JSON.parse(raw);
}

export function saveReelsMap(map) {
  const dir = path.dirname(REELS_MAP_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(REELS_MAP_FILE, JSON.stringify(map, null, 2));
}

function extractShortcode(permalink) {
  if (!permalink) return null;
  const match = permalink.match(/\/(?:reel|p)\/([^/?]+)/);
  return match ? match[1] : null;
}

export async function resolveMissingShortcodes(config, shortcodes) {
  const existingMap = loadReelsMap();
  const missing = shortcodes.filter((sc) => !existingMap[sc]);

  if (missing.length === 0) {
    logger.info('Todos los shortcodes ya estan mapeados en cache');
    return existingMap;
  }

  logger.info(
    `Resolviendo ${missing.length} shortcodes faltantes paginando /media...`
  );

  const fields = 'id,media_type,media_product_type,permalink,timestamp';
  let nextUrl = `${GRAPH_API_BASE}/${config.instagramUserId}/media?fields=${fields}&limit=100&access_token=${config.instagramAccessToken}`;

  const missingSet = new Set(missing);
  const updatedMap = { ...existingMap };
  let pagesFetched = 0;
  const MAX_PAGES = 20;

  while (nextUrl && missingSet.size > 0 && pagesFetched < MAX_PAGES) {
    pagesFetched++;
    const response = await fetch(nextUrl);
    const data = await response.json();

    if (data.error) {
      logger.error(
        `Error paginando media: ${JSON.stringify(data.error)}`
      );
      break;
    }

    const items = data.data || [];
    logger.info(
      `Pagina ${pagesFetched}: ${items.length} items, faltan ${missingSet.size} shortcodes`
    );

    for (const item of items) {
      const shortcode = extractShortcode(item.permalink);
      if (shortcode && missingSet.has(shortcode)) {
        updatedMap[shortcode] = item.id;
        missingSet.delete(shortcode);
        logger.info(`Mapeado: ${shortcode} -> ${item.id}`);
      }
    }

    nextUrl = data.paging?.next || null;
  }

  saveReelsMap(updatedMap);

  if (missingSet.size > 0) {
    logger.info(
      `No se pudieron resolver ${missingSet.size} shortcodes: ${[...missingSet].join(', ')}`
    );
  } else {
    logger.info('Todos los shortcodes resueltos exitosamente');
  }

  return updatedMap;
}

export async function getFreshMediaUrl(mediaId, config) {
  const url = `${GRAPH_API_BASE}/${mediaId}?fields=media_url,media_type,permalink&access_token=${config.instagramAccessToken}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(
      `Error obteniendo media_url de ${mediaId}: ${JSON.stringify(data.error)}`
    );
  }

  if (!data.media_url) {
    throw new Error(`El media ${mediaId} no tiene media_url disponible`);
  }

  return {
    mediaUrl: data.media_url,
    mediaType: data.media_type,
    permalink: data.permalink,
  };
}

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickMorningReels(reelsConfig, reelsMap, excludeShortcodes = []) {
  const { mandatory, pool } = reelsConfig;
  const excludeSet = new Set(excludeShortcodes);

  const mandatoryItem = reelsMap[mandatory]
    ? { shortcode: mandatory, mediaId: reelsMap[mandatory], mandatory: true }
    : null;

  if (!mandatoryItem) {
    logger.error(
      `Reel obligatorio ${mandatory} no esta en el mapping, se va a omitir`
    );
  }

  const availablePool = pool.filter(
    (sc) => reelsMap[sc] && !excludeSet.has(sc) && sc !== mandatory
  );

  const shuffled = shuffleArray(availablePool);
  const randomReels = shuffled.slice(0, 3).map((sc) => ({
    shortcode: sc,
    mediaId: reelsMap[sc],
    mandatory: false,
  }));

  const result = [];
  if (mandatoryItem) result.push(mandatoryItem);
  result.push(...randomReels);
  return result;
}

export function pickEveningReels(
  reelsConfig,
  reelsMap,
  excludeShortcodes = []
) {
  const { mandatory, pool } = reelsConfig;
  const excludeSet = new Set(excludeShortcodes);

  const availablePool = pool.filter(
    (sc) => reelsMap[sc] && !excludeSet.has(sc) && sc !== mandatory
  );

  const shuffled = shuffleArray(availablePool);
  return shuffled.slice(0, 3).map((sc) => ({
    shortcode: sc,
    mediaId: reelsMap[sc],
    mandatory: false,
  }));
}

export function pickExtraRandomReel(reelsConfig, reelsMap, excludeShortcodes = []) {
  const { mandatory, pool } = reelsConfig;
  const excludeSet = new Set(excludeShortcodes);

  const availablePool = pool.filter(
    (sc) => reelsMap[sc] && !excludeSet.has(sc) && sc !== mandatory
  );

  if (availablePool.length === 0) return null;

  const shuffled = shuffleArray(availablePool);
  const sc = shuffled[0];
  return {
    shortcode: sc,
    mediaId: reelsMap[sc],
    mandatory: false,
  };
}
