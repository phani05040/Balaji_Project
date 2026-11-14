import { CROP_PROFILES } from './agronomyKnowledge.ts';
import {
  predictRegressionTree,
  predictTreeProbs,
  trainOrLoadModels,
  TrainedModelsBundle,
} from './trainer.ts';

export interface FarmInput {
  location: string;
  areaAcres: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  temperature: number;
  humidity: number;
  rainfall: number;
  moisture?: number;
}

export interface CropAlternative {
  crop: string;
  displayName: string;
  suitabilityScore: number;
  category: string;
  season: string;
  durationDays: number;
}

export interface CropRecommendationOutput {
  recommendedCrop: string;
  displayName: string;
  confidenceScore: number;
  alternatives: CropAlternative[];
  explanation: string;
  reasons: string[];
  cultivationGuide: {
    season: string;
    durationDays: number;
    spacing: string;
    guide: string;
    harvestSigns: string;
  };
  modelMetrics: TrainedModelsBundle['cropModel']['metrics'];
}

export interface FertilizerRecommendationOutput {
  crop: string;
  recommendedFertilizer: string;
  confidenceScore: number;
  nutrientStatus: {
    nitrogen: { value: number; status: 'Deficient' | 'Optimal' | 'Excess'; targetRange: string };
    phosphorus: { value: number; status: 'Deficient' | 'Optimal' | 'Excess'; targetRange: string };
    potassium: { value: number; status: 'Deficient' | 'Optimal' | 'Excess'; targetRange: string };
    ph: { value: number; status: 'Acidic' | 'Optimal' | 'Alkaline'; targetRange: string };
  };
  explanation: string;
  applicationGuidance: string[];
  chemicalAlternatives: string[];
  organicAlternatives: string[];
  responsibleUsageNote: string;
}

export interface IrrigationPlanOutput {
  crop: string;
  level: 'LOW' | 'MODERATE' | 'HIGH';
  estimatedWeeklyMm: number;
  estimatedSeasonalMm: number;
  estimatedTotalLitersPerWeek: number;
  waterDeficitMm: number;
  explanation: string;
  waterManagementAdvice: string[];
  waterSavingTechniques: string[];
}

export interface YieldPredictionOutput {
  crop: string;
  displayName: string;
  areaAcres: number;
  areaHectares: number;
  yieldTonnesPerHa: number;
  yieldQuintalsPerAcre: number;
  totalEstimatedTonnes: number;
  totalEstimatedQuintals: number;
  explanation: string;
  limitingFactors: Array<{ factor: string; impact: 'Positive' | 'Neutral' | 'Limiting'; detail: string }>;
  cropComparisons: Array<{
    crop: string;
    displayName: string;
    yieldTonnesPerHa: number;
    yieldQuintalsPerAcre: number;
    totalTonnes: number;
  }>;
  modelMetrics: TrainedModelsBundle['yieldModel']['metrics'];
}

export interface RiskItem {
  factor: string;
  level: 'LOW' | 'MODERATE' | 'HIGH';
  reason: string;
  correctiveAction: string;
}

export interface RiskAssessmentOutput {
  overallLevel: 'LOW' | 'MODERATE' | 'HIGH';
  riskScore: number; // 0-100 where higher is higher risk
  factors: RiskItem[];
  preventivePractices: string[];
  managementSummary: string;
}

export interface SoilHealthOutput {
  score: number; // 0-100 indicative
  rating: 'Needs Improvement' | 'Fair' | 'Good' | 'Optimal';
  breakdown: {
    nitrogenScore: number;
    phosphorusScore: number;
    potassiumScore: number;
    phScore: number;
  };
  suggestions: string[];
  disclaimer: string;
}

function getProfile(crop: string) {
  return CROP_PROFILES[crop.toLowerCase()] || CROP_PROFILES['maize'];
}

