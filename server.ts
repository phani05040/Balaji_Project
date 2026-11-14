import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import express, { NextFunction, Request, Response } from 'express';
import JSZip from 'jszip';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { config } from './server/config.ts';
import { getDb } from './server/db.ts';
import { CROP_PROFILES, SUPPORTED_DISEASES } from './server/ml/agronomyKnowledge.ts';
import {
  assessRisks,
  compareCrops,
  computeSoilHealth,
  FarmInput,
  generateFarmingCalendar,
  planIrrigation,
  predictYield,
  recommendCrop,
  recommendFertilizer,
} from './server/ml/inference.ts';
import { trainOrLoadModels } from './server/ml/trainer.ts';
import {
  analyzeLeafImage,
  FarmContextSummary,
  generateSmartFarmingReply,
  generateSpeechAudio,
  translateDynamicTexts,
} from './server/services/geminiService.ts';
import { generateFarmPdfReport } from './server/services/pdfService.ts';
import { getWeatherForLocation } from './server/services/weatherService.ts';

interface AuthUser {
  id: number;
  fullName: string;
  username: string;
  email: string;
  location: string;
  preferredLanguage: string;
}

interface AuthedRequest extends Request {
  user?: AuthUser;
}

// HMAC-SHA256 signed session tokens (works via HttpOnly cookie OR Authorization Bearer header inside iframes)
function signToken(payload: { userId: number; exp: number }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string): { userId: number; exp: number } | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
    if (sig !== expected) return null;
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (!parsed.userId || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractCookieToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === 'agrisense_session') return decodeURIComponent(v.join('='));
  }
  return null;
}

function getUserById(id: number): AuthUser | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id, full_name, username, email, location, preferred_language FROM users WHERE id = ?')
    .get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    location: row.location,
    preferredLanguage: row.preferred_language,
  };
}

function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const token = bearer || extractCookieToken(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }
  const user = getUserById(decoded.userId);
  if (!user) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }
  req.user = user;
  next();
}

function validateFarmInput(body: any): { valid: boolean; error?: string; input?: FarmInput & { farmName: string } } {
  const farmName = String(body.farmName || 'My Farm Plot').trim().slice(0, 80);
  const location = String(body.location || '').trim().slice(0, 100);
  const areaAcres = Number(body.areaAcres);
  const nitrogen = Number(body.nitrogen);
  const phosphorus = Number(body.phosphorus);
  const potassium = Number(body.potassium);
  const ph = Number(body.ph);
  const temperature = Number(body.temperature);
  const humidity = Number(body.humidity);
  const rainfall = Number(body.rainfall);

  if (!location) return { valid: false, error: 'Location is required.' };
  if (!Number.isFinite(areaAcres) || areaAcres <= 0 || areaAcres > 10000)
    return { valid: false, error: 'Land area must be between 0.1 and 10,000 acres.' };
  if (!Number.isFinite(nitrogen) || nitrogen < 0 || nitrogen > 300)
    return { valid: false, error: 'Nitrogen (N) must be between 0 and 300 kg/ha.' };
  if (!Number.isFinite(phosphorus) || phosphorus < 0 || phosphorus > 300)
    return { valid: false, error: 'Phosphorus (P) must be between 0 and 300 kg/ha.' };
  if (!Number.isFinite(potassium) || potassium < 0 || potassium > 350)
    return { valid: false, error: 'Potassium (K) must be between 0 and 350 kg/ha.' };
  if (!Number.isFinite(ph) || ph < 3 || ph > 10)
    return { valid: false, error: 'Soil pH must be between 3.0 and 10.0.' };
  if (!Number.isFinite(temperature) || temperature < -5 || temperature > 55)
    return { valid: false, error: 'Temperature must be between -5°C and 55°C.' };
  if (!Number.isFinite(humidity) || humidity < 5 || humidity > 100)
    return { valid: false, error: 'Humidity must be between 5% and 100%.' };
  if (!Number.isFinite(rainfall) || rainfall < 0 || rainfall > 3500)
    return { valid: false, error: 'Rainfall must be between 0 and 3500 mm.' };

  return {
    valid: true,
    input: { farmName, location, areaAcres, nitrogen, phosphorus, potassium, ph, temperature, humidity, rainfall },
  };
}

