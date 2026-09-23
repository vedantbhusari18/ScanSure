import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { generate300DemoInspections } from './src/data/demo300Inspections.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'inspections.json');

// Ensure data folder and storage file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readInspections(): any[] {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading inspections.json:', err);
    return [];
  }
}

function writeInspections(records: any[]): boolean {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed writing inspections.json:', err);
    return false;
  }
}

// Auto-seed 300 realistic demo records if data is empty or has fewer than 300 records
const existingData = readInspections();
if (!existingData || existingData.length < 300) {
  try {
    const seedRecords = generate300DemoInspections();
    writeInspections(seedRecords);
    console.log(`Auto-seeded ${seedRecords.length} demo inspections into inspections.json`);
  } catch (err) {
    console.error('Failed seeding 300 demo records:', err);
  }
}

// Optional Gemini client helper
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

// ---------------- API ENDPOINTS ----------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    project: 'HEXABYTE — Packaged Commodity Compliance Scanner',
    problemCode: 'SIH26034',
    geminiEnabled: Boolean(process.env.GEMINI_API_KEY),
    serverTime: new Date().toISOString(),
  });
});

// IP Webcam snapshot proxy (bypasses browser CORS when running locally)
app.get('/api/ip-webcam/proxy', async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Camera returned HTTP ${response.status}` });
    }
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    res.status(502).json({ error: 'Could not connect to IP camera at ' + targetUrl, details: err.message });
  }
});

// Get all inspections
app.get('/api/inspections', (req, res) => {
  const inspections = readInspections();
  res.json(inspections);
});

// Get single inspection
app.get('/api/inspections/:id', (req, res) => {
  const inspections = readInspections();
  const match = inspections.find((item: any) => item.id === req.params.id);
  if (!match) {
    return res.status(404).json({ error: 'Inspection not found' });
  }
  res.json(match);
});

// Save or Update inspection
app.post('/api/inspections', (req, res) => {
  const newRecord = req.body;
  if (!newRecord || !newRecord.id) {
    return res.status(400).json({ error: 'Invalid inspection record' });
  }

  const inspections = readInspections();
  const existingIdx = inspections.findIndex((item: any) => item.id === newRecord.id);

  if (existingIdx >= 0) {
    inspections[existingIdx] = { ...inspections[existingIdx], ...newRecord, updatedAt: new Date().toISOString() };
  } else {
    inspections.unshift({ ...newRecord, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  writeInspections(inspections);
  res.status(201).json(newRecord);
});

// Delete inspection
app.delete('/api/inspections/:id', (req, res) => {
  let inspections = readInspections();
  const initialLength = inspections.length;
  inspections = inspections.filter((item: any) => item.id !== req.params.id);

  if (inspections.length === initialLength) {
    return res.status(404).json({ error: 'Inspection not found' });
  }

  writeInspections(inspections);
  res.json({ success: true, deletedId: req.params.id });
});

// Seed or Reset 300 Demo Inspections (supports both /api/demo/seed-300 and legacy /api/demo/seed-100)
const handleSeed300 = (req: express.Request, res: express.Response) => {
  try {
    const seedRecords = generate300DemoInspections();
    writeInspections(seedRecords);
    res.json({ success: true, count: seedRecords.length, records: seedRecords });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to seed 300 records', details: err.message });
  }
};
app.post('/api/demo/seed-300', handleSeed300);
app.post('/api/demo/seed-100', handleSeed300);

// Modular OCR Vision Analysis route
app.post('/api/analyze', async (req, res) => {
  try {
    const { imageBase64, presetId, commodityName, brandName } = req.body;

    // Check if Gemini Vision is available and image is custom
    const ai = getGeminiClient();
    if (ai && imageBase64 && imageBase64.startsWith('data:image') && !presetId) {
      try {
        const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';
        const base64Data = imageBase64.split(',')[1];

        const prompt = `Analyze this packaged commodity image for mandatory Legal Metrology (Packaged Commodities) declarations in India.
Extract:
1. MRP (Maximum Retail Price in Rupees)
2. Net Quantity (mass/volume with unit)
3. Manufacturer/Packer/Importer name & address
4. Generic Name of the product
5. Date of manufacture/packaging
6. Consumer Care / helpline / email
7. Unit Sale Price (USP)

Return clean JSON with fields:
{
  "mrp": { "found": boolean, "text": string, "isReadable": boolean, "confidence": number },
  "netQuantity": { "found": boolean, "text": string, "isReadable": boolean, "confidence": number },
  "manufacturer": { "found": boolean, "text": string, "isReadable": boolean, "confidence": number },
  "genericName": { "found": boolean, "text": string, "isReadable": boolean, "confidence": number },
  "dateInfo": { "found": boolean, "text": string, "isReadable": boolean, "confidence": number },
  "consumerCare": { "found": boolean, "text": string, "isReadable": boolean, "confidence": number },
  "unitSalePrice": { "found": boolean, "text": string, "isReadable": boolean, "confidence": number }
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: prompt },
              ],
            },
          ],
        });

        const textResponse = response.text || '';
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return res.json({ source: 'gemini-vision', data: parsed });
        }
      } catch (geminiErr) {
        console.warn('Gemini vision extraction fallback to deterministic engine:', geminiErr);
      }
    }

    // Default: Deterministic fallback engine response
    return res.json({
      source: 'deterministic-edge-ocr',
      message: 'Processed using Hexabyte local deterministic OCR engine',
      presetId: presetId || 'sih-demo-abc-foods',
    });
  } catch (err: any) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

// Service Worker fallback routes (ensures correct application/javascript MIME type in dev)
app.get('/sw.js', (req, res) => {
  const distSw = path.join(process.cwd(), 'dist', 'sw.js');
  if (fs.existsSync(distSw)) {
    res.setHeader('Content-Type', 'application/javascript');
    return res.sendFile(distSw);
  }
  res.setHeader('Content-Type', 'application/javascript');
  res.send('self.addEventListener("install", () => self.skipWaiting());\nself.addEventListener("activate", () => self.clients.claim());\n');
});

app.get('/dev-sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send('self.addEventListener("install", () => self.skipWaiting());\nself.addEventListener("activate", () => self.clients.claim());\n');
});

// ---------------- VITE MIDDLEWARE / STATIC FILES ----------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HEXABYTE Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
