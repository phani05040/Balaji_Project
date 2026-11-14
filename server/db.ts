import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { config } from './config.ts';
import {
  assessRisks,
  computeSoilHealth,
  generateFarmingCalendar,
  planIrrigation,
  predictYield,
  recommendCrop,
  recommendFertilizer,
} from './ml/inference.ts';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.mkdirSync(config.reportsDir, { recursive: true });

  const db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      location TEXT DEFAULT 'Guntur, Andhra Pradesh',
      preferred_language TEXT DEFAULT 'en',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS farms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      farm_name TEXT NOT NULL,
      location TEXT NOT NULL,
      area_acres REAL NOT NULL,
      nitrogen REAL NOT NULL,
      phosphorus REAL NOT NULL,
      potassium REAL NOT NULL,
      ph REAL NOT NULL,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      rainfall REAL NOT NULL,
      soil_health_score INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS crop_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      farm_id INTEGER NOT NULL,
      recommended_crop TEXT NOT NULL,
      confidence_score REAL NOT NULL,
      alternatives_json TEXT NOT NULL,
      explanation TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fertilizer_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      farm_id INTEGER NOT NULL,
      crop_name TEXT NOT NULL,
      recommended_fertilizer TEXT NOT NULL,
      confidence_score REAL NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS irrigation_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      farm_id INTEGER NOT NULL,
      crop_name TEXT NOT NULL,
      irrigation_level TEXT NOT NULL,
      weekly_mm REAL NOT NULL,
      seasonal_mm REAL NOT NULL,
      liters_per_week REAL NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS yield_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      farm_id INTEGER NOT NULL,
      crop_name TEXT NOT NULL,
      yield_tonnes_per_ha REAL NOT NULL,
      yield_quintals_per_acre REAL NOT NULL,
      total_tonnes REAL NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS risk_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      farm_id INTEGER NOT NULL,
      crop_name TEXT NOT NULL,
      overall_level TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      farm_id INTEGER,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      language TEXT DEFAULT 'en',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS farm_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      farm_id INTEGER NOT NULL,
      report_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS farming_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      farm_id INTEGER NOT NULL,
      crop_name TEXT NOT NULL,
      stage TEXT NOT NULL,
      title TEXT NOT NULL,
      due_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS disease_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      predicted_disease TEXT NOT NULL,
      confidence REAL NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profit_calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      farm_id INTEGER,
      crop_name TEXT NOT NULL,
      area_acres REAL NOT NULL,
      total_cost REAL NOT NULL,
      expected_revenue REAL NOT NULL,
      estimated_profit REAL NOT NULL,
      roi_percent REAL NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  seedInitialData(db);
  dbInstance = db;
  return db;
}

function seedInitialData(db: Database.Database) {
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount > 0) return;

  const hash = bcrypt.hashSync('Farmer@2026', 10);

  const insertUser = db.prepare(
    `INSERT INTO users (full_name, username, email, password_hash, location, preferred_language)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const u1 = insertUser.run('Arjun Reddy', 'arjun_farmer', 'arjun@greenfield.ag', hash, 'Guntur, Andhra Pradesh', 'en');
  const u2 = insertUser.run('Lakshmi Devi', 'lakshmi_ag', 'lakshmi@agrisense.in', hash, 'Coimbatore, Tamil Nadu', 'ta');

  const demoFarms = [
    {
      userId: Number(u1.lastInsertRowid),
      farmName: 'North Canal Plot',
      location: 'Guntur, Andhra Pradesh',
      areaAcres: 4.5,
      nitrogen: 82,
      phosphorus: 48,
      potassium: 40,
      ph: 6.4,
      temperature: 25.5,
      humidity: 82,
      rainfall: 215,
    },
    {
      userId: Number(u1.lastInsertRowid),
      farmName: 'Red Loam Upland',
      location: 'Guntur, Andhra Pradesh',
      areaAcres: 3.0,
      nitrogen: 74,
      phosphorus: 44,
      potassium: 20,
      ph: 6.2,
      temperature: 24.0,
      humidity: 66,
      rainfall: 88,
    },
    {
      userId: Number(u2.lastInsertRowid),
      farmName: 'Black Cotton Block',
      location: 'Coimbatore, Tamil Nadu',
      areaAcres: 6.0,
      nitrogen: 118,
      phosphorus: 46,
      potassium: 22,
      ph: 7.2,
      temperature: 24.8,
      humidity: 78,
      rainfall: 78,
    },
  ];

  for (const f of demoFarms) {
    const health = computeSoilHealth(f);
    const farmRes = db
      .prepare(
        `INSERT INTO farms (user_id, farm_name, location, area_acres, nitrogen, phosphorus, potassium, ph, temperature, humidity, rainfall, soil_health_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        f.userId,
        f.farmName,
        f.location,
        f.areaAcres,
        f.nitrogen,
        f.phosphorus,
        f.potassium,
        f.ph,
        f.temperature,
        f.humidity,
        f.rainfall,
        health.score
      );
    const farmId = Number(farmRes.lastInsertRowid);
    const cropRec = recommendCrop(f);
    const fertRec = recommendFertilizer(f, cropRec.recommendedCrop);
    const irrRec = planIrrigation(f, cropRec.recommendedCrop);
    const yieldRec = predictYield(f, cropRec.recommendedCrop);
    const riskRec = assessRisks(f, cropRec.recommendedCrop);

    db.prepare(
      `INSERT INTO crop_recommendations (user_id, farm_id, recommended_crop, confidence_score, alternatives_json, explanation)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(f.userId, farmId, cropRec.recommendedCrop, cropRec.confidenceScore, JSON.stringify(cropRec.alternatives), cropRec.explanation);

    db.prepare(
      `INSERT INTO fertilizer_recommendations (user_id, farm_id, crop_name, recommended_fertilizer, confidence_score, details_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(f.userId, farmId, cropRec.recommendedCrop, fertRec.recommendedFertilizer, fertRec.confidenceScore, JSON.stringify(fertRec));

    db.prepare(
      `INSERT INTO irrigation_results (user_id, farm_id, crop_name, irrigation_level, weekly_mm, seasonal_mm, liters_per_week, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(f.userId, farmId, cropRec.recommendedCrop, irrRec.level, irrRec.estimatedWeeklyMm, irrRec.estimatedSeasonalMm, irrRec.estimatedTotalLitersPerWeek, JSON.stringify(irrRec));

    db.prepare(
      `INSERT INTO yield_predictions (user_id, farm_id, crop_name, yield_tonnes_per_ha, yield_quintals_per_acre, total_tonnes, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(f.userId, farmId, cropRec.recommendedCrop, yieldRec.yieldTonnesPerHa, yieldRec.yieldQuintalsPerAcre, yieldRec.totalEstimatedTonnes, JSON.stringify(yieldRec));

    db.prepare(
      `INSERT INTO risk_assessments (user_id, farm_id, crop_name, overall_level, risk_score, details_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(f.userId, farmId, cropRec.recommendedCrop, riskRec.overallLevel, riskRec.riskScore, JSON.stringify(riskRec));

    const calendar = generateFarmingCalendar(cropRec.recommendedCrop, new Date().toISOString().split('T')[0]);
    const insertAct = db.prepare(
      `INSERT INTO farming_activities (user_id, farm_id, crop_name, stage, title, due_date, notes, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    calendar.forEach((task, idx) => {
      insertAct.run(f.userId, farmId, cropRec.recommendedCrop, task.stage, task.title, task.dueDate, task.notes, idx === 0 ? 1 : 0);
    });
  }
}