function getFarmBundle(farmId: number, userId: number) {
  const db = getDb();
  const farm = db.prepare('SELECT * FROM farms WHERE id = ? AND user_id = ?').get(farmId, userId) as any;
  if (!farm) return null;

  const cropRow = db
    .prepare('SELECT * FROM crop_recommendations WHERE farm_id = ? ORDER BY id DESC LIMIT 1')
    .get(farmId) as any;
  const fertRow = db
    .prepare('SELECT * FROM fertilizer_recommendations WHERE farm_id = ? ORDER BY id DESC LIMIT 1')
    .get(farmId) as any;
  const irrRow = db
    .prepare('SELECT * FROM irrigation_results WHERE farm_id = ? ORDER BY id DESC LIMIT 1')
    .get(farmId) as any;
  const yieldRow = db
    .prepare('SELECT * FROM yield_predictions WHERE farm_id = ? ORDER BY id DESC LIMIT 1')
    .get(farmId) as any;
  const riskRow = db
    .prepare('SELECT * FROM risk_assessments WHERE farm_id = ? ORDER BY id DESC LIMIT 1')
    .get(farmId) as any;

  const input: FarmInput = {
    location: farm.location,
    areaAcres: farm.area_acres,
    nitrogen: farm.nitrogen,
    phosphorus: farm.phosphorus,
    potassium: farm.potassium,
    ph: farm.ph,
    temperature: farm.temperature,
    humidity: farm.humidity,
    rainfall: farm.rainfall,
  };

  const activeCrop = cropRow?.recommended_crop || 'maize';
  const cropRecommendation = recommendCrop(input);
  if (cropRow) {
    cropRecommendation.confidenceScore = cropRow.confidence_score;
  }

  return {
    farm: {
      id: farm.id,
      farmName: farm.farm_name,
      location: farm.location,
      areaAcres: farm.area_acres,
      nitrogen: farm.nitrogen,
      phosphorus: farm.phosphorus,
      potassium: farm.potassium,
      ph: farm.ph,
      temperature: farm.temperature,
      humidity: farm.humidity,
      rainfall: farm.rainfall,
      soilHealthScore: farm.soil_health_score,
      createdAt: farm.created_at,
    },
    soilHealth: computeSoilHealth(input),
    cropRecommendation,
    fertilizerRecommendation: fertRow ? JSON.parse(fertRow.details_json) : recommendFertilizer(input, activeCrop),
    irrigationPlan: irrRow ? JSON.parse(irrRow.details_json) : planIrrigation(input, activeCrop),
    yieldPrediction: yieldRow ? JSON.parse(yieldRow.details_json) : predictYield(input, activeCrop),
    riskAssessment: riskRow ? JSON.parse(riskRow.details_json) : assessRisks(input, activeCrop),
  };
}

