import fs from 'fs';
import path from 'path';
import { config } from '../config.ts';

// Deterministic PRNG so datasets are 100% reproducible and clean
function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function randRange(rng: () => number, min: number, max: number, decimals = 1): number {
  const val = min + rng() * (max - min);
  return Number(val.toFixed(decimals));
}

interface CropSpec {
  name: string;
  n: [number, number];
  p: [number, number];
  k: [number, number];
  temp: [number, number];
  humidity: [number, number];
  ph: [number, number];
  rainfall: [number, number];
  baseYieldTha: number; // realistic tonnes/hectare
}

const CROP_SPECS: CropSpec[] = [
  { name: 'rice', n: [60, 99], p: [35, 60], k: [35, 45], temp: [20, 27], humidity: [80, 86], ph: [5.0, 7.6], rainfall: [182, 298], baseYieldTha: 4.8 },
  { name: 'maize', n: [60, 100], p: [35, 60], k: [15, 25], temp: [18, 27], humidity: [55, 74], ph: [5.5, 7.0], rainfall: [60, 110], baseYieldTha: 5.4 },
  { name: 'chickpea', n: [20, 60], p: [55, 80], k: [75, 85], temp: [17, 21], humidity: [14, 20], ph: [6.0, 8.6], rainfall: [65, 95], baseYieldTha: 1.9 },
  { name: 'kidneybeans', n: [0, 40], p: [55, 80], k: [15, 25], temp: [15, 24], humidity: [18, 25], ph: [5.5, 6.0], rainfall: [60, 150], baseYieldTha: 2.1 },
  { name: 'pigeonpeas', n: [0, 40], p: [55, 80], k: [15, 25], temp: [18, 36], humidity: [30, 69], ph: [4.6, 7.4], rainfall: [90, 198], baseYieldTha: 1.7 },
  { name: 'mothbeans', n: [0, 40], p: [35, 60], k: [15, 25], temp: [24, 32], humidity: [40, 65], ph: [3.6, 9.2], rainfall: [30, 74], baseYieldTha: 1.2 },
  { name: 'mungbean', n: [0, 40], p: [35, 60], k: [15, 25], temp: [27, 30], humidity: [80, 90], ph: [6.2, 7.2], rainfall: [36, 59], baseYieldTha: 1.4 },
  { name: 'blackgram', n: [20, 60], p: [55, 80], k: [15, 25], temp: [25, 35], humidity: [60, 70], ph: [6.5, 7.8], rainfall: [60, 75], baseYieldTha: 1.3 },
  { name: 'lentil', n: [0, 40], p: [55, 80], k: [15, 25], temp: [18, 29], humidity: [60, 70], ph: [5.9, 7.8], rainfall: [35, 55], baseYieldTha: 1.5 },
  { name: 'pomegranate', n: [0, 40], p: [5, 30], k: [35, 45], temp: [18, 25], humidity: [85, 95], ph: [5.6, 7.2], rainfall: [102, 112], baseYieldTha: 12.5 },
  { name: 'banana', n: [80, 120], p: [70, 95], k: [45, 55], temp: [25, 30], humidity: [75, 85], ph: [5.5, 6.5], rainfall: [90, 120], baseYieldTha: 34.0 },
  { name: 'mango', n: [0, 40], p: [15, 40], k: [25, 35], temp: [27, 36], humidity: [45, 55], ph: [4.5, 6.9], rainfall: [89, 101], baseYieldTha: 11.2 },
  { name: 'grapes', n: [0, 40], p: [120, 145], k: [195, 205], temp: [8, 41], humidity: [80, 84], ph: [5.5, 6.5], rainfall: [65, 75], baseYieldTha: 18.4 },
  { name: 'watermelon', n: [80, 120], p: [5, 30], k: [45, 55], temp: [24, 27], humidity: [80, 90], ph: [6.0, 7.0], rainfall: [40, 60], baseYieldTha: 26.0 },
  { name: 'muskmelon', n: [80, 120], p: [5, 30], k: [45, 55], temp: [27, 30], humidity: [90, 95], ph: [6.0, 6.8], rainfall: [20, 30], baseYieldTha: 21.5 },
  { name: 'apple', n: [0, 40], p: [120, 145], k: [195, 205], temp: [21, 24], humidity: [90, 95], ph: [5.5, 6.5], rainfall: [100, 125], baseYieldTha: 16.0 },
  { name: 'orange', n: [0, 40], p: [5, 30], k: [5, 15], temp: [10, 34], humidity: [90, 95], ph: [6.0, 8.0], rainfall: [100, 120], baseYieldTha: 14.5 },
  { name: 'papaya', n: [30, 70], p: [45, 70], k: [45, 55], temp: [23, 43], humidity: [90, 95], ph: [6.5, 7.0], rainfall: [40, 245], baseYieldTha: 42.0 },
  { name: 'coconut', n: [0, 40], p: [5, 30], k: [25, 35], temp: [25, 30], humidity: [90, 100], ph: [5.5, 6.5], rainfall: [131, 225], baseYieldTha: 9.8 },
  { name: 'cotton', n: [100, 140], p: [35, 60], k: [15, 25], temp: [22, 26], humidity: [75, 85], ph: [5.8, 8.0], rainfall: [60, 100], baseYieldTha: 2.6 },
  { name: 'jute', n: [60, 100], p: [35, 60], k: [35, 45], temp: [23, 27], humidity: [70, 90], ph: [6.0, 7.5], rainfall: [150, 200], baseYieldTha: 2.8 },
  { name: 'coffee', n: [80, 120], p: [15, 40], k: [25, 35], temp: [23, 28], humidity: [50, 70], ph: [6.0, 7.5], rainfall: [115, 199], baseYieldTha: 1.9 },
];

