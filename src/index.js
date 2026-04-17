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
    const numVideos = Math.ceil(totalItems / 2);
    const numProducts = totalItems - numVideos;

    logger.info(
      `Plan: ${totalItems} publicaciones (${numProducts} productos + ${numVideos} videos)${overrideCount > 0 ? ' (override)' : ''}`
    );

    // Preparar productos
    const products = await prepareProducts(config, numProducts);
    logger.info(
      `Productos seleccionados: ${products.map((p) => p.title).join(', ')}`
    );

    // Preparar videos (con candidatos extra por si algunos son muy grandes)
    const videoPool = prepareVideos(slot, numVideos);
    logger.info(`Videos: ${numVideos} necesarios, ${videoPool.candidates.length} candidatos`);

    // Crear batch mezclado
    const productItems = products.map((p) => ({ type: 'product', data: p }));
    const videoPlaceholders = Array.from({ length: numVideos }, () => ({
      type: 'video',
      data: null,
    }));
    const batch = shuffle([...productItems, ...videoPlaceholders]);

    // Si hay un video obligatorio, insertar en el batch de mañana
    const reelsConfig = loadReelsConfig();
    if (slot === 'morning' && reelsConfig.mandatory.length > 0) {
      const mandatoryPath =
        reelsConfig.mandatory[
          Math.floor(Math.random() * reelsConfig.mandatory.length)
        ];
      videoPool.candidates.unshift({ type: 'mandatory', path: mandatoryPath });
    }

    // Publicar en secuencia
    let successCount = 0;
    let failCount = 0;
    let videoCandidateIdx = 0;

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      logger.info(`--- Publicando ${i + 1}/${batch.length} ---`);

      try {
        if (item.type === 'product') {
          await publishProductItem(item.data, config);
          recordPostedProduct(item.data);
          successCount++;
        } else {
          // Try video candidates until one works
          let videoPublished = false;
          while (videoCandidateIdx < videoPool.candidates.length) {
            const candidate = videoPool.candidates[videoCandidateIdx];
            videoCandidateIdx++;
            try {
              if (candidate.type === 'mandatory') {
                await publishMandatoryVideoItem(candidate.path, config);
              } else {
                await publishVideoItem({ fileId: candidate.fileId }, config);
              }
              videoPublished = true;
              successCount++;
              break;
            } catch (videoError) {
              const label = candidate.type === 'mandatory' ? candidate.path : candidate.fileId;
              logger.warn(`Video ${label} fallo: ${videoError.message}, intentando siguiente...`);
            }
          }
          if (!videoPublished) {
            logger.error('No se pudo publicar ningun video del pool');
            failCount++;
          }
        }
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
  if (needed <= 0) return { needed: 0, candidates: [] };
  const reelsConfig = loadReelsConfig();
  const allIds = shuffle([...reelsConfig.pool]);
  // Provide extra candidates in case some are too large
  const candidates = allIds.slice(0, needed * 3).map((id) => ({ type: 'pool', fileId: id }));
  return { needed, candidates };
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

const REPO_RAW_BASE = 'https://raw.githubusercontent.com/luisfelipevillabotero-creator/shopify-instagram-stories/main';

async function publishMandatoryVideoItem(videoPath, config) {
  const fileName = path.basename(videoPath);
  logger.info(`Video reel: ${fileName} (OBLIGATORIO)`);

  const publicUrl = `${REPO_RAW_BASE}/${videoPath}`;
  logger.info(`URL directa del repo: ${publicUrl}`);

  const result = await publishVideoStory(publicUrl, config);
  logger.info(`Video story publicada! Media ID: ${result.id}`);
}

async function publishVideoItem(video, config) {
  logger.info(`Video reel: ${video.fileId}`);

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

  // Skip videos larger than 25MB (GitHub Contents API base64 limit ~33MB)
  if (buffer.length > 25 * 1024 * 1024) {
    throw new Error(`Video demasiado grande (${sizeMB}MB), maximo 25MB`);
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