export function recommendCrop(input: FarmInput): CropRecommendationOutput {
  const bundle = trainOrLoadModels();
  const x = [
    input.nitrogen,
    input.phosphorus,
    input.potassium,
    input.temperature,
    input.humidity,
    input.ph,
    input.rainfall,
  ];

  const probSum: Record<string, number> = {};
  const nTrees = bundle.cropModel.trees.length || 1;
  for (const tree of bundle.cropModel.trees) {
    const probs = predictTreeProbs(tree, x);
    for (const [cls, p] of Object.entries(probs)) {
      probSum[cls] = (probSum[cls] || 0) + p / nTrees;
    }
  }

  // Blend RF probability with mild agronomic distance tie-breaker so sparse edge cases rank meaningfully
  const ranked = Object.keys(CROP_PROFILES)
    .map((crop) => {
      const rfProb = probSum[crop] || 0;
      const prof = getProfile(crop);
      const nDist = distanceToRange(input.nitrogen, prof.idealN) / 50;
      const pDist = distanceToRange(input.phosphorus, prof.idealP) / 50;
      const kDist = distanceToRange(input.potassium, prof.idealK) / 60;
      const phDist = distanceToRange(input.ph, prof.idealPh) / 1.5;
      const tempDist = distanceToRange(input.temperature, prof.idealTemp) / 8;
      const rainDist = distanceToRange(input.rainfall, prof.idealRainfall) / 80;
      const agFit = Math.exp(-(nDist + pDist + kDist + phDist + tempDist + rainDist) * 0.45);
      const combined = 0.78 * rfProb + 0.22 * agFit;
      return { crop, rfProb, agFit, combined };
    })
    .sort((a, b) => b.combined - a.combined);

  const top = ranked[0];
  const topProfile = getProfile(top.crop);
  const topScore = Math.min(99, Math.max(42, Math.round((top.rfProb * 0.75 + top.agFit * 0.25) * 100)));

  const maxComb = ranked[0].combined || 1;
  const alternatives: CropAlternative[] = ranked.slice(0, 5).map((item, idx) => {
    const prof = getProfile(item.crop);
    const score =
      idx === 0
        ? topScore
        : Math.min(topScore - 2, Math.max(25, Math.round((item.combined / maxComb) * topScore)));
    return {
      crop: item.crop,
      displayName: prof.displayName,
      suitabilityScore: score,
      category: prof.category,
      season: prof.season,
      durationDays: prof.durationDays,
    };
  });

  const reasons: string[] = [];
  if (input.nitrogen >= topProfile.idealN[0] && input.nitrogen <= topProfile.idealN[1]) {
    reasons.push(`Nitrogen (${input.nitrogen} kg/ha) aligns well with ${topProfile.displayName}'s optimal range (${topProfile.idealN[0]}–${topProfile.idealN[1]} kg/ha).`);
  } else {
    reasons.push(`Nitrogen (${input.nitrogen} kg/ha) is workable for ${topProfile.displayName} with targeted nutrient management (ideal ${topProfile.idealN[0]}–${topProfile.idealN[1]} kg/ha).`);
  }
  if (input.ph >= topProfile.idealPh[0] && input.ph <= topProfile.idealPh[1]) {
    reasons.push(`Soil pH (${input.ph}) sits squarely inside the preferred ${topProfile.idealPh[0]}–${topProfile.idealPh[1]} window.`);
  } else {
    reasons.push(`Soil pH (${input.ph}) is slightly outside the ideal ${topProfile.idealPh[0]}–${topProfile.idealPh[1]} range and should be buffered.`);
  }
  reasons.push(
    `Local temperature (${input.temperature}°C) and seasonal rainfall (${input.rainfall} mm) match ${topProfile.season} growing conditions.`
  );

  return {
    recommendedCrop: top.crop,
    displayName: topProfile.displayName,
    confidenceScore: topScore,
    alternatives,
    explanation: `Our Random Forest model (evaluated at ${bundle.cropModel.metrics.accuracy}% test accuracy) selected ${topProfile.displayName} because your soil NPK profile (${input.nitrogen}-${input.phosphorus}-${input.potassium}), pH ${input.ph}, and climate (${input.temperature}°C, ${input.humidity}% RH, ${input.rainfall} mm rainfall) closely align with high-performing ${topProfile.displayName} agronomic records.`,
    reasons,
    cultivationGuide: {
      season: topProfile.season,
      durationDays: topProfile.durationDays,
      spacing: topProfile.spacing,
      guide: topProfile.cultivationGuide,
      harvestSigns: topProfile.harvestSigns,
    },
    modelMetrics: bundle.cropModel.metrics,
  };
}

function distanceToRange(val: number, [min, max]: [number, number]): number {
  if (val < min) return min - val;
  if (val > max) return val - max;
  return 0;
}

