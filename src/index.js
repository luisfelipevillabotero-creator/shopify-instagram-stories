import { fetchBestSellingProducts } from './shopify/client.js';
import {
  filterUnpostedProducts,
  recordPostedProduct,
  resetProductHistory,
  recordPostedReel,
  getReelsPostedToday,
} from './history/tracker.js';
import { generateStoryImage } from './image/generator.js';
import {
  uploadImageForInstagram,
  cleanupUploadedImage,
} from './image/uploader.js';
import { publishStory, publishVideoStory } from './instagram/publisher.js';
import {
  loadReelsConfig,
  loadReelsMap,
  resolveMissingShortcodes,
  getFreshMediaUrl,
  pickMorningReels,
  pickEveningReels,
  pickExtraRandomReel,
} from './instagram/reels.js';
import { logger } from './utils/logger.js';
import { loadConfig } from './utils/config.js';

const DELAY_BETWEEN_PUBLISHES_MS = 5000;

function detectSlot() {
  if (process.env.SLOT === 'morning' || process.env.SLOT === 'evening') {
    return process.env.SLOT;
  }
  const utcHour = new Date().getUTCHours();
  const cotHour = (utcHour - 5 + 24) % 24;
  if (cotHour >= 6 && cotHour < 14) return 'morning';
  return 'evening';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function main() {
  try {
    const config = loadConfig();
    const slot = detectSlot();
    logger.info(`======================================`);
    logger.info(`Turno detectado: ${slot.toUpperCase()}`);
    logger.info(`======================================`);

    // Verificar cuenta de Instagram
    const igResponse = await fetch(
      `https://graph.facebook.com/v19.0/${config.instagramUserId}?fields=username,name&access_token=${config.instagramAccessToken}`
    );
    const igData = await igResponse.json();
    logger.info(
      `Cuenta de Instagram: @${igData.username} (${igData.name || 'sin nombre'})`
    );

    const numProducts = slot === 'morning' ? 5 : 4;
    const numReels = slot === 'morning' ? 4 : 3;
    logger.info(
      `Plan: ${numProducts} productos + ${numReels} reels = ${numProducts + numReels} items`
    );

    // 1. Preparar reels: resolver mapping si hace falta
    const reelsConfig = loadReelsConfig();
    const allShortcodes = [reelsConfig.mandatory, ...reelsConfig.pool];
    await resolveMissingShortcodes(config, allShortcodes);
    const reelsMap = loadReelsMap();
    logger.info(
      `Reels resueltos en mapping: ${Object.keys(reelsMap).length}/${allShortcodes.length}`
    );

    // 2. Preparar productos
    const products = await prepareProducts(config, numProducts);
    logger.info(
      `Productos seleccionados: ${products.map((p) => p.title).join(', ')}`
    );

    // 3. Preparar reels
    const reelsToday = getReelsPostedToday();
    const excludeShortcodes = reelsToday.map((r) => r.shortcode);
    logger.info(
      `Reels ya publicados hoy: ${excludeShortcodes.length > 0 ? excludeShortcodes.join(', ') : 'ninguno'}`
    );

    let reels;
    if (slot === 'morning') {
      reels = pickMorningReels(reelsConfig, reelsMap, excludeShortcodes);
    } else {
      reels = pickEveningReels(reelsConfig, reelsMap, excludeShortcodes);
    }
    logger.info(
      `Reels seleccionados: ${reels.map((r) => r.shortcode + (r.mandatory ? '(OBLIGATORIO)' : '')).join(', ')}`
    );

    // 4. Construir batch mezclado aleatoriamente
    const items = [
      ...products.map((p) => ({ type: 'product', data: p })),
      ...reels.map((r) => ({ type: 'reel', data: r })),
    ];
    const batch = shuffle(items);
    logger.info(`Orden del batch: ${batch.map((i) => i.type).join(' -> ')}`);

    // 5. Publicar en secuencia
    let successCount = 0;
    let failCount = 0;
    const excludeForReplacement = [...excludeShortcodes];
    for (const reel of reels) excludeForReplacement.push(reel.shortcode);

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      logger.info(
        `--- Publicando item ${i + 1}/${batch.length} (${item.type}) ---`
      );

      try {
        if (item.type === 'product') {
          await publishProductItem(item.data, config);
          recordPostedProduct(item.data);
          successCount++;
        } else {
          await publishReelItem(item.data, config);
          recordPostedReel(item.data);
          excludeForReplacement.push(item.data.shortcode);
          successCount++;
        }
      } catch (error) {
        logger.error(`Error publicando item ${i + 1}: ${error.message}`);
        failCount++;

        if (item.type === 'reel' && !item.data.mandatory) {
          logger.info('Intentando reemplazar reel fallido con otro aleatorio...');
          const replacement = pickExtraRandomReel(
            reelsConfig,
            reelsMap,
            excludeForReplacement
          );
          if (replacement) {
            try {
              await publishReelItem(replacement, config);
              recordPostedReel(replacement);
              excludeForReplacement.push(replacement.shortcode);
              successCount++;
              failCount--;
              logger.info(
                `Reel reemplazado exitosamente con ${replacement.shortcode}`
              );
            } catch (replaceError) {
              logger.error(
                `El reemplazo tambien fallo: ${replaceError.message}`
              );
            }
          }
        }
      }

      if (i < batch.length - 1) {
        logger.info(`Esperando ${DELAY_BETWEEN_PUBLISHES_MS}ms antes del siguiente...`);
        await sleep(DELAY_BETWEEN_PUBLISHES_MS);
      }
    }

    logger.info(`======================================`);
    logger.info(`Batch completado: ${successCount} exitosas, ${failCount} fallidas`);
    logger.info(`======================================`);
  } catch (error) {
    logger.error('El pipeline fallo:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

async function prepareProducts(config, needed) {
  logger.info('Obteniendo productos de Shopify...');
  const allProducts = await fetchBestSellingProducts(config, { first: 250 });
  logger.info(`Total productos en la coleccion: ${allProducts.length}`);

  let unposted = filterUnpostedProducts(allProducts);
  logger.info(`Productos sin publicar disponibles: ${unposted.length}`);

  if (unposted.length < needed) {
    logger.info(
      `No hay suficientes productos nuevos (${unposted.length}/${needed}). Reseteando historial de productos.`
    );
    resetProductHistory();
    unposted = allProducts;
  }

  const shuffled = shuffle(unposted);
  return shuffled.slice(0, needed);
}

function pickRandomColorImage(product) {
  const groups = product.colorImages || [];
  if (groups.length === 0) {
    return { imageUrl: product.imageUrl, color: null };
  }
  const group = groups[Math.floor(Math.random() * groups.length)];
  const urls = group.imageUrls || [];
  if (urls.length === 0) {
    return { imageUrl: product.imageUrl, color: group.color };
  }
  return {
    imageUrl: urls[Math.floor(Math.random() * urls.length)],
    color: group.color,
  };
}

async function publishProductItem(product, config) {
  const { imageUrl, color } = pickRandomColorImage(product);
  logger.info(
    `Producto: ${product.title}${color ? ` - Color: ${color}` : ''}`
  );
  logger.info(`URL: ${product.url}`);

  const productForImage = { ...product, imageUrl };
  const localImagePath = await generateStoryImage(productForImage);
  logger.info(`Imagen generada: ${localImagePath}`);

  const publicUrl = await uploadImageForInstagram(localImagePath);
  logger.info(`Imagen subida a: ${publicUrl}`);

  const result = await publishStory(publicUrl, product.url, config);
  logger.info(`Producto publicado! Media ID: ${result.id}`);

  await cleanupUploadedImage(publicUrl);
}

async function publishReelItem(reel, config) {
  logger.info(
    `Reel: ${reel.shortcode}${reel.mandatory ? ' (OBLIGATORIO)' : ''} - mediaId: ${reel.mediaId}`
  );

  const { mediaUrl } = await getFreshMediaUrl(reel.mediaId, config);
  logger.info(`Media URL obtenida`);

  const result = await publishVideoStory(mediaUrl, config);
  logger.info(`Reel republicado! Media ID: ${result.id}`);
}

main();
