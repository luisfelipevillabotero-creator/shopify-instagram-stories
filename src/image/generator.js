import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRandomTemplate } from './templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '../../assets');
const OUTPUT_DIR = path.resolve(__dirname, '../../output');

registerFont(path.join(ASSETS_DIR, 'fonts/Montserrat-Bold.ttf'), {
  family: 'Montserrat',
  weight: 'bold',
});
registerFont(path.join(ASSETS_DIR, 'fonts/Montserrat-Regular.ttf'), {
  family: 'Montserrat',
  weight: 'normal',
});

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

export async function generateStoryImage(product) {
  const template = getRandomTemplate();
  const canvas = createCanvas(STORY_WIDTH, STORY_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Capa 1: Fondo blanco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  // Capa 2: Imagen del producto (90% superior)
  if (product.imageUrl) {
    try {
      const productImg = await loadImage(product.imageUrl);
      const targetHeight = STORY_HEIGHT * 0.90;
      const targetWidth = STORY_WIDTH;
      const imgAspect = productImg.width / productImg.height;
      const targetAspect = targetWidth / targetHeight;

      let sx, sy, sw, sh;
      if (imgAspect > targetAspect) {
        sh = productImg.height;
        sw = sh * targetAspect;
        sx = (productImg.width - sw) / 2;
        sy = 0;
      } else {
        sw = productImg.width;
        sh = sw / targetAspect;
        sx = 0;
        sy = (productImg.height - sh) / 2;
      }

      ctx.drawImage(
        productImg,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        targetWidth,
        targetHeight
      );

      // Gradiente blanco (20% de la pieza total = 384px)
      const gradientEnd = targetHeight;
      const gradientStart = gradientEnd - STORY_HEIGHT * 0.20;
      const gradient = ctx.createLinearGradient(0, gradientStart, 0, gradientEnd);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, gradientStart, STORY_WIDTH, gradientEnd - gradientStart);
    } catch {
      // Si falla la carga de imagen, continuar con el fondo solido
    }
  }

  // Capa 3: Logo/overlay de marca (si existe)
  const overlayPath = path.join(ASSETS_DIR, 'templates/overlay.png');
  if (fs.existsSync(overlayPath)) {
    try {
      const overlay = await loadImage(overlayPath);
      const logoWidth = 200;
      const logoHeight = (overlay.height / overlay.width) * logoWidth;
      ctx.drawImage(
        overlay,
        (STORY_WIDTH - logoWidth) / 2,
        40,
        logoWidth,
        logoHeight
      );
    } catch {
      // Si falla la carga del overlay, continuar sin el
    }
  }

  // Capa 4: Titulo del producto (texto negro, +40%)
  const textStartY = STORY_HEIGHT * 0.89;
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 36px Montserrat';
  ctx.textAlign = 'center';
  wrapText(
    ctx,
    product.title.toUpperCase(),
    STORY_WIDTH / 2,
    textStartY,
    STORY_WIDTH - 120,
    42
  );

  // Capa 5: Precio
  const priceY = textStartY + 80;

  if (product.discount) {
    // Precio original tachado (arriba, centrado)
    ctx.fillStyle = '#000000';
    ctx.font = 'normal 20px Montserrat';
    const originalPriceText = formatPrice(
      product.compareAtPrice,
      product.currency
    );
    const originalWidth = ctx.measureText(originalPriceText).width;
    const originalY = priceY - 28;
    ctx.fillText(originalPriceText, STORY_WIDTH / 2, originalY);

    // Linea de tachado
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(STORY_WIDTH / 2 - originalWidth / 2, originalY - 6);
    ctx.lineTo(STORY_WIDTH / 2 + originalWidth / 2, originalY - 6);
    ctx.stroke();

    // Precio con descuento (abajo, grande, centrado)
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 42px Montserrat';
    const finalPriceText = formatPrice(product.price, product.currency);
    const finalWidth = ctx.measureText(finalPriceText).width;
    ctx.fillText(finalPriceText, STORY_WIDTH / 2, priceY + 14);

    // Badge de descuento al lado derecho del precio
    const badgeX = STORY_WIDTH / 2 + finalWidth / 2 + 45;
    const badgeY = priceY;
    drawDiscountBadge(ctx, product.discount, badgeX, badgeY);
  } else {
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 42px Montserrat';
    ctx.fillText(
      formatPrice(product.price, product.currency),
      STORY_WIDTH / 2,
      priceY
    );
  }

  // Capa 6: Boton CTA
  const ctaY = STORY_HEIGHT - 90;
  drawRoundedRect(ctx, STORY_WIDTH / 2 - 160, ctaY, 320, 56, 28);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 25px Montserrat';
  ctx.textAlign = 'center';
  ctx.fillText('COMPRAR AHORA', STORY_WIDTH / 2, ctaY + 37);

  // Capa 7: Texto inferior
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.font = 'normal 20px Montserrat';
  ctx.fillText('weloveluana.com', STORY_WIDTH / 2, STORY_HEIGHT - 18);

  // Guardar imagen
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, `story-${Date.now()}.jpg`);
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.92 });
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

function formatPrice(amount, currency) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function drawDiscountBadge(ctx, discount, x, y) {
  ctx.save();
  ctx.fillStyle = '#FF6B6B';
  ctx.beginPath();
  ctx.arc(x, y, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px Montserrat';
  ctx.textAlign = 'center';
  ctx.fillText(`-${discount}%`, x, y + 8);
  ctx.restore();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
