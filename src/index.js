import { fetchBestSellingProducts } from './shopify/client.js';
import {
  filterUnpostedProducts,
  recordPostedProduct,
  resetProductHistory,
} from './history/tracker.js';
import { generateStoryImage } from './image/generator.js';
import {
  uploadImageForInstagram,
  cleanupUploadedImage,
} from './image/uploader.js';
import { publishStory } from './instagram/publisher.js';
import { detectFaces } from './image/face-detector.js';
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

    const overrideCount = parseInt(process.env.PUBLISH_COUNT || '0', 10);
    const numProducts =
      overrideCount > 0 ? overrideCount : slot === 'morning' ? 9 : 7;
    logger.info(
      `Plan: ${numProducts} productos${overrideCount > 0 ? ' (override)' : ''}`
    );

    // Preparar productos
    const products = await prepareProducts(config, numProducts);
    logger.info(
      `Productos seleccionados: ${products.map((p) => p.title).join(', ')}`
    );

    // Publicar en secuencia
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      logger.info(`--- Publicando ${i + 1}/${products.length} ---`);

      try {
        await publishProductItem(product, config);
        recordPostedProduct(product);
        successCount++;
      } catch (error) {
        logger.error(`Error publicando ${i + 1}: ${error.message}`);
        failCount++;
      }

      if (i < products.length - 1) {
        logger.info(
          `Esperando ${DELAY_BETWEEN_PUBLISHES_MS}ms antes del siguiente...`
        );
        await sleep(DELAY_BETWEEN_PUBLISHES_MS);
      }
    }

    logger.info(`======================================`);
    logger.info(
      `Batch completado: ${successCount} exitosas, ${failCount} fallidas`
    );
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

async function pickRandomColorImage(product) {
  const groups = product.colorImages || [];
  if (groups.length === 0) {
    return { imageUrl: product.imageUrl, color: null };
  }
  const group = groups[Math.floor(Math.random() * groups.length)];
  const urls = group.imageUrls || [];
  if (urls.length === 0) {
    return { imageUrl: product.imageUrl, color: group.color };
  }

  // Prefer images with a face (model wearing the product)
  const shuffledUrls = shuffle(urls);
  for (const url of shuffledUrls) {
    try {
      const faces = await detectFaces(url);
      if (faces > 0) {
        logger.info(`Imagen con modelo seleccionada (${faces} rostro(s))`);
        return { imageUrl: url, color: group.color };
      }
    } catch {
      // Skip this image on error
    }
  }

  // Fallback: use any random image if none has a face
  logger.info('No se encontro imagen con modelo, usando imagen aleatoria');
  return {
    imageUrl: shuffledUrls[0],
    color: group.color,
  };
}

async function publishProductItem(product, config) {
  const { imageUrl, color } = await pickRandomColorImage(product);
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

main();
