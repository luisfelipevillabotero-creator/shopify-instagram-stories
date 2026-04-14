import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchBestSellingProducts } from './shopify/client.js';
import {
  filterUnpostedProducts,
  recordPostedProduct,
  resetProductHistory,
} from './history/tracker.js';
import { generateStoryImage } from './image/generator.js';
import {
  uploadImageForInstagram,
  uploadVideoForInstagram,
  cleanupUploadedImage,
} from './image/uploader.js';
import { publishStory, publishVideoStory } from './instagram/publisher.js';
import { detectFaces } from './image/face-detector.js';
import { logger } from './utils/logger.js';
import { loadConfig } from './utils/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

function loadReelsConfig() {
  const configPath = path.resolve(__dirname, '../data/reels-config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function getGdriveVideoUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
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
    const totalItems =
      overrideCount > 0 ? overrideCount : slot === 'morning' ? 9 : 7;

    // Dividir entre productos y videos (~50/50)
    const numVideos = Math.floor(totalItems / 2);
    const numProducts = totalItems - numVideos;

    logger.info(
      `Plan: ${totalItems} publicaciones (${numProducts} productos + ${numVideos} videos)${overrideCount > 0 ? ' (override)' : ''}`
    );

    // Preparar productos
    const products = await prepareProducts(config, numProducts);
    logger.info(
      `Productos seleccionados: ${products.map((p) => p.title).join(', ')}`
    );

    // Preparar videos
    const videos = prepareVideos(slot, numVideos);
    logger.info(`Videos seleccionados: ${videos.length} reels`);

    // Crear batch mezclado: items de producto e items de video
    const productItems = products.map((p) => ({ type: 'product', data: p }));
    const videoItems = videos.map((v) => ({ type: 'video', data: v }));
    const batch = shuffle([...productItems, ...videoItems]);

    // Si hay un video obligatorio, asegurarse de que esté en el batch
    const reelsConfig = loadReelsConfig();
    if (slot === 'morning' && reelsConfig.mandatory.length > 0) {
      const mandatoryId =
        reelsConfig.mandatory[
          Math.floor(Math.random() * reelsConfig.mandatory.length)
        ];
      const hasMandatory = batch.some(
        (item) => item.type === 'video' && item.data.fileId === mandatoryId
      );
      if (!hasMandatory && batch.length > 0) {
        // Reemplazar el primer video del batch, o agregar si no hay videos
        const videoIdx = batch.findIndex((item) => item.type === 'video');
        const mandatoryItem = {
          type: 'video',
          data: { fileId: mandatoryId, mandatory: true },
        };
        if (videoIdx >= 0) {
          batch[videoIdx] = mandatoryItem;
        } else {
          batch[0] = mandatoryItem;
        }
      }
    }

    // Publicar en secuencia
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      logger.info(`--- Publicando ${i + 1}/${batch.length} ---`);

      try {
        if (item.type === 'product') {
          await publishProductItem(item.data, config);
          recordPostedProduct(item.data);
        } else {
          await publishVideoItem(item.data, config);
        }
        successCount++;
      } catch (error) {
        logger.error(`Error publicando ${i + 1}: ${error.message}`);
        failCount++;
      }

      if (i < batch.length - 1) {
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
  if (needed <= 0) return [];
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

function prepareVideos(slot, needed) {
  if (needed <= 0) return [];
  const reelsConfig = loadReelsConfig();
  const allIds = [...reelsConfig.pool];
  const shuffled = shuffle(allIds);
  return shuffled.slice(0, needed).map((fileId) => ({ fileId }));
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

async function publishVideoItem(video, config) {
  logger.info(
    `Video reel: ${video.fileId}${video.mandatory ? ' (OBLIGATORIO)' : ''}`
  );

  // Download from Google Drive
  const gdriveUrl = getGdriveVideoUrl(video.fileId);
  logger.info(`Descargando video de Google Drive...`);
  const response = await fetch(gdriveUrl);
  if (!response.ok) {
    throw new Error(`Error descargando video: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const ext = contentType.includes('quicktime') ? '.mov' : '.mp4';
  const outputDir = path.resolve(__dirname, '../output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const localPath = path.join(outputDir, `reel-${Date.now()}${ext}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);

  // Skip videos larger than 50MB (GitHub API limit for base64 upload)
  if (buffer.length > 50 * 1024 * 1024) {
    throw new Error(`Video demasiado grande (${sizeMB}MB), maximo 50MB`);
  }

  fs.writeFileSync(localPath, buffer);
  logger.info(`Video descargado: ${localPath} (${sizeMB}MB)`);

  // Upload to GitHub for public URL
  const publicUrl = await uploadVideoForInstagram(localPath);
  logger.info(`Video subido a: ${publicUrl}`);

  // Cleanup local file
  fs.unlinkSync(localPath);

  // Publish as video story
  const result = await publishVideoStory(publicUrl, config);
  logger.info(`Video story publicada! Media ID: ${result.id}`);

  // Cleanup GitHub
  await cleanupUploadedImage(publicUrl);
}

main();
