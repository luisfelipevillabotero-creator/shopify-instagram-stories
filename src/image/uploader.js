import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export async function uploadVideoForInstagram(localVideoPath) {
  const ext = path.extname(localVideoPath) || '.mp4';
  const base64Video = fs.readFileSync(localVideoPath, { encoding: 'base64' });
  const fileName = `reel-${Date.now()}${ext}`;
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;

  if (!repo || !token) {
    throw new Error('GITHUB_REPOSITORY o GITHUB_TOKEN no disponibles');
  }

  const apiUrl = `https://api.github.com/repos/${repo}/contents/media/${fileName}`;

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Video temporal para story [skip ci]`,
      content: base64Video,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error subiendo video a GitHub: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const publicUrl = data.content.download_url;

  logger.info(`Video subido a GitHub: ${publicUrl}`);
  return publicUrl;
}

export async function uploadImageForInstagram(localImagePath) {
  const base64Image = fs.readFileSync(localImagePath, { encoding: 'base64' });
  const fileName = `story-${Date.now()}.jpg`;
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;

  if (!repo || !token) {
    throw new Error('GITHUB_REPOSITORY o GITHUB_TOKEN no disponibles');
  }

  // Subir imagen al repositorio via GitHub API
  const apiUrl = `https://api.github.com/repos/${repo}/contents/media/${fileName}`;

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Imagen temporal para story [skip ci]`,
      content: base64Image,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error subiendo imagen a GitHub: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const publicUrl = data.content.download_url;

  logger.info(`Imagen subida a GitHub: ${publicUrl}`);
  return publicUrl;
}

export async function cleanupUploadedImage(imageUrl) {
  try {
    const repo = process.env.GITHUB_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;

    if (!repo || !token) return;

    // Extraer el path del archivo de la URL
    const match = imageUrl.match(/\/main\/(.+)$/);
    if (!match) return;

    const filePath = match[1];

    // Obtener el SHA del archivo para poder eliminarlo
    const getResponse = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!getResponse.ok) return;

    const fileData = await getResponse.json();

    // Eliminar el archivo
    await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Limpiar imagen temporal [skip ci]`,
          sha: fileData.sha,
        }),
      }
    );

    logger.info('Imagen temporal eliminada del repositorio');
  } catch {
    // No es critico si falla la limpieza
    logger.info('No se pudo limpiar la imagen temporal (no critico)');
  }
}
