import imgbbUploader from 'imgbb-uploader';
import fs from 'fs';

export async function uploadImageForInstagram(localImagePath, config) {
  const base64Image = fs.readFileSync(localImagePath, { encoding: 'base64' });

  const response = await imgbbUploader({
    apiKey: config.imgbbApiKey,
    base64string: base64Image,
    name: `story-${Date.now()}`,
    expiration: 3600, // 1 hora — suficiente para que Instagram la descargue
  });

  return response.url;
}