export function ensureDatasetsExist(): void {
  fs.mkdirSync(config.datasetsDir, { recursive: true });
  const cropCsvPath = path.join(config.datasetsDir, 'crop_recommendation.csv');
  const fertCsvPath = path.join(config.datasetsDir, 'fertilizer_recommendation.csv');
  const yieldCsvPath = path.join(config.datasetsDir, 'yield_prediction.csv');

  if (!fs.existsSync(cropCsvPath)) {
    const rng = createRng(4201);
    const rows = ['N,P,K,temperature,humidity,ph,rainfall,label'];
    for (const spec of CROP_SPECS) {
      for (let i = 0; i < 35; i++) {
        const n = Math.round(randRange(rng, spec.n[0], spec.n[1], 0));
        const p = Math.round(randRange(rng, spec.p[0], spec.p[1], 0));
        const k = Math.round(randRange(rng, spec.k[0], spec.k[1], 0));
        const temp = randRange(rng, spec.temp[0], spec.temp[1], 2);
        const hum = randRange(rng, spec.humidity[0], spec.humidity[1], 2);
        const ph = randRange(rng, spec.ph[0], spec.ph[1], 2);
        const rain = randRange(rng, spec.rainfall[0], spec.rainfall[1], 2);
        rows.push(`${n},${p},${k},${temp},${hum},${ph},${rain},${spec.name}`);
      }
    }
    fs.writeFileSync(cropCsvPath, rows.join('\n'), 'utf-8');
  }

  if (!fs.existsSync(fertCsvPath)) {
    const rng = createRng(9107);
    const rows = ['N,P,K,ph,moisture,crop_group,fertilizer'];
    const fertProfiles = [
      { fert: 'Urea (46-0-0)', n: [5, 38], p: [30, 65], k: [25, 60], ph: [5.5, 7.5], moist: [35, 75], group: 'cereal' },
      { fert: 'DAP (18-46-0)', n: [35, 80], p: [5, 25], k: [25, 60], ph: [5.5, 7.5], moist: [30, 70], group: 'pulse' },
      { fert: 'MOP (0-0-60)', n: [40, 85], p: [30, 65], k: [5, 18], ph: [5.5, 7.5], moist: [35, 75], group: 'fruit' },
      { fert: 'NPK 28-28-0', n: [10, 40], p: [10, 28], k: [30, 65], ph: [5.8, 7.4], moist: [30, 70], group: 'cereal' },
      { fert: 'NPK 14-35-14', n: [35, 75], p: [8, 25], k: [10, 28], ph: [5.5, 7.2], moist: [35, 70], group: 'cash' },
      { fert: 'NPK 10-26-26', n: [45, 90], p: [10, 26], k: [10, 25], ph: [5.8, 7.5], moist: [35, 75], group: 'horticulture' },
      { fert: 'NPK 19-19-19 Balanced', n: [35, 60], p: [30, 50], k: [25, 45], ph: [6.0, 7.3], moist: [40, 75], group: 'general' },
      { fert: 'Agricultural Lime + Compost', n: [30, 70], p: [25, 55], k: [25, 55], ph: [4.0, 5.3], moist: [35, 75], group: 'acidic' },
      { fert: 'Gypsum + Organic Matter', n: [30, 70], p: [25, 55], k: [25, 55], ph: [7.8, 9.2], moist: [30, 70], group: 'alkaline' },
    ];
    for (const prof of fertProfiles) {
      for (let i = 0; i < 32; i++) {
        const n = Math.round(randRange(rng, prof.n[0], prof.n[1], 0));
        const p = Math.round(randRange(rng, prof.p[0], prof.p[1], 0));
        const k = Math.round(randRange(rng, prof.k[0], prof.k[1], 0));
        const ph = randRange(rng, prof.ph[0], prof.ph[1], 2);
        const moist = randRange(rng, prof.moist[0], prof.moist[1], 1);
        rows.push(`${n},${p},${k},${ph},${moist},${prof.group},${prof.fert}`);
      }
    }
    fs.writeFileSync(fertCsvPath, rows.join('\n'), 'utf-8');
  }

  if (!fs.existsSync(yieldCsvPath)) {
    const rng = createRng(7731);
    const rows = ['crop,N,P,K,temperature,humidity,ph,rainfall,area_acres,yield_tonnes_per_ha'];
    for (const spec of CROP_SPECS) {
      const optN = (spec.n[0] + spec.n[1]) / 2;
      const optP = (spec.p[0] + spec.p[1]) / 2;
      const optK = (spec.k[0] + spec.k[1]) / 2;
      const optT = (spec.temp[0] + spec.temp[1]) / 2;
      const optPh = (spec.ph[0] + spec.ph[1]) / 2;
      const optR = (spec.rainfall[0] + spec.rainfall[1]) / 2;

      for (let i = 0; i < 24; i++) {
        const n = randRange(rng, Math.max(0, spec.n[0] - 20), spec.n[1] + 20, 1);
        const p = randRange(rng, Math.max(5, spec.p[0] - 15), spec.p[1] + 15, 1);
        const k = randRange(rng, Math.max(5, spec.k[0] - 15), spec.k[1] + 15, 1);
        const temp = randRange(rng, spec.temp[0] - 3, spec.temp[1] + 3, 1);
        const hum = randRange(rng, Math.max(12, spec.humidity[0] - 10), Math.min(98, spec.humidity[1] + 8), 1);
        const ph = randRange(rng, Math.max(4.2, spec.ph[0] - 0.8), Math.min(8.8, spec.ph[1] + 0.8), 2);
        const rain = randRange(rng, Math.max(15, spec.rainfall[0] * 0.7), spec.rainfall[1] * 1.25, 1);
        const area = randRange(rng, 1.0, 25.0, 1);

        // Agronomic response curve: nutrient adequacy + thermal/pH/water penalties + small natural noise
        const nFactor = 1 - Math.min(0.28, Math.abs(n - optN) / Math.max(40, optN * 2.2));
        const pFactor = 1 - Math.min(0.20, Math.abs(p - optP) / Math.max(35, optP * 2.4));
        const kFactor = 1 - Math.min(0.18, Math.abs(k - optK) / Math.max(35, optK * 2.4));
        const phPenalty = Math.max(0.72, 1 - Math.abs(ph - optPh) * 0.11);
        const tempPenalty = Math.max(0.74, 1 - Math.abs(temp - optT) * 0.025);
        const rainPenalty = Math.max(0.70, 1 - Math.abs(rain - optR) / Math.max(120, optR * 2.8));
        const noise = randRange(rng, 0.96, 1.04, 3);

        const y = Math.max(
          0.4,
          Number((spec.baseYieldTha * (0.35 + 0.65 * nFactor * pFactor * kFactor) * phPenalty * tempPenalty * rainPenalty * noise).toFixed(2))
        );
        rows.push(`${spec.name},${n},${p},${k},${temp},${hum},${ph},${rain},${area},${y}`);
      }
    }
    fs.writeFileSync(yieldCsvPath, rows.join('\n'), 'utf-8');
  }
}

export { CROP_SPECS };