export function recommendFertilizer(input: FarmInput, cropName: string): FertilizerRecommendationOutput {
  const bundle = trainOrLoadModels();
  const prof = getProfile(cropName);
  const moisture = input.moisture ?? Math.min(85, Math.max(25, input.humidity * 0.72));
  const x = [input.nitrogen, input.phosphorus, input.potassium, input.ph, moisture];

  const probSum: Record<string, number> = {};
  const nTrees = bundle.fertilizerModel.trees.length || 1;
  for (const tree of bundle.fertilizerModel.trees) {
    const probs = predictTreeProbs(tree, x);
    for (const [cls, p] of Object.entries(probs)) {
      probSum[cls] = (probSum[cls] || 0) + p / nTrees;
    }
  }

  const ranked = Object.entries(probSum).sort((a, b) => b[1] - a[1]);
  let topFert = ranked[0]?.[0] || 'NPK 19-19-19 Balanced';
  const rawConf = ranked[0]?.[1] || 0.7;

  // Enforce pH safety override if strongly acidic or alkaline
  if (input.ph < 5.3) {
    topFert = 'Agricultural Lime + Compost';
  } else if (input.ph > 8.0) {
    topFert = 'Gypsum + Organic Matter';
  }

  const nStatus =
    input.nitrogen < prof.idealN[0]
      ? 'Deficient'
      : input.nitrogen > prof.idealN[1] + 20
      ? 'Excess'
      : 'Optimal';
  const pStatus =
    input.phosphorus < prof.idealP[0]
      ? 'Deficient'
      : input.phosphorus > prof.idealP[1] + 20
      ? 'Excess'
      : 'Optimal';
  const kStatus =
    input.potassium < prof.idealK[0]
      ? 'Deficient'
      : input.potassium > prof.idealK[1] + 20
      ? 'Excess'
      : 'Optimal';
  const phStatus = input.ph < prof.idealPh[0] ? 'Acidic' : input.ph > prof.idealPh[1] ? 'Alkaline' : 'Optimal';

  const gaps: string[] = [];
  if (nStatus === 'Deficient') gaps.push(`Nitrogen is below ${prof.displayName}'s target (${input.nitrogen} vs ${prof.idealN[0]}–${prof.idealN[1]} kg/ha)`);
  if (pStatus === 'Deficient') gaps.push(`Phosphorus is below target (${input.phosphorus} vs ${prof.idealP[0]}–${prof.idealP[1]} kg/ha)`);
  if (kStatus === 'Deficient') gaps.push(`Potassium is below target (${input.potassium} vs ${prof.idealK[0]}–${prof.idealK[1]} kg/ha)`);
  if (phStatus !== 'Optimal') gaps.push(`Soil pH (${input.ph}) is ${phStatus.toLowerCase()} compared to ideal ${prof.idealPh[0]}–${prof.idealPh[1]}`);

  const explanation =
    gaps.length > 0
      ? `Based on ${prof.displayName} nutrient requirements, ${topFert} is recommended because: ${gaps.join('; ')}.`
      : `Your soil NPK levels are well-balanced for ${prof.displayName}. ${topFert} is recommended as a maintenance nutrient schedule to sustain crop vigor.`;

  return {
    crop: prof.name,
    recommendedFertilizer: topFert,
    confidenceScore: Math.min(97, Math.max(64, Math.round(rawConf * 100))),
    nutrientStatus: {
      nitrogen: { value: input.nitrogen, status: nStatus, targetRange: `${prof.idealN[0]}–${prof.idealN[1]} kg/ha` },
      phosphorus: { value: input.phosphorus, status: pStatus, targetRange: `${prof.idealP[0]}–${prof.idealP[1]} kg/ha` },
      potassium: { value: input.potassium, status: kStatus, targetRange: `${prof.idealK[0]}–${prof.idealK[1]} kg/ha` },
      ph: { value: input.ph, status: phStatus, targetRange: `${prof.idealPh[0]}–${prof.idealPh[1]}` },
    },
    explanation,
    applicationGuidance: [
      'Apply phosphorus and potassium fertilizers basally into the root zone before or at sowing.',
      'Split nitrogen applications into 2–3 stages (basal, active vegetative, and pre-flowering) to curb leaching loss.',
      'Incorporate fertilizer into moist soil rather than broadcasting before heavy rainfall.',
    ],
    chemicalAlternatives: [
      nStatus === 'Deficient' ? 'Urea (46-0-0) or Ammonium Sulphate for rapid nitrogen uptake' : 'NPK 19-19-19 water-soluble foliar grade for balanced maintenance',
      pStatus === 'Deficient' ? 'DAP (18-46-0) or Single Super Phosphate (SSP) at basal stage' : 'NPK 12-32-16 starter complex',
      kStatus === 'Deficient' ? 'Muriate of Potash (MOP 0-0-60) or Sulphate of Potash (SOP)' : 'Potassium Nitrate (13-0-45) during fruiting/grain fill',
    ],
    organicAlternatives: [
      'Well-decomposed Farmyard Manure (FYM) or Vermicompost (2–4 tonnes/acre) to rebuild organic carbon',
      'Neem cake (150–200 kg/acre) to slow nitrogen release and deter soil nematodes',
      'Phosphate-Solubilizing Bacteria (PSB) + Rhizobium / Azospirillum bio-fertilizers',
      'Wood ash or rock phosphate for gentle natural potassium and phosphorus supplementation',
    ],
    responsibleUsageNote:
      'Advisory Notice: These recommendations are ML-assisted estimates derived from your entered NPK and pH figures. Always validate exact application rates (kg/acre) against a certified soil testing laboratory card before purchasing bulk inputs.',
  };
}

