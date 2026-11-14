export type LanguageCode = 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu' | 'pa';

export type PageId =
  | 'home'
  | 'login'
  | 'register'
  | 'dashboard'
  | 'crop'
  | 'fertilizer'
  | 'irrigation'
  | 'yield'
  | 'risk'
  | 'chatbot'
  | 'voice'
  | 'disease'
  | 'comparison'
  | 'profit'
  | 'calendar'
  | 'history'
  | 'about'
  | 'contact';

export interface User {
  id: number;
  fullName: string;
  username: string;
  email: string;
  location: string;
  preferredLanguage: LanguageCode;
}

export interface FarmData {
  id: number;
  farmName: string;
  location: string;
  areaAcres: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  temperature: number;
  humidity: number;
  rainfall: number;
  soilHealthScore: number;
  createdAt: string;
}

export interface CropAlternative {
  crop: string;
  displayName: string;
  suitabilityScore: number;
  category: string;
  season: string;
  durationDays: number;
}

export interface FarmBundle {
  farm: FarmData;
  soilHealth: {
    score: number;
    rating: string;
    breakdown: {
      nitrogenScore: number;
      phosphorusScore: number;
      potassiumScore: number;
      phScore: number;
    };
    suggestions: string[];
    disclaimer: string;
  };
  cropRecommendation: {
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
    modelMetrics: {
      trainSamples: number;
      testSamples: number;
      accuracy: number;
      macroPrecision: number;
      macroRecall: number;
      macroF1: number;
    };
  };
  fertilizerRecommendation: {
    crop: string;
    recommendedFertilizer: string;
    confidenceScore: number;
    nutrientStatus: {
      nitrogen: { value: number; status: string; targetRange: string };
      phosphorus: { value: number; status: string; targetRange: string };
      potassium: { value: number; status: string; targetRange: string };
      ph: { value: number; status: string; targetRange: string };
    };
    explanation: string;
    applicationGuidance: string[];
    chemicalAlternatives: string[];
    organicAlternatives: string[];
    responsibleUsageNote: string;
  };
  irrigationPlan: {
    crop: string;
    level: 'LOW' | 'MODERATE' | 'HIGH';
    estimatedWeeklyMm: number;
    estimatedSeasonalMm: number;
    estimatedTotalLitersPerWeek: number;
    waterDeficitMm: number;
    explanation: string;
    waterManagementAdvice: string[];
    waterSavingTechniques: string[];
  };
  yieldPrediction: {
    crop: string;
    displayName: string;
    areaAcres: number;
    areaHectares: number;
    yieldTonnesPerHa: number;
    yieldQuintalsPerAcre: number;
    totalEstimatedTonnes: number;
    totalEstimatedQuintals: number;
    explanation: string;
    limitingFactors: Array<{ factor: string; impact: string; detail: string }>;
    cropComparisons: Array<{
      crop: string;
      displayName: string;
      yieldTonnesPerHa: number;
      yieldQuintalsPerAcre: number;
      totalTonnes: number;
    }>;
    modelMetrics: {
      trainSamples: number;
      testSamples: number;
      r2: number;
      rmse: number;
      mae: number;
    };
  };
  riskAssessment: {
    overallLevel: 'LOW' | 'MODERATE' | 'HIGH';
    riskScore: number;
    factors: Array<{
      factor: string;
      level: 'LOW' | 'MODERATE' | 'HIGH';
      reason: string;
      correctiveAction: string;
    }>;
    preventivePractices: string[];
    managementSummary: string;
  };
}

export interface WeatherInfo {
  available: boolean;
  provider: string;
  location: string;
  resolvedName: string;
  current: {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeedKmh: number;
    condition: string;
  } | null;
  forecast: Array<{
    date: string;
    tempMin: number;
    tempMax: number;
    humidity: number;
    rainMm: number;
    condition: string;
  }>;
  alerts: Array<{ severity: string; title: string; detail: string }>;
  cropPlanningImpact: string;
  errorMessage?: string;
}

export interface DashboardSummary {
  totalFarmers: number;
  totalFarms: number;
  userFarmsCount: number;
  avgPredictedYieldTha: number;
  avgPredictedYieldQac: number;
  topCrops: Array<{ crop: string; count: number; avgScore: number }>;
  fertilizerStats: Array<{ fertilizer: string; count: number }>;
  irrigationStats: Array<{ level: string; count: number }>;
  riskStats: Array<{ level: string; count: number }>;
  recentActivities: Array<{
    id: number;
    cropName: string;
    stage: string;
    title: string;
    dueDate: string;
    completed: number;
  }>;
  weather: WeatherInfo;
  mlSummary: {
    cropAccuracy: number;
    fertilizerAccuracy: number;
    yieldR2: number;
  };
}