async function startServer() {
  // Initialize ML models & SQLite database at startup
  console.log('Training / loading agricultural ML models...');
  const mlBundle = trainOrLoadModels();
  console.log(
    `ML Models ready — Crop RF Accuracy: ${mlBundle.cropModel.metrics.accuracy}%, Fertilizer Accuracy: ${mlBundle.fertilizerModel.metrics.accuracy}%, Yield R²: ${mlBundle.yieldModel.metrics.r2}`
  );
  const db = getDb();
  console.log('SQLite database initialized at', config.dbPath);

  const app = express();
  app.use(express.json({ limit: '6mb' }));
  app.use('/uploads', express.static(config.uploadsDir));

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(config.uploadsDir, { recursive: true });
        cb(null, config.uploadsDir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
        cb(null, `leaf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
      },
    }),
    limits: { fileSize: config.maxUploadBytes },
    fileFilter: (_req, file, cb) => {
      if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only JPG, PNG, and WEBP leaf images are allowed.'));
      }
    },
  });

  // --- Public Routes ---
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', mlTrainedAt: mlBundle.trainedAt });
  });

  app.get('/api/ml-metrics', (_req, res) => {
    res.json({
      trainedAt: mlBundle.trainedAt,
      cropModel: {
        algorithm: mlBundle.cropModel.algorithm,
        classesCount: mlBundle.cropModel.classes.length,
        featureImportances: mlBundle.cropModel.featureImportances,
        metrics: mlBundle.cropModel.metrics,
      },
      fertilizerModel: {
        algorithm: mlBundle.fertilizerModel.algorithm,
        classesCount: mlBundle.fertilizerModel.classes.length,
        metrics: mlBundle.fertilizerModel.metrics,
      },
      yieldModel: {
        algorithm: mlBundle.yieldModel.algorithm,
        metrics: mlBundle.yieldModel.metrics,
      },
      supportedCrops: Object.values(CROP_PROFILES).map((c) => ({
        name: c.name,
        displayName: c.displayName,
        category: c.category,
        season: c.season,
        durationDays: c.durationDays,
      })),
      supportedDiseases: SUPPORTED_DISEASES,
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const fullName = String(req.body.fullName || '').trim();
    const username = String(req.body.username || '').trim().toLowerCase();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const location = String(req.body.location || 'Guntur, Andhra Pradesh').trim();
    const preferredLanguage = String(req.body.preferredLanguage || 'en').trim();

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      res.status(400).json({ error: 'Username must be 3–24 characters (letters, numbers, underscore).' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existing) {
      res.status(409).json({ error: 'An account with that email or username already exists.' });
      return;
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare(
        `INSERT INTO users (full_name, username, email, password_hash, location, preferred_language)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(fullName, username, email, hash, location, preferredLanguage);

    const user = getUserById(Number(result.lastInsertRowid))!;
    const token = signToken({ userId: user.id, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    res.cookie('agrisense_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ user, token });
  });

  app.post('/api/auth/login', (req, res) => {
    const identifier = String(req.body.identifier || req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!identifier || !password) {
      res.status(400).json({ error: 'Email/username and password are required.' });
      return;
    }

    const row = db
      .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
      .get(identifier, identifier) as any;
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid credentials. Check your username/email and password.' });
      return;
    }

    const user = getUserById(row.id)!;
    const token = signToken({ userId: user.id, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    res.cookie('agrisense_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ user, token });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('agrisense_session');
    res.json({ success: true });
  });

  app.get('/api/auth/me', authMiddleware, (req: AuthedRequest, res) => {
    res.json({ user: req.user });
  });

  app.patch('/api/auth/preferences', authMiddleware, (req: AuthedRequest, res) => {
    const lang = String(req.body.preferredLanguage || 'en');
    const loc = req.body.location ? String(req.body.location).trim() : req.user!.location;
    const allowed = ['en', 'te', 'hi', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa'];
    const finalLang = allowed.includes(lang) ? lang : 'en';
    db.prepare('UPDATE users SET preferred_language = ?, location = ? WHERE id = ?').run(finalLang, loc, req.user!.id);
    res.json({ user: getUserById(req.user!.id) });
  });

  // Public contact message submission (associates userId if logged in)
  app.post('/api/contact', (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();
    if (!name || !email || !message) {
      res.status(400).json({ error: 'Name, email, and message are required.' });
      return;
    }
    db.prepare('INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)').run(
      name,
      email,
      subject || 'General Inquiry',
      message
    );
    res.status(201).json({ success: true, message: 'Thank you. Your agricultural inquiry has been recorded.' });
  });

  // --- Protected Application Routes ---
  app.get('/api/dashboard/summary', authMiddleware, async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const totalFarmers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
    const totalFarms = (db.prepare('SELECT COUNT(*) as c FROM farms').get() as any).c;
    const userFarmsCount = (db.prepare('SELECT COUNT(*) as c FROM farms WHERE user_id = ?').get(userId) as any).c;

    const topCrops = db
      .prepare(
        `SELECT recommended_crop as crop, COUNT(*) as count, ROUND(AVG(confidence_score), 1) as avgScore
         FROM crop_recommendations GROUP BY recommended_crop ORDER BY count DESC LIMIT 6`
      )
      .all();

    const fertStats = db
      .prepare(
        `SELECT recommended_fertilizer as fertilizer, COUNT(*) as count
         FROM fertilizer_recommendations GROUP BY recommended_fertilizer ORDER BY count DESC LIMIT 5`
      )
      .all();

    const avgYieldRow = db
      .prepare('SELECT ROUND(AVG(yield_tonnes_per_ha), 2) as avgTha, ROUND(AVG(yield_quintals_per_acre), 2) as avgQac FROM yield_predictions')
      .get() as any;

    const irrigationStats = db
      .prepare('SELECT irrigation_level as level, COUNT(*) as count FROM irrigation_results GROUP BY irrigation_level')
      .all();

    const riskStats = db
      .prepare('SELECT overall_level as level, COUNT(*) as count FROM risk_assessments GROUP BY overall_level')
      .all();

    const recentActivities = db
      .prepare(
        `SELECT id, crop_name as cropName, stage, title, due_date as dueDate, completed
         FROM farming_activities WHERE user_id = ? ORDER BY completed ASC, due_date ASC LIMIT 6`
      )
      .all(userId);

    const latestFarm = db
      .prepare('SELECT location FROM farms WHERE user_id = ? ORDER BY id DESC LIMIT 1')
      .get(userId) as any;

    const weatherLoc = latestFarm?.location || req.user!.location || 'Guntur';
    const weather = await getWeatherForLocation(weatherLoc);

    res.json({
      totalFarmers,
      totalFarms,
      userFarmsCount,
      avgPredictedYieldTha: avgYieldRow?.avgTha ?? 0,
      avgPredictedYieldQac: avgYieldRow?.avgQac ?? 0,
      topCrops,
      fertilizerStats: fertStats,
      irrigationStats,
      riskStats,
      recentActivities,
      weather,
      mlSummary: {
        cropAccuracy: mlBundle.cropModel.metrics.accuracy,
        fertilizerAccuracy: mlBundle.fertilizerModel.metrics.accuracy,
        yieldR2: mlBundle.yieldModel.metrics.r2,
      },
    });
  });

  app.get('/api/farms', authMiddleware, (req: AuthedRequest, res) => {
    const farms = db
      .prepare(
        `SELECT f.*, cr.recommended_crop, cr.confidence_score, fr.recommended_fertilizer,
                ir.irrigation_level, yp.yield_tonnes_per_ha, yp.yield_quintals_per_acre,
                ra.overall_level as risk_level, ra.risk_score
         FROM farms f
         LEFT JOIN crop_recommendations cr ON cr.farm_id = f.id
         LEFT JOIN fertilizer_recommendations fr ON fr.farm_id = f.id
         LEFT JOIN irrigation_results ir ON ir.farm_id = f.id
         LEFT JOIN yield_predictions yp ON yp.farm_id = f.id
         LEFT JOIN risk_assessments ra ON ra.farm_id = f.id
         WHERE f.user_id = ?
         ORDER BY f.id DESC`
      )
      .all(req.user!.id);
    res.json({ farms });
  });

  app.get('/api/farms/:id/bundle', authMiddleware, (req: AuthedRequest, res) => {
    const farmId = Number(req.params.id);
    const bundle = getFarmBundle(farmId, req.user!.id);
    if (!bundle) {
      res.status(404).json({ error: 'Farm analysis not found.' });
      return;
    }
    res.json(bundle);
  });

  app.post('/api/farms', authMiddleware, (req: AuthedRequest, res) => {
    const check = validateFarmInput(req.body);
    if (!check.valid || !check.input) {
      res.status(400).json({ error: check.error });
      return;
    }

    const input = check.input;
    const userId = req.user!.id;
    const soilHealth = computeSoilHealth(input);
    const cropRec = recommendCrop(input);
    const requestedCrop = String(req.body.targetCrop || '').trim().toLowerCase();
    const selectedCrop =
      requestedCrop && requestedCrop !== 'auto'
        ? requestedCrop
        : cropRec.recommendedCrop;
    const fertRec = recommendFertilizer(input, selectedCrop);
    const irrRec = planIrrigation(input, selectedCrop);
    const yieldRec = predictYield(input, selectedCrop);
    const riskRec = assessRisks(input, selectedCrop);

    const farmRes = db
      .prepare(
        `INSERT INTO farms (user_id, farm_name, location, area_acres, nitrogen, phosphorus, potassium, ph, temperature, humidity, rainfall, soil_health_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        input.farmName,
        input.location,
        input.areaAcres,
        input.nitrogen,
        input.phosphorus,
        input.potassium,
        input.ph,
        input.temperature,
        input.humidity,
        input.rainfall,
        soilHealth.score
      );
    const farmId = Number(farmRes.lastInsertRowid);

    db.prepare(
      `INSERT INTO crop_recommendations (user_id, farm_id, recommended_crop, confidence_score, alternatives_json, explanation)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, farmId, selectedCrop, cropRec.confidenceScore, JSON.stringify(cropRec.alternatives), cropRec.explanation);

    db.prepare(
      `INSERT INTO fertilizer_recommendations (user_id, farm_id, crop_name, recommended_fertilizer, confidence_score, details_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, farmId, selectedCrop, fertRec.recommendedFertilizer, fertRec.confidenceScore, JSON.stringify(fertRec));

    db.prepare(
      `INSERT INTO irrigation_results (user_id, farm_id, crop_name, irrigation_level, weekly_mm, seasonal_mm, liters_per_week, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, farmId, selectedCrop, irrRec.level, irrRec.estimatedWeeklyMm, irrRec.estimatedSeasonalMm, irrRec.estimatedTotalLitersPerWeek, JSON.stringify(irrRec));

    db.prepare(
      `INSERT INTO yield_predictions (user_id, farm_id, crop_name, yield_tonnes_per_ha, yield_quintals_per_acre, total_tonnes, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, farmId, selectedCrop, yieldRec.yieldTonnesPerHa, yieldRec.yieldQuintalsPerAcre, yieldRec.totalEstimatedTonnes, JSON.stringify(yieldRec));

    db.prepare(
      `INSERT INTO risk_assessments (user_id, farm_id, crop_name, overall_level, risk_score, details_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, farmId, selectedCrop, riskRec.overallLevel, riskRec.riskScore, JSON.stringify(riskRec));

    const calendar = generateFarmingCalendar(selectedCrop, new Date().toISOString().split('T')[0]);
    const insertAct = db.prepare(
      `INSERT INTO farming_activities (user_id, farm_id, crop_name, stage, title, due_date, notes, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    );
    for (const task of calendar) {
      insertAct.run(userId, farmId, selectedCrop, task.stage, task.title, task.dueDate, task.notes);
    }

    res.status(201).json(getFarmBundle(farmId, userId));
  });

  // Re-evaluate Fertilizer / Irrigation / Yield / Risk for a specific crop using the same saved farm data
  app.post('/api/farms/:id/recompute', authMiddleware, (req: AuthedRequest, res) => {
    const farmId = Number(req.params.id);
    const cropName = String(req.body.cropName || 'maize').toLowerCase();
    const farm = db.prepare('SELECT * FROM farms WHERE id = ? AND user_id = ?').get(farmId, req.user!.id) as any;
    if (!farm) {
      res.status(404).json({ error: 'Farm not found.' });
      return;
    }

    const input: FarmInput = {
      location: farm.location,
      areaAcres: farm.area_acres,
      nitrogen: farm.nitrogen,
      phosphorus: farm.phosphorus,
      potassium: farm.potassium,
      ph: farm.ph,
      temperature: farm.temperature,
      humidity: farm.humidity,
      rainfall: farm.rainfall,
    };

    const fertRec = recommendFertilizer(input, cropName);
    const irrRec = planIrrigation(input, cropName);
    const yieldRec = predictYield(input, cropName);
    const riskRec = assessRisks(input, cropName);

    db.prepare('DELETE FROM fertilizer_recommendations WHERE farm_id = ?').run(farmId);
    db.prepare(
      `INSERT INTO fertilizer_recommendations (user_id, farm_id, crop_name, recommended_fertilizer, confidence_score, details_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(req.user!.id, farmId, cropName, fertRec.recommendedFertilizer, fertRec.confidenceScore, JSON.stringify(fertRec));

    db.prepare('DELETE FROM irrigation_results WHERE farm_id = ?').run(farmId);
    db.prepare(
      `INSERT INTO irrigation_results (user_id, farm_id, crop_name, irrigation_level, weekly_mm, seasonal_mm, liters_per_week, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.user!.id, farmId, cropName, irrRec.level, irrRec.estimatedWeeklyMm, irrRec.estimatedSeasonalMm, irrRec.estimatedTotalLitersPerWeek, JSON.stringify(irrRec));

    db.prepare('DELETE FROM yield_predictions WHERE farm_id = ?').run(farmId);
    db.prepare(
      `INSERT INTO yield_predictions (user_id, farm_id, crop_name, yield_tonnes_per_ha, yield_quintals_per_acre, total_tonnes, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(req.user!.id, farmId, cropName, yieldRec.yieldTonnesPerHa, yieldRec.yieldQuintalsPerAcre, yieldRec.totalEstimatedTonnes, JSON.stringify(yieldRec));

    db.prepare('DELETE FROM risk_assessments WHERE farm_id = ?').run(farmId);
    db.prepare(
      `INSERT INTO risk_assessments (user_id, farm_id, crop_name, overall_level, risk_score, details_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(req.user!.id, farmId, cropName, riskRec.overallLevel, riskRec.riskScore, JSON.stringify(riskRec));

    res.json(getFarmBundle(farmId, req.user!.id));
  });

  app.get('/api/weather', authMiddleware, async (req, res) => {
    const location = String(req.query.location || 'Guntur');
    const data = await getWeatherForLocation(location);
    res.json(data);
  });

  app.post('/api/compare-crops', authMiddleware, (req: AuthedRequest, res) => {
    const farmId = Number(req.body.farmId);
    const crops: string[] = Array.isArray(req.body.crops) ? req.body.crops : [];
    const farm = db.prepare('SELECT * FROM farms WHERE id = ? AND user_id = ?').get(farmId, req.user!.id) as any;
    if (!farm) {
      res.status(404).json({ error: 'Select or create a farm analysis first.' });
      return;
    }
    const input: FarmInput = {
      location: farm.location,
      areaAcres: farm.area_acres,
      nitrogen: farm.nitrogen,
      phosphorus: farm.phosphorus,
      potassium: farm.potassium,
      ph: farm.ph,
      temperature: farm.temperature,
      humidity: farm.humidity,
      rainfall: farm.rainfall,
    };
    res.json({ comparisons: compareCrops(input, crops) });
  });

  app.get('/api/profit', authMiddleware, (req: AuthedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM profit_calculations WHERE user_id = ? ORDER BY id DESC LIMIT 12')
      .all(req.user!.id);
    res.json({ history: rows });
  });

  app.post('/api/profit', authMiddleware, (req: AuthedRequest, res) => {
    const farmId = req.body.farmId ? Number(req.body.farmId) : null;
    const cropName = String(req.body.cropName || 'maize');
    const areaAcres = Math.max(0.1, Number(req.body.areaAcres || 1));
    const expectedQuintals = Math.max(0, Number(req.body.expectedQuintals || 20));
    const seedsCost = Math.max(0, Number(req.body.seedsCost || 0));
    const fertilizerCost = Math.max(0, Number(req.body.fertilizerCost || 0));
    const labourCost = Math.max(0, Number(req.body.labourCost || 0));
    const irrigationCost = Math.max(0, Number(req.body.irrigationCost || 0));
    const otherCost = Math.max(0, Number(req.body.otherCost || 0));
    const sellingPricePerQuintal = Math.max(0, Number(req.body.sellingPricePerQuintal || 0));

    const totalCost = seedsCost + fertilizerCost + labourCost + irrigationCost + otherCost;
    const expectedRevenue = expectedQuintals * sellingPricePerQuintal;
    const estimatedProfit = expectedRevenue - totalCost;
    const costPerAcre = totalCost / areaAcres;
    const roiPercent = totalCost > 0 ? Number(((estimatedProfit / totalCost) * 100).toFixed(1)) : 0;

    const details = {
      seedsCost,
      fertilizerCost,
      labourCost,
      irrigationCost,
      otherCost,
      sellingPricePerQuintal,
      expectedQuintals,
      costPerAcre: Number(costPerAcre.toFixed(0)),
    };

    const result = db
      .prepare(
        `INSERT INTO profit_calculations (user_id, farm_id, crop_name, area_acres, total_cost, expected_revenue, estimated_profit, roi_percent, details_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user!.id,
        farmId,
        cropName,
        areaAcres,
        totalCost,
        expectedRevenue,
        estimatedProfit,
        roiPercent,
        JSON.stringify(details)
      );

    res.status(201).json({
      id: Number(result.lastInsertRowid),
      cropName,
      areaAcres,
      totalCost,
      expectedRevenue,
      estimatedProfit,
      costPerAcre: details.costPerAcre,
      roiPercent,
      details,
    });
  });

  app.get('/api/calendar', authMiddleware, (req: AuthedRequest, res) => {
    const farmId = req.query.farmId ? Number(req.query.farmId) : null;
    const rows = farmId
      ? db
          .prepare('SELECT * FROM farming_activities WHERE user_id = ? AND farm_id = ? ORDER BY due_date ASC')
          .all(req.user!.id, farmId)
      : db
          .prepare('SELECT * FROM farming_activities WHERE user_id = ? ORDER BY due_date ASC LIMIT 40')
          .all(req.user!.id);
    res.json({ activities: rows });
  });

  app.post('/api/calendar/generate', authMiddleware, (req: AuthedRequest, res) => {
    const farmId = Number(req.body.farmId);
    const cropName = String(req.body.cropName || 'maize');
    const sowingDate = String(req.body.sowingDate || new Date().toISOString().split('T')[0]);
    const farm = db.prepare('SELECT id FROM farms WHERE id = ? AND user_id = ?').get(farmId, req.user!.id);
    if (!farm) {
      res.status(404).json({ error: 'Select a valid farm first.' });
      return;
    }

    db.prepare('DELETE FROM farming_activities WHERE user_id = ? AND farm_id = ?').run(req.user!.id, farmId);
    const tasks = generateFarmingCalendar(cropName, sowingDate);
    const insertAct = db.prepare(
      `INSERT INTO farming_activities (user_id, farm_id, crop_name, stage, title, due_date, notes, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    );
    for (const t of tasks) {
      insertAct.run(req.user!.id, farmId, cropName, t.stage, t.title, t.dueDate, t.notes);
    }

    const rows = db
      .prepare('SELECT * FROM farming_activities WHERE user_id = ? AND farm_id = ? ORDER BY due_date ASC')
      .all(req.user!.id, farmId);
    res.json({ activities: rows });
  });

  app.patch('/api/calendar/:id', authMiddleware, (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const completed = req.body.completed ? 1 : 0;
    db.prepare('UPDATE farming_activities SET completed = ? WHERE id = ? AND user_id = ?').run(completed, id, req.user!.id);
    res.json({ success: true });
  });

  // --- AI Chatbot & Voice Assistant ---
  app.get('/api/chat', authMiddleware, (req: AuthedRequest, res) => {
    const messages = db
      .prepare('SELECT id, role, message, language, created_at FROM chat_history WHERE user_id = ? ORDER BY id ASC LIMIT 60')
      .all(req.user!.id);
    res.json({ messages });
  });

  app.delete('/api/chat', authMiddleware, (req: AuthedRequest, res) => {
    db.prepare('DELETE FROM chat_history WHERE user_id = ?').run(req.user!.id);
    res.json({ success: true });
  });

  app.post('/api/chat', authMiddleware, async (req: AuthedRequest, res) => {
    const message = String(req.body.message || '').trim();
    const language = String(req.body.language || req.user!.preferredLanguage || 'en');
    const farmId = req.body.farmId ? Number(req.body.farmId) : null;

    if (!message) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }

    let farmCtx: FarmContextSummary = {};
    const targetFarm = farmId
      ? getFarmBundle(farmId, req.user!.id)
      : (() => {
          const latest = db
            .prepare('SELECT id FROM farms WHERE user_id = ? ORDER BY id DESC LIMIT 1')
            .get(req.user!.id) as any;
          return latest ? getFarmBundle(latest.id, req.user!.id) : null;
        })();

    if (targetFarm) {
      farmCtx = {
        farmName: targetFarm.farm.farmName,
        location: targetFarm.farm.location,
        areaAcres: targetFarm.farm.areaAcres,
        nitrogen: targetFarm.farm.nitrogen,
        phosphorus: targetFarm.farm.phosphorus,
        potassium: targetFarm.farm.potassium,
        ph: targetFarm.farm.ph,
        temperature: targetFarm.farm.temperature,
        humidity: targetFarm.farm.humidity,
        rainfall: targetFarm.farm.rainfall,
        recommendedCrop: targetFarm.cropRecommendation.displayName,
        recommendedFertilizer: targetFarm.fertilizerRecommendation.recommendedFertilizer,
        irrigationLevel: targetFarm.irrigationPlan.level,
        predictedYieldTha: targetFarm.yieldPrediction.yieldTonnesPerHa,
        riskLevel: targetFarm.riskAssessment.overallLevel,
      };
    }

    const history = db
      .prepare('SELECT role, message FROM chat_history WHERE user_id = ? ORDER BY id DESC LIMIT 8')
      .all(req.user!.id) as Array<{ role: string; message: string }>;

    db.prepare('INSERT INTO chat_history (user_id, farm_id, role, message, language) VALUES (?, ?, ?, ?, ?)').run(
      req.user!.id,
      targetFarm?.farm.id || null,
      'user',
      message,
      language
    );

    const aiResult = await generateSmartFarmingReply(message, history.reverse(), farmCtx, language);

    db.prepare('INSERT INTO chat_history (user_id, farm_id, role, message, language) VALUES (?, ?, ?, ?, ?)').run(
      req.user!.id,
      targetFarm?.farm.id || null,
      'assistant',
      aiResult.reply,
      language
    );

    res.json({
      reply: aiResult.reply,
      usedGemini: aiResult.usedGemini,
      language,
    });
  });

  // --- Multilingual Translation & TTS ---
  app.post('/api/translate', authMiddleware, async (req, res) => {
    const texts: string[] = Array.isArray(req.body.texts) ? req.body.texts.slice(0, 25).map(String) : [];
    const targetLanguage = String(req.body.targetLanguage || 'en');
    const result = await translateDynamicTexts(texts, targetLanguage);
    res.json(result);
  });

  app.post('/api/tts', authMiddleware, async (req: AuthedRequest, res) => {
    const text = String(req.body.text || '').trim();
    const language = String(req.body.language || req.user!.preferredLanguage || 'en');
    if (!text) {
      res.status(400).json({ error: 'Text is required for speech playback.' });
      return;
    }
    const audio = await generateSpeechAudio(text, language);
    res.json(audio);
  });

  // --- Plant Disease Detection ---
  app.get('/api/disease/history', authMiddleware, (req: AuthedRequest, res) => {
    const scans = db
      .prepare('SELECT * FROM disease_scans WHERE user_id = ? ORDER BY id DESC LIMIT 10')
      .all(req.user!.id);
    res.json({ scans });
  });

  app.post('/api/disease/analyze', authMiddleware, (req: AuthedRequest, res) => {
    upload.single('leafImage')(req, res, async (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Image upload failed.' });
        return;
      }

      const language = String(req.body?.language || req.user!.preferredLanguage || 'en');
      let base64Image = '';
      let mimeType = 'image/jpeg';
      let storedPath = '';

      if (req.file) {
        base64Image = fs.readFileSync(req.file.path).toString('base64');
        mimeType = req.file.mimetype;
        storedPath = `/uploads/${req.file.filename}`;
      } else if (req.body?.sampleImagePath) {
        // Allow evaluating bundled generated leaf sample image cleanly
        const rel = String(req.body.sampleImagePath).replace(/^\/+/, '');
        const safePath = path.resolve(config.rootDir, rel);
        if (!safePath.startsWith(path.resolve(config.rootDir, 'src', 'assets', 'images')) || !fs.existsSync(safePath)) {
          res.status(400).json({ error: 'Sample leaf image not found.' });
          return;
        }
        base64Image = fs.readFileSync(safePath).toString('base64');
        mimeType = 'image/jpeg';
        storedPath = `/${rel}`;
      } else {
        res.status(400).json({ error: 'Please upload a crop leaf photograph (JPG, PNG, or WEBP).' });
        return;
      }

      const diagnosis = await analyzeLeafImage(base64Image, mimeType, language);
      db.prepare(
        `INSERT INTO disease_scans (user_id, image_path, crop_name, predicted_disease, confidence, details_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        req.user!.id,
        storedPath,
        diagnosis.crop,
        diagnosis.predictedDisease,
        diagnosis.confidence,
        JSON.stringify(diagnosis)
      );

      res.json({ ...diagnosis, imagePath: storedPath });
    });
  });

  // --- Downloadable PDF, CSV & Project Archive ---
  app.get('/api/reports/:farmId/pdf', authMiddleware, async (req: AuthedRequest, res) => {
    const farmId = Number(req.params.farmId);
    const bundle = getFarmBundle(farmId, req.user!.id);
    if (!bundle) {
      res.status(404).json({ error: 'Farm analysis not found.' });
      return;
    }

    const latestProfit = db
      .prepare('SELECT * FROM profit_calculations WHERE user_id = ? AND farm_id = ? ORDER BY id DESC LIMIT 1')
      .get(req.user!.id, farmId) as any;

    const { fileName, buffer } = await generateFarmPdfReport({
      farmerName: req.user!.fullName,
      farmerEmail: req.user!.email,
      farmName: bundle.farm.farmName,
      location: bundle.farm.location,
      areaAcres: bundle.farm.areaAcres,
      nitrogen: bundle.farm.nitrogen,
      phosphorus: bundle.farm.phosphorus,
      potassium: bundle.farm.potassium,
      ph: bundle.farm.ph,
      temperature: bundle.farm.temperature,
      humidity: bundle.farm.humidity,
      rainfall: bundle.farm.rainfall,
      soilHealthScore: bundle.farm.soilHealthScore,
      cropRecommendation: bundle.cropRecommendation,
      fertilizerRecommendation: bundle.fertilizerRecommendation,
      irrigationPlan: bundle.irrigationPlan,
      yieldPrediction: bundle.yieldPrediction,
      riskAssessment: bundle.riskAssessment,
      profitEstimate: latestProfit
        ? {
            totalCost: latestProfit.total_cost,
            expectedRevenue: latestProfit.expected_revenue,
            estimatedProfit: latestProfit.estimated_profit,
            roiPercent: latestProfit.roi_percent,
          }
        : undefined,
    });

    db.prepare('INSERT INTO farm_reports (user_id, farm_id, report_type, file_name) VALUES (?, ?, ?, ?)').run(
      req.user!.id,
      farmId,
      'PDF',
      fileName
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  });

  app.get('/api/reports/:farmId/csv', authMiddleware, (req: AuthedRequest, res) => {
    const farmId = Number(req.params.farmId);
    const bundle = getFarmBundle(farmId, req.user!.id);
    if (!bundle) {
      res.status(404).json({ error: 'Farm analysis not found.' });
      return;
    }

    const rows = [
      ['Metric', 'Value', 'Unit / Notes'],
      ['Farmer Name', req.user!.fullName, ''],
      ['Farm Name', bundle.farm.farmName, ''],
      ['Location', bundle.farm.location, ''],
      ['Land Area', String(bundle.farm.areaAcres), 'acres'],
      ['Nitrogen (N)', String(bundle.farm.nitrogen), 'kg/ha'],
      ['Phosphorus (P)', String(bundle.farm.phosphorus), 'kg/ha'],
      ['Potassium (K)', String(bundle.farm.potassium), 'kg/ha'],
      ['Soil pH', String(bundle.farm.ph), 'pH scale'],
      ['Indicative Soil Health Score', String(bundle.farm.soilHealthScore), '/100 (Indicative)'],
      ['Temperature', String(bundle.farm.temperature), 'deg C'],
      ['Humidity', String(bundle.farm.humidity), '%'],
      ['Rainfall', String(bundle.farm.rainfall), 'mm'],
      ['Recommended Crop', bundle.cropRecommendation.displayName, `Suitability ${bundle.cropRecommendation.confidenceScore}%`],
      ['Recommended Fertilizer', bundle.fertilizerRecommendation.recommendedFertilizer, ''],
      ['Irrigation Requirement', bundle.irrigationPlan.level, `${bundle.irrigationPlan.estimatedWeeklyMm} mm/week`],
      ['Predicted Yield (per ha)', String(bundle.yieldPrediction.yieldTonnesPerHa), 'tonnes/ha'],
      ['Predicted Yield (per acre)', String(bundle.yieldPrediction.yieldQuintalsPerAcre), 'quintals/acre'],
      ['Total Estimated Production', String(bundle.yieldPrediction.totalEstimatedTonnes), 'tonnes'],
      ['Risk Level', bundle.riskAssessment.overallLevel, `Score ${bundle.riskAssessment.riskScore}/100`],
    ];

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const fileName = `agrisense_farm_${farmId}.csv`;
    db.prepare('INSERT INTO farm_reports (user_id, farm_id, report_type, file_name) VALUES (?, ?, ?, ?)').run(
      req.user!.id,
      farmId,
      'CSV',
      fileName
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);
  });

  app.get('/api/reports/export-zip', authMiddleware, async (req: AuthedRequest, res) => {
    const zip = new JSZip();
    const farms = db.prepare('SELECT id FROM farms WHERE user_id = ?').all(req.user!.id) as Array<{ id: number }>;
    const bundles = farms.map((f) => getFarmBundle(f.id, req.user!.id)).filter(Boolean);
    zip.file('farm_analyses.json', JSON.stringify(bundles, null, 2));

    for (const csvName of ['crop_recommendation.csv', 'fertilizer_recommendation.csv', 'yield_prediction.csv']) {
      const p = path.join(config.datasetsDir, csvName);
      if (fs.existsSync(p)) {
        zip.file(`datasets/${csvName}`, fs.readFileSync(p, 'utf-8'));
      }
    }
    if (fs.existsSync(path.join(config.rootDir, 'README.md'))) {
      zip.file('README.md', fs.readFileSync(path.join(config.rootDir, 'README.md'), 'utf-8'));
    }

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="agrisense_farm_package.zip"');
    res.send(buf);
  });

  // --- Vite / Static Frontend ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(config.rootDir, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(config.rootDir, 'dist', 'index.html'));
    });
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`AgriSense server running on http://localhost:${config.port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AgriSense server:', err);
  process.exit(1);
});
