import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.post('/api/extract-product', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64 || !mimeType) {
      res.status(400).json({ error: 'Missing imageBase64 or mimeType.' });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          {
            text:
              'You are an electronics store inventory assistant. Extract all visible product details from this photo (box label, device sticker, barcode, IMEI, serial number, or product itself). ' +
              'Return concise, accurate values. For category, choose the best match from: Smartphones, Laptops, Audio, Displays, Components, Accessories, Gaming, Other. ' +
              'If a field is not visible, return an empty string (or empty array for serialNumbers).',
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Full product name and storage/spec if visible.' },
            brand: { type: Type.STRING, description: 'Manufacturer or brand name.' },
            model: { type: Type.STRING, description: 'Model number or part number.' },
            sku: { type: Type.STRING, description: 'SKU or short product code.' },
            barcode: { type: Type.STRING, description: 'UPC/EAN barcode number if visible.' },
            category: { type: Type.STRING, description: 'Best matching electronics category.' },
            serialNumbers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Any visible Serial Number or IMEI strings.',
            },
            notes: { type: Type.STRING, description: 'Any extra specs like color, RAM, storage, or wattage.' },
          },
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);
    res.json(parsed);
  } catch (error) {
    console.error('Product extraction error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to extract product details from image.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rebootly server running on http://localhost:${PORT}`);
  });
}

startServer();