export function planIrrigation(input: FarmInput, cropName: string): IrrigationPlanOutput {
  const prof = getProfile(cropName);
  // Reference evapotranspiration approximation (mm/day) driven by temperature & inverse humidity
  const dailyEt0 = Math.max(2.2, (0.0023 * (input.temperature + 17.8) * Math.sqrt(Math.max(4, 100 - input.humidity))) * 1.15);
  const dailyCropEtc = dailyEt0 * prof.waterKc;
  const weeklyCropNeedMm = Number((dailyCropEtc * 7).toFixed(1));
  const seasonalCropNeedMm = Number((dailyCropEtc * prof.durationDays).toFixed(0));

  // Effective rainfall contribution (roughly 75% of rainfall enters root zone)
  const effectiveSeasonalRainMm = input.rainfall * 0.75;
  const waterDeficitMm = Math.max(0, Number((seasonalCropNeedMm - effectiveSeasonalRainMm).toFixed(0)));

  let level: 'LOW' | 'MODERATE' | 'HIGH' = 'MODERATE';
  if (waterDeficitMm > 320 || (prof.waterKc >= 1.05 && input.rainfall < 140)) {
    level = 'HIGH';
  } else if (waterDeficitMm < 130 && input.humidity >= 60) {
    level = 'LOW';
  }

  // 1 mm over 1 acre (4046.86 m²) = 4,046.86 liters
  const deficitPerWeekMm = Math.max(5, Number((waterDeficitMm / Math.max(6, prof.durationDays / 7)).toFixed(1)));
  const litersPerWeek = Math.round(deficitPerWeekMm * 4046.86 * input.areaAcres);

  const explanation = `${prof.displayName} has a crop water coefficient (Kc) of ${prof.waterKc} over a ${prof.durationDays}-day cycle. At ${input.temperature}°C and ${input.humidity}% relative humidity, estimated crop water demand is ${seasonalCropNeedMm} mm, while effective rainfall contributes ~${Math.round(effectiveSeasonalRainMm)} mm, leaving a seasonal irrigation deficit of ${waterDeficitMm} mm.`;

  return {
    crop: prof.name,
    level,
    estimatedWeeklyMm: deficitPerWeekMm,
    estimatedSeasonalMm: waterDeficitMm,
    estimatedTotalLitersPerWeek: litersPerWeek,
    waterDeficitMm,
    explanation,
    waterManagementAdvice: [
      level === 'HIGH'
        ? 'Schedule frequent, measured irrigation every 4–6 days during peak vegetative and flowering stages.'
        : level === 'MODERATE'
        ? 'Provide supplemental irrigation at critical growth stages: crown/root initiation, flowering, and grain filling.'
        : 'Natural rainfall and humidity meet most crop demand; irrigate only during prolonged dry spells (>10 days).',
      'Irrigate early morning or late evening to cut evaporation loss by 15–25%.',
      'Check root-zone moisture at 15 cm depth before turning on pumps to prevent over-watering.',
    ],
    waterSavingTechniques: [
      'Drip or micro-sprinkler irrigation (saves 35–50% water vs flood irrigation).',
      'Organic straw or crop-residue mulching to suppress soil evaporation and weed pressure.',
      'Laser land leveling and furrow/ridge planting for uniform water distribution.',
    ],
  };
}

