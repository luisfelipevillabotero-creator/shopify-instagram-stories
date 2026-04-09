import { logger } from '../utils/logger.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

export async function publishStory(imageUrl, productUrl, config) {
  // Verificar que la URL de imagen es accesible
  logger.info(`Verificando accesibilidad de imagen: ${imageUrl}`);
  const checkResponse = await fetch(imageUrl, { method: 'HEAD' });
  logger.info(`Imagen check: status=${checkResponse.status}, content-type=${checkResponse.headers.get('content-type')}, size=${checkResponse.headers.get('content-length')}`);

  // Paso 1: Crear media container
  logger.info('Creando container de media en Instagram...');
  const containerId = await createStoryContainer(imageUrl, productUrl, config);
  logger.info(`Container creado: ${containerId}`);

  // Paso 2: Esperar procesamiento
  logger.info('Esperando que el container este listo...');
  await waitForContainerReady(containerId, config);

  // Paso 3: Publicar
  logger.info('Publicando story...');
  const mediaId = await publishContainer(containerId, config);
  logger.info(`Story publicada! Media ID: ${mediaId}`);

  return { id: mediaId };
}

async function createStoryContainer(imageUrl, productUrl, config) {
  const cleanImageUrl = imageUrl.trim();
  logger.info(`URL de imagen para Instagram: ${cleanImageUrl}`);

  const params = new URLSearchParams({
    image_url: cleanImageUrl,
    media_type: 'STORIES',
    access_token: config.instagramAccessToken,
  });

  // Agregar enlace de compra al producto
  if (productUrl) {
    params.set('link', productUrl);
  }

  const url = `${GRAPH_API_BASE}/${config.instagramUserId}/media?${params.toString()}`;

  const response = await fetch(url, {
    method: 'POST',
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(
      `Error creando container de Instagram: ${JSON.stringify(data.error)}`
    );
  }

  return data.id;
}

export async function publishVideoStory(videoUrl, config) {
  logger.info(`Verificando accesibilidad de video: ${videoUrl}`);
  const checkResponse = await fetch(videoUrl, { method: 'HEAD' });
  logger.info(
    `Video check: status=${checkResponse.status}, content-type=${checkResponse.headers.get('content-type')}, size=${checkResponse.headers.get('content-length')}`
  );

  logger.info('Creando container de video story en Instagram...');
  const containerId = await createVideoStoryContainer(videoUrl, config);
  logger.info(`Container creado: ${containerId}`);

  logger.info('Esperando que el video este procesado...');
  await waitForContainerReady(containerId, config, 60);

  logger.info('Publicando video story...');
  const mediaId = await publishContainer(containerId, config);
  logger.info(`Video story publicada! Media ID: ${mediaId}`);

  return { id: mediaId };
}

async function createVideoStoryContainer(videoUrl, config) {
  const cleanVideoUrl = videoUrl.trim();
  logger.info(`URL de video para Instagram: ${cleanVideoUrl}`);

  const params = new URLSearchParams({
    video_url: cleanVideoUrl,
    media_type: 'STORIES',
    access_token: config.instagramAccessToken,
  });

  const url = `${GRAPH_API_BASE}/${config.instagramUserId}/media?${params.toString()}`;

  const response = await fetch(url, { method: 'POST' });
  const data = await response.json();

  if (data.error) {
    throw new Error(
      `Error creando container de video de Instagram: ${JSON.stringify(data.error)}`
    );
  }

  return data.id;
}

async function waitForContainerReady(containerId, config, maxAttempts = 30) {
  const url = `${GRAPH_API_BASE}/${containerId}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `${url}?fields=status_code&access_token=${config.instagramAccessToken}`
    );
    const data = await response.json();
    const status = data.status_code;

    logger.info(`Status del container (intento ${attempt + 1}): ${status}`);

    if (status === 'FINISHED') {
      return;
    }

    if (status === 'ERROR') {
      throw new Error(
        'El container de Instagram fallo con status ERROR'
      );
    }

    if (status === 'EXPIRED') {
      throw new Error(
        'El container de Instagram expiro antes de publicarse'
      );
    }

    // Esperar 2 segundos antes del siguiente intento
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(
    `Container no listo despues de ${maxAttempts} intentos`
  );
}

async function publishContainer(containerId, config) {
  const url = `${GRAPH_API_BASE}/${config.instagramUserId}/media_publish`;

  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: config.instagramAccessToken,
  });

  const response = await fetch(url, {
    method: 'POST',
    body: params,
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(
      `Error publicando en Instagram: ${JSON.stringify(data.error)}`
    );
  }

  return data.id;
}
