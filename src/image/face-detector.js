import ort from 'onnxruntime-node';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.resolve(
  __dirname,
  '../../assets/models/face-detector.onnx'
);

const CONFIDENCE_THRESHOLD = 0.7;
const NMS_IOU_THRESHOLD = 0.3;
const MODEL_WIDTH = 320;
const MODEL_HEIGHT = 240;

let session = null;

async function getSession() {
  if (!session) {
    session = await ort.InferenceSession.create(MODEL_PATH, {
      logSeverityLevel: 3,
    });
  }
  return session;
}

function iou(a, b) {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / (areaA + areaB - inter);
}

function nms(detections) {
  detections.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const det of detections) {
    let dominated = false;
    for (const k of kept) {
      if (iou(det.box, k.box) > NMS_IOU_THRESHOLD) {
        dominated = true;
        break;
      }
    }
    if (!dominated) kept.push(det);
  }
  return kept;
}

export async function detectFaces(imageUrl) {
  try {
    const img = await loadImage(imageUrl);
    const canvas = createCanvas(MODEL_WIDTH, MODEL_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, MODEL_WIDTH, MODEL_HEIGHT);

    const imageData = ctx.getImageData(0, 0, MODEL_WIDTH, MODEL_HEIGHT);
    const { data } = imageData;

    const totalPixels = MODEL_WIDTH * MODEL_HEIGHT;
    const float32Data = new Float32Array(3 * totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const offset = i * 4;
      float32Data[i] = (data[offset] - 127) / 128;
      float32Data[totalPixels + i] = (data[offset + 1] - 127) / 128;
      float32Data[2 * totalPixels + i] = (data[offset + 2] - 127) / 128;
    }

    const inputTensor = new ort.Tensor('float32', float32Data, [
      1,
      3,
      MODEL_HEIGHT,
      MODEL_WIDTH,
    ]);

    const sess = await getSession();
    const results = await sess.run({ input: inputTensor });

    const scores = results.scores.data;
    const boxes = results.boxes.data;
    const numDetections = scores.length / 2;

    const candidates = [];
    for (let i = 0; i < numDetections; i++) {
      const faceScore = scores[i * 2 + 1];
      if (faceScore > CONFIDENCE_THRESHOLD) {
        candidates.push({
          score: faceScore,
          box: [boxes[i * 4], boxes[i * 4 + 1], boxes[i * 4 + 2], boxes[i * 4 + 3]],
        });
      }
    }

    return nms(candidates).length;
  } catch {
    return 0;
  }
}

export async function pickImageWithFace(imageUrls) {
  for (const url of imageUrls) {
    const faces = await detectFaces(url);
    if (faces > 0) {
      return { url, faces };
    }
  }
  return null;
}