export function predictYield(input: FarmInput, cropName: string): YieldPredictionOutput {
  const bundle = trainOrLoadModels();
  const prof = getProfile(cropName);
  const cropIdx = bundle.yieldModel.cropIndexMap[prof.name] ?? 0;

  const predictForCrop = (cName: string) => {
    const idx = bundle.yieldModel.cropIndexMap[cName] ?? 0;
    const x = [
      idx,
      input.nitrogen,
      input.phosphorus,
      input.potassium,
      input.temperature,
      input.humidity,
      input.ph,
      input.rainfall,
      input.areaAcres,
    ];
    const sum = bundle.yieldModel.trees.reduce((acc, tree) => acc + predictRegressionTree(tree, x), 0);
    return Math.max(0.4, Number((sum / (bundle.yieldModel.trees.length || 1)).toFixed(2)));
  };

  const yieldTonnesPerHa = predictForCrop(prof.name);
  // Unit conversions: 1 hectare = 2.47105 acres, 1 tonne = 10 quintals
  const areaHectares = Number((input.areaAcres / 2.47105).toFixed(3));
  const yieldQuintalsPerAcre = Number(((yieldTonnesPerHa * 10) / 2.47105).toFixed(2));
  const totalEstimatedTonnes = Number((yieldTonnesPerHa * areaHectares).toFixed(2));
  const totalEstimatedQuintals = Number((totalEstimatedTonnes * 10).toFixed(1));

  const limitingFactors: YieldPredictionOutput['limitingFactors'] = [
    {
      factor: 'Nitrogen Supply',
      impact: input.nitrogen < prof.idealN[0] ? 'Limiting' : input.nitrogen <= prof.idealN[1] ? 'Positive' : 'Neutral',
      detail: `${input.nitrogen} kg/ha vs target ${prof.idealN[0]}–${prof.idealN[1]} kg/ha`,
    },
    {
      factor: 'Soil Reaction (pH)',
      impact: input.ph >= prof.idealPh[0] && input.ph <= prof.idealPh[1] ? 'Positive' : 'Limiting',
      detail: `pH ${input.ph} vs preferred ${prof.idealPh[0]}–${prof.idealPh[1]}`,
    },
    {
      factor: 'Moisture & Rainfall',
      impact: input.rainfall >= prof.idealRainfall[0] * 0.8 && input.rainfall <= prof.idealRainfall[1] * 1.15 ? 'Positive' : 'Limiting',
      detail: `${input.rainfall} mm seasonal rain vs ${prof.idealRainfall[0]}–${prof.idealRainfall[1]} mm optimal`,
    },
    {
      factor: 'Thermal Regime',
      impact: input.temperature >= prof.idealTemp[0] && input.temperature <= prof.idealTemp[1] ? 'Positive' : 'Limiting',
      detail: `${input.temperature}°C ambient vs ${prof.idealTemp[0]}–${prof.idealTemp[1]}°C ideal`,
    },
  ];

  // Compare with top alternative crops under the same farm conditions
  const cropRec = recommendCrop(input);
  const compareNames = Array.from(new Set([prof.name, ...cropRec.alternatives.map((a) => a.crop)])).slice(0, 5);
  const cropComparisons = compareNames.map((c) => {
    const p = getProfile(c);
    const yTha = c === prof.name ? yieldTonnesPerHa : predictForCrop(c);
    const yQac = Number(((yTha * 10) / 2.47105).toFixed(2));
    const totT = Number((yTha * areaHectares).toFixed(2));
    return {
      crop: c,
      displayName: p.displayName,
      yieldTonnesPerHa: yTha,
      yieldQuintalsPerAcre: yQac,
      totalTonnes: totT,
    };
  });

  return {
    crop: prof.name,
    displayName: prof.displayName,
    areaAcres: input.areaAcres,
    areaHectares,
    yieldTonnesPerHa,
    yieldQuintalsPerAcre,
    totalEstimatedTonnes,
    totalEstimatedQuintals,
    explanation: `Our Random Forest Regressor (R² = ${bundle.yieldModel.metrics.r2}, RMSE = ${bundle.yieldModel.metrics.rmse} t/ha) estimates ${yieldTonnesPerHa} tonnes/ha (${yieldQuintalsPerAcre} quintals/acre) for ${prof.displayName} across your ${input.areaAcres} acres (${areaHectares} ha), yielding ~${totalEstimatedTonnes} tonnes (${totalEstimatedQuintals} quintals) total.`,
    limitingFactors,
    cropComparisons,
    modelMetrics: bundle.yieldModel.metrics,
  };
}

