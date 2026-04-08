import { fetchBestSellingProducts } from './shopify/client.js';
import {
  filterUnpostedProducts,
  recordPostedProduct,
} from './history/tracker.js';
import { generateStoryImage } from './image/generator.js';
import {
  uploadImageForInstagram,
  cleanupUploadedImage,
} from './image/uploader.js';
import { publishStory } from './instagram/publisher.js';
import { logger } from './utils/logger.js';
import { loadConfig } from './utils/config.js';

async function main() {
  try {
    const config = loadConfig();

    // Verificar cuenta de Instagram
    const igResponse = await fetch(
      `https://graph.facebook.com/v19.0/${config.instagramUserId}?fields=username,name&access_token=${config.instagramAccessToken}`
    );
    const igData = await igResponse.json();
    logger.info(`Cuenta de Instagram: @${igData.username} (${igData.name || 'sin nombre'})`);

    // Paso 1: Obtener productos mas vendidos de Shopify
    logger.info('Obteniendo productos mas vendidos de Shopify...');
    const products = await fetchBestSellingProducts(config, { first: 10 });
    logger.info(`Se obtuvieron ${products.length} productos`);

    // Paso 2: Filtrar productos ya publicados
    const unposted = filterUnpostedProducts(products);
    logger.info(`${unposted.length} productos sin publicar disponibles`);

    if (unposted.length === 0) {
      logger.info(
        'No hay productos nuevos para publicar. Finalizando.'
      );
      return;
    }

    // Paso 3: Seleccionar el mejor producto no publicado
    const product = unposted[0];
    logger.info(`Producto seleccionado: ${product.title}`);

    // Paso 4: Generar imagen de la story
    const localImagePath = await generateStoryImage(product);
    logger.info(`Imagen generada: ${localImagePath}`);

    // Paso 5: Subir imagen para obtener URL publica (via GitHub)
    const publicUrl = await uploadImageForInstagram(localImagePath);
    logger.info(`Imagen subida a: ${publicUrl}`);

    // Paso 6: Publicar story en Instagram con enlace de compra
    const result = await publishStory(publicUrl, product.url, config);
    logger.info(`Story publicada! Media ID: ${result.id}`);

    // Paso 6.5: Limpiar imagen temporal del repositorio
    await cleanupUploadedImage(publicUrl);

    // Paso 7: Registrar en historial
    recordPostedProduct(product);
    logger.info('Producto registrado en el historial');
  } catch (error) {
    logger.error('El pipeline fallo:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

main();
