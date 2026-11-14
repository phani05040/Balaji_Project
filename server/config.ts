import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY || '',
  sessionSecret: process.env.SESSION_SECRET || 'agrisense-fallback-secret-key-2026',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  rootDir: process.cwd(),
  dbPath: path.join(process.cwd(), 'database', 'database.db'),
  datasetsDir: path.join(process.cwd(), 'datasets'),
  trainedModelsDir: path.join(process.cwd(), 'trained_models'),
  uploadsDir: path.join(process.cwd(), 'static', 'uploads'),
  reportsDir: path.join(process.cwd(), 'reports'),
  maxUploadBytes: 5 * 1024 * 1024, // 5 MB strict limit
};