export function assessRisks(input: FarmInput, cropName: string): RiskAssessmentOutput {
  const prof = getProfile(cropName);
  const factors: RiskItem[] = [];
  let score = 0;

  // 1. Low rainfall
  if (input.rainfall < prof.idealRainfall[0] * 0.65) {
    score += 18;
    factors.push({
      factor: 'Low Rainfall / Drought Stress',
      level: 'HIGH',
      reason: `Rainfall (${input.rainfall} mm) is significantly below ${prof.displayName}'s threshold (${prof.idealRainfall[0]} mm).`,
      correctiveAction: 'Install drip/micro-irrigation and apply organic mulch to conserve soil moisture.',
    });
  } else if (input.rainfall < prof.idealRainfall[0]) {
    score += 9;
    factors.push({
      factor: 'Low Rainfall',
      level: 'MODERATE',
      reason: `Rainfall (${input.rainfall} mm) is mildly below ideal range (${prof.idealRainfall[0]}–${prof.idealRainfall[1]} mm).`,
      correctiveAction: 'Plan supplemental irrigation during flowering and grain-fill stages.',
    });
  } else {
    factors.push({
      factor: 'Low Rainfall',
      level: 'LOW',
      reason: `Rainfall (${input.rainfall} mm) meets minimum crop moisture thresholds.`,
      correctiveAction: 'Maintain standard moisture monitoring.',
    });
  }

  // 2. Excessive rainfall
  if (input.rainfall > prof.idealRainfall[1] * 1.25) {
    score += 16;
    factors.push({
      factor: 'Excessive Rainfall / Waterlogging',
      level: 'HIGH',
      reason: `Rainfall (${input.rainfall} mm) exceeds safe upper bound (${prof.idealRainfall[1]} mm), risking root hypoxia and fungal blight.`,
      correctiveAction: 'Construct perimeter drainage channels and grow on raised beds.',
    });
  } else if (input.rainfall > prof.idealRainfall[1]) {
    score += 7;
    factors.push({
      factor: 'Excessive Rainfall',
      level: 'MODERATE',
      reason: `Rainfall (${input.rainfall} mm) is slightly above ideal upper range.`,
      correctiveAction: 'Ensure field outlets remain clear during heavy downpours.',
    });
  } else {
    factors.push({
      factor: 'Excessive Rainfall',
      level: 'LOW',
      reason: 'No excessive precipitation waterlogging hazard detected.',
      correctiveAction: 'Keep field bunds intact.',
    });
  }

  // 3. High temperature
  if (input.temperature > prof.idealTemp[1] + 5) {
    score += 16;
    factors.push({
      factor: 'High Temperature / Heat Stress',
      level: 'HIGH',
      reason: `Ambient temperature (${input.temperature}°C) exceeds ${prof.displayName} tolerance (${prof.idealTemp[1]}°C), risking pollen sterility.`,
      correctiveAction: 'Apply light evening irrigation for evaporative cooling and choose heat-tolerant cultivars.',
    });
  } else if (input.temperature > prof.idealTemp[1] || input.temperature < prof.idealTemp[0] - 2) {
    score += 8;
    factors.push({
      factor: 'Thermal Variance',
      level: 'MODERATE',
      reason: `Temperature (${input.temperature}°C) sits outside optimal ${prof.idealTemp[0]}–${prof.idealTemp[1]}°C window.`,
      correctiveAction: 'Adjust sowing window by 10–15 days to align flowering with milder temperatures.',
    });
  } else {
    factors.push({
      factor: 'Temperature Regime',
      level: 'LOW',
      reason: `Temperature (${input.temperature}°C) is optimal for crop growth.`,
      correctiveAction: 'Continue normal seasonal schedule.',
    });
  }

  // 4. Low soil fertility & 5. Nutrient deficiencies
  const avgNpk = (input.nitrogen + input.phosphorus + input.potassium) / 3;
  if (avgNpk < 25) {
    score += 15;
    factors.push({
      factor: 'Low Overall Soil Fertility',
      level: 'HIGH',
      reason: `Combined NPK average (${avgNpk.toFixed(1)} kg/ha) indicates depleted soil organic and mineral reserves.`,
      correctiveAction: 'Incorporate 3–4 tonnes/acre compost/FYM and green manuring before sowing.',
    });
  } else if (avgNpk < 40) {
    score += 7;
    factors.push({
      factor: 'Moderate Soil Fertility',
      level: 'MODERATE',
      reason: 'Soil nutrient reserves are moderate and need balanced supplementation.',
      correctiveAction: 'Follow split NPK schedule with organic compost.',
    });
  } else {
    factors.push({
      factor: 'Soil Fertility Reserve',
      level: 'LOW',
      reason: 'Baseline macro-nutrient availability is healthy.',
      correctiveAction: 'Maintain soil organic carbon via residue mulching.',
    });
  }

  const defCount =
    (input.nitrogen < prof.idealN[0] ? 1 : 0) +
    (input.phosphorus < prof.idealP[0] ? 1 : 0) +
    (input.potassium < prof.idealK[0] ? 1 : 0);
  if (defCount >= 2) {
    score += 14;
    factors.push({
      factor: 'Multiple Nutrient Deficiencies',
      level: 'HIGH',
      reason: `${defCount} primary macronutrients are below ${prof.displayName} thresholds.`,
      correctiveAction: 'Apply targeted complex fertilizer + bio-fertilizers per Fertilizer Module guidance.',
    });
  } else if (defCount === 1) {
    score += 7;
    factors.push({
      factor: 'Single Nutrient Deficiency',
      level: 'MODERATE',
      reason: 'One primary macronutrient (N, P, or K) is below optimal crop threshold.',
      correctiveAction: 'Supplement the limiting nutrient at basal or top-dressing stage.',
    });
  } else {
    factors.push({
      factor: 'Nutrient Balance',
      level: 'LOW',
      reason: 'Primary N-P-K nutrients meet crop requirements.',
      correctiveAction: 'Verify secondary/micronutrients (Zn, B, S) periodically.',
    });
  }

  // 6. Unsuitable soil pH
  const phDiff = distanceToRange(input.ph, prof.idealPh);
  if (phDiff > 1.0) {
    score += 15;
    factors.push({
      factor: 'Unsuitable Soil pH',
      level: 'HIGH',
      reason: `Soil pH (${input.ph}) deviates strongly from ${prof.idealPh[0]}–${prof.idealPh[1]}, locking out phosphorus and micronutrients.`,
      correctiveAction: input.ph < 5.5 ? 'Apply agricultural lime (dolomite/calcite) 3 weeks pre-sowing.' : 'Apply agricultural gypsum + organic manure to lower alkalinity.',
    });
  } else if (phDiff > 0.3) {
    score += 7;
    factors.push({
      factor: 'Mild Soil pH Shift',
      level: 'MODERATE',
      reason: `Soil pH (${input.ph}) is slightly outside ${prof.idealPh[0]}–${prof.idealPh[1]}.`,
      correctiveAction: 'Buffer soil gradually using organic compost.',
    });
  } else {
    factors.push({
      factor: 'Soil pH Suitability',
      level: 'LOW',
      reason: `Soil pH (${input.ph}) supports optimal nutrient solubility.`,
      correctiveAction: 'Avoid acidifying ammonium fertilizers in excess.',
    });
  }

  // 7. Water stress (humidity + rainfall + temp)
  const irr = planIrrigation(input, cropName);
  if (irr.level === 'HIGH') {
    score += 10;
    factors.push({
      factor: 'Water Stress Exposure',
      level: 'HIGH',
      reason: `High seasonal water deficit (${irr.waterDeficitMm} mm) under ${input.temperature}°C / ${input.humidity}% RH.`,
      correctiveAction: 'Secure reliable irrigation source and mulch soil surface before sowing.',
    });
  } else if (irr.level === 'MODERATE') {
    score += 4;
    factors.push({
      factor: 'Water Stress Exposure',
      level: 'MODERATE',
      reason: `Moderate supplemental irrigation (${irr.waterDeficitMm} mm) needed across season.`,
      correctiveAction: 'Plan irrigation around critical growth stages.',
    });
  } else {
    factors.push({
      factor: 'Water Stress Exposure',
      level: 'LOW',
      reason: 'Water supply aligns comfortably with crop demand.',
      correctiveAction: 'Monitor dry spells longer than 10 days.',
    });
  }

  // 8. Environmental fungal/pest humidity risk
  if (input.humidity > 86 && input.temperature >= 22 && input.temperature <= 32) {
    score += 8;
    factors.push({
      factor: 'Humid Microclimate Disease Pressure',
      level: 'MODERATE',
      reason: `High humidity (${input.humidity}%) combined with warm ${input.temperature}°C elevates fungal blight and mildew risk.`,
      correctiveAction: 'Increase plant spacing for airflow and scout leaves weekly using Plant Disease Detection.',
    });
  } else {
    factors.push({
      factor: 'Environmental Canopy Conditions',
      level: 'LOW',
      reason: 'Ambient humidity and temperature present low baseline fungal pressure.',
      correctiveAction: 'Continue routine weekly scouting.',
    });
  }

  const clampedScore = Math.min(100, score);
  const overallLevel: 'LOW' | 'MODERATE' | 'HIGH' =
    clampedScore >= 42 ? 'HIGH' : clampedScore >= 20 ? 'MODERATE' : 'LOW';

  return {
    overallLevel,
    riskScore: clampedScore,
    factors,
    preventivePractices: [
      'Practice legume-cereal crop rotation to break pest cycles and restore nitrogen.',
      'Maintain field bunds and drainage outlets prior to monsoon onset.',
      'Use certified, climate-resilient seed varieties treated with bio-protectants.',
      'Consider crop insurance enrollment (e.g., PMFBY / regional weather cover) ahead of sowing cutoffs.',
    ],
    managementSummary:
      overallLevel === 'HIGH'
        ? `Elevated risk (${clampedScore}/100) identified for ${prof.displayName}. Address high-severity soil or water constraints before committing full acreage.`
        : overallLevel === 'MODERATE'
        ? `Manageable moderate risk (${clampedScore}/100) for ${prof.displayName}. Targeted irrigation and nutrient adjustments will stabilize expected yield.`
        : `Favorable low-risk profile (${clampedScore}/100) for ${prof.displayName}. Maintain preventive scouting and balanced soil stewardship.`,
  };
}

export function computeSoilHealth(input: FarmInput): SoilHealthOutput {
  const nScore = Math.round(Math.max(20, Math.min(100, 100 - Math.abs(input.nitrogen - 75) * 0.85)));
  const pScore = Math.round(Math.max(20, Math.min(100, 100 - Math.abs(input.phosphorus - 50) * 1.1)));
  const kScore = Math.round(Math.max(20, Math.min(100, 100 - Math.abs(input.potassium - 45) * 0.9)));
  const phScore = Math.round(Math.max(15, Math.min(100, 100 - Math.abs(input.ph - 6.6) * 28)));

  const score = Math.round(nScore * 0.28 + pScore * 0.24 + kScore * 0.23 + phScore * 0.25);
  const rating: SoilHealthOutput['rating'] =
    score >= 82 ? 'Optimal' : score >= 66 ? 'Good' : score >= 48 ? 'Fair' : 'Needs Improvement';

  const suggestions: string[] = [];
  if (input.nitrogen < 50) suggestions.push('Boost nitrogen organically with green manuring (dhaincha/sunnhemp) or legume rotation.');
  if (input.phosphorus < 35) suggestions.push('Apply rock phosphate or PSB bio-fertilizer blended with compost to elevate available P.');
  if (input.potassium < 30) suggestions.push('Incorporate crop residues or potassium-rich compost to improve root resilience.');
  if (input.ph < 5.8) suggestions.push('Soil is acidic; incorporate agricultural lime to improve nutrient availability.');
  if (input.ph > 7.6) suggestions.push('Soil is alkaline; apply gypsum and organic matter to improve structure and pH.');
  if (suggestions.length === 0) suggestions.push('Maintain current soil organic matter with annual compost additions and minimal tillage.');

  return {
    score,
    rating,
    breakdown: {
      nitrogenScore: nScore,
      phosphorusScore: pScore,
      potassiumScore: kScore,
      phScore,
    },
    suggestions,
    disclaimer:
      'Indicative agronomic soil health score calculated from entered NPK and pH values. This is not a certified laboratory soil test (which also measures organic carbon, EC, and micronutrients).',
  };
}

export function compareCrops(input: FarmInput, cropList: string[]) {
  const rec = recommendCrop(input);
  const selected = cropList.length > 0 ? cropList : rec.alternatives.slice(0, 4).map((a) => a.crop);

  return selected.map((c) => {
    const prof = getProfile(c);
    const y = predictYield(input, c);
    const irr = planIrrigation(input, c);
    const altMatch = rec.alternatives.find((a) => a.crop === prof.name);
    const estCost = Math.round(prof.avgCostPerAcreInr * input.areaAcres);
    const estRevenue = Math.round(y.totalEstimatedQuintals * prof.avgPricePerQuintalInr);
    const estProfit = estRevenue - estCost;

    // Fallback suitability if not in top 5
    const nDist = distanceToRange(input.nitrogen, prof.idealN) / 50;
    const phDist = distanceToRange(input.ph, prof.idealPh) / 1.5;
    const tempDist = distanceToRange(input.temperature, prof.idealTemp) / 8;
    const rainDist = distanceToRange(input.rainfall, prof.idealRainfall) / 80;
    const suitability =
      altMatch?.suitabilityScore ?? Math.max(22, Math.min(92, Math.round(Math.exp(-(nDist + phDist + tempDist + rainDist) * 0.45) * 95)));

    return {
      crop: prof.name,
      displayName: prof.displayName,
      category: prof.category,
      season: prof.season,
      durationDays: prof.durationDays,
      suitabilityScore: suitability,
      waterRequirement: irr.level,
      weeklyWaterMm: irr.estimatedWeeklyMm,
      yieldTonnesPerHa: y.yieldTonnesPerHa,
      yieldQuintalsPerAcre: y.yieldQuintalsPerAcre,
      totalQuintals: y.totalEstimatedQuintals,
      estimatedCostInr: estCost,
      estimatedRevenueInr: estRevenue,
      estimatedProfitInr: estProfit,
      growingConditions: `pH ${prof.idealPh[0]}–${prof.idealPh[1]} · ${prof.idealTemp[0]}–${prof.idealTemp[1]}°C · ${prof.idealRainfall[0]}–${prof.idealRainfall[1]} mm`,
    };
  });
}

export function generateFarmingCalendar(cropName: string, sowingDateStr: string) {
  const prof = getProfile(cropName);
  const sowingDate = sowingDateStr ? new Date(sowingDateStr) : new Date();
  const addDays = (d: Date, days: number) => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return copy.toISOString().split('T')[0];
  };

  const d = prof.durationDays;
  return [
    {
      stage: 'Land Preparation',
      title: `Deep ploughing, leveling & organic compost incorporation for ${prof.displayName}`,
      dueDate: addDays(sowingDate, -7),
      notes: 'Prepare fine tilth, incorporate FYM/compost, and check soil drainage channels.',
    },
    {
      stage: 'Sowing',
      title: `Seed treatment & sowing at ${prof.spacing} spacing`,
      dueDate: addDays(sowingDate, 0),
      notes: `Recommended season: ${prof.season}. Apply basal phosphorus and potassium.`,
    },
    {
      stage: 'Irrigation',
      title: 'Early establishment & root-zone irrigation check',
      dueDate: addDays(sowingDate, Math.round(d * 0.14)),
      notes: 'Keep topsoil evenly moist during germination and early seedling growth.',
    },
    {
      stage: 'Fertilizer Application',
      title: 'First split nitrogen top-dressing & inter-row weeding',
      dueDate: addDays(sowingDate, Math.round(d * 0.28)),
      notes: 'Top-dress after weeding when soil has light moisture.',
    },
    {
      stage: 'Crop Monitoring',
      title: 'Canopy pest & leaf-disease scouting (pre-flowering)',
      dueDate: addDays(sowingDate, Math.round(d * 0.5)),
      notes: 'Inspect lower leaves for spots or pests; apply preventive neem/bio-control if needed.',
    },
    {
      stage: 'Irrigation',
      title: 'Critical flowering / grain-filling moisture check',
      dueDate: addDays(sowingDate, Math.round(d * 0.65)),
      notes: 'Moisture stress during flowering directly reduces final yield.',
    },
    {
      stage: 'Harvesting',
      title: `Maturity inspection & harvesting (${prof.displayName})`,
      dueDate: addDays(sowingDate, d),
      notes: prof.harvestSigns,
    },
  ];
}
