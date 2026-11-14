import fs from 'fs';
import path from 'path';
import { config } from '../config.ts';
import { ensureDatasetsExist } from './datasets.ts';

export interface DecisionTreeNode {
  isLeaf: boolean;
  prediction?: string;
  probabilities?: Record<string, number>;
  featureIndex?: number;
  threshold?: number;
  left?: DecisionTreeNode;
  right?: DecisionTreeNode;
}

export interface RegressionTreeNode {
  isLeaf: boolean;
  value?: number;
  featureIndex?: number;
  threshold?: number;
  left?: RegressionTreeNode;
  right?: RegressionTreeNode;
}

export interface TrainedModelsBundle {
  trainedAt: string;
  cropModel: {
    algorithm: string;
    features: string[];
    classes: string[];
    trees: DecisionTreeNode[];
    featureImportances: Record<string, number>;
    metrics: {
      trainSamples: number;
      testSamples: number;
      accuracy: number;
      macroPrecision: number;
      macroRecall: number;
      macroF1: number;
    };
  };
  fertilizerModel: {
    algorithm: string;
    features: string[];
    classes: string[];
    trees: DecisionTreeNode[];
    metrics: {
      trainSamples: number;
      testSamples: number;
      accuracy: number;
      macroF1: number;
    };
  };
  yieldModel: {
    algorithm: string;
    cropIndexMap: Record<string, number>;
    features: string[];
    trees: RegressionTreeNode[];
    metrics: {
      trainSamples: number;
      testSamples: number;
      r2: number;
      rmse: number;
      mae: number;
    };
  };
}

function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function parseCleanCsv(filePath: string): { headers: string[]; rows: string[][] } {
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = lines[0].split(',').map((h) => h.trim());
  const seen = new Set<string>();
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || seen.has(line)) continue;
    const cols = line.split(',').map((c) => c.trim());
    if (cols.length !== headers.length || cols.some((c) => c === '' || c === 'NaN' || c === 'null')) {
      continue;
    }
    seen.add(line);
    rows.push(cols);
  }
  return { headers, rows };
}

function giniImpurity(labels: string[]): number {
  const n = labels.length;
  if (n === 0) return 0;
  const counts: Record<string, number> = {};
  for (const l of labels) counts[l] = (counts[l] || 0) + 1;
  let sumSq = 0;
  for (const c of Object.values(counts)) {
    const p = c / n;
    sumSq += p * p;
  }
  return 1 - sumSq;
}

function classDistribution(labels: string[]): { majority: string; probs: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const l of labels) counts[l] = (counts[l] || 0) + 1;
  const n = labels.length || 1;
  let majority = labels[0] || '';
  let maxCount = -1;
  const probs: Record<string, number> = {};
  for (const [k, c] of Object.entries(counts)) {
    probs[k] = c / n;
    if (c > maxCount) {
      maxCount = c;
      majority = k;
    }
  }
  return { majority, probs };
}

function buildCartClassifier(
  X: number[][],
  y: string[],
  depth: number,
  maxDepth: number,
  minSamplesSplit: number,
  maxFeatures: number,
  rng: () => number,
  importanceAccum: number[]
): DecisionTreeNode {
  const { majority, probs } = classDistribution(y);
  const uniqueLabels = Object.keys(probs);

  if (depth >= maxDepth || y.length < minSamplesSplit || uniqueLabels.length <= 1) {
    return { isLeaf: true, prediction: majority, probabilities: probs };
  }

  const numFeatures = X[0].length;
  const indices = Array.from({ length: numFeatures }, (_, i) => i);
  // Fisher-Yates partial shuffle for random feature subspace
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const candidateFeatures = indices.slice(0, maxFeatures);

  const parentGini = giniImpurity(y);
  let bestGain = 0;
  let bestFeature = -1;
  let bestThreshold = 0;
  let bestLeftIdx: number[] = [];
  let bestRightIdx: number[] = [];

  for (const fIdx of candidateFeatures) {
    const values = Array.from(new Set(X.map((row) => row[fIdx]))).sort((a, b) => a - b);
    if (values.length <= 1) continue;

    // Sample up to 16 candidate midpoints for fast exact splitting
    const step = Math.max(1, Math.floor(values.length / 16));
    for (let i = 0; i < values.length - 1; i += step) {
      const thresh = (values[i] + values[i + 1]) / 2;
      const leftIdx: number[] = [];
      const rightIdx: number[] = [];
      for (let r = 0; r < X.length; r++) {
        if (X[r][fIdx] <= thresh) leftIdx.push(r);
        else rightIdx.push(r);
      }
      if (leftIdx.length === 0 || rightIdx.length === 0) continue;

      const leftY = leftIdx.map((idx) => y[idx]);
      const rightY = rightIdx.map((idx) => y[idx]);
      const weightedGini =
        (leftY.length / y.length) * giniImpurity(leftY) +
        (rightY.length / y.length) * giniImpurity(rightY);
      const gain = parentGini - weightedGini;

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = fIdx;
        bestThreshold = thresh;
        bestLeftIdx = leftIdx;
        bestRightIdx = rightIdx;
      }
    }
  }

  if (bestFeature === -1 || bestGain <= 1e-6) {
    return { isLeaf: true, prediction: majority, probabilities: probs };
  }

  importanceAccum[bestFeature] += bestGain * y.length;

  return {
    isLeaf: false,
    featureIndex: bestFeature,
    threshold: Number(bestThreshold.toFixed(4)),
    left: buildCartClassifier(
      bestLeftIdx.map((i) => X[i]),
      bestLeftIdx.map((i) => y[i]),
      depth + 1,
      maxDepth,
      minSamplesSplit,
      maxFeatures,
      rng,
      importanceAccum
    ),
    right: buildCartClassifier(
      bestRightIdx.map((i) => X[i]),
      bestRightIdx.map((i) => y[i]),
      depth + 1,
      maxDepth,
      minSamplesSplit,
      maxFeatures,
      rng,
      importanceAccum
    ),
  };
}

export function predictTreeProbs(node: DecisionTreeNode, x: number[]): Record<string, number> {
  if (node.isLeaf) return node.probabilities || {};
  if (x[node.featureIndex!] <= node.threshold!) {
    return predictTreeProbs(node.left!, x);
  }
  return predictTreeProbs(node.right!, x);
}

function variance(vals: number[]): number {
  if (vals.length === 0) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length;
}

function buildCartRegressor(
  X: number[][],
  y: number[],
  depth: number,
  maxDepth: number,
  minSamplesSplit: number,
  maxFeatures: number,
  rng: () => number
): RegressionTreeNode {
  const mean = y.reduce((a, b) => a + b, 0) / (y.length || 1);
  if (depth >= maxDepth || y.length < minSamplesSplit || variance(y) < 1e-5) {
    return { isLeaf: true, value: Number(mean.toFixed(4)) };
  }

  const numFeatures = X[0].length;
  const indices = Array.from({ length: numFeatures }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  // Always include crop index (feature 0) + random subset of environmental features
  const candidateFeatures = Array.from(new Set([0, ...indices.slice(0, maxFeatures)]));

  const parentVar = variance(y);
  let bestGain = 0;
  let bestFeature = -1;
  let bestThreshold = 0;
  let bestLeftIdx: number[] = [];
  let bestRightIdx: number[] = [];

  for (const fIdx of candidateFeatures) {
    const values = Array.from(new Set(X.map((row) => row[fIdx]))).sort((a, b) => a - b);
    if (values.length <= 1) continue;
    const step = Math.max(1, Math.floor(values.length / 22));

    for (let i = 0; i < values.length - 1; i += step) {
      const thresh = (values[i] + values[i + 1]) / 2;
      const leftIdx: number[] = [];
      const rightIdx: number[] = [];
      for (let r = 0; r < X.length; r++) {
        if (X[r][fIdx] <= thresh) leftIdx.push(r);
        else rightIdx.push(r);
      }
      if (leftIdx.length < 2 || rightIdx.length < 2) continue;

      const leftY = leftIdx.map((idx) => y[idx]);
      const rightY = rightIdx.map((idx) => y[idx]);
      const weightedVar =
        (leftY.length / y.length) * variance(leftY) +
        (rightY.length / y.length) * variance(rightY);
      const gain = parentVar - weightedVar;

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = fIdx;
        bestThreshold = thresh;
        bestLeftIdx = leftIdx;
        bestRightIdx = rightIdx;
      }
    }
  }

  if (bestFeature === -1 || bestGain <= 1e-6) {
    return { isLeaf: true, value: Number(mean.toFixed(4)) };
  }

  return {
    isLeaf: false,
    featureIndex: bestFeature,
    threshold: Number(bestThreshold.toFixed(4)),
    left: buildCartRegressor(
      bestLeftIdx.map((i) => X[i]),
      bestLeftIdx.map((i) => y[i]),
      depth + 1,
      maxDepth,
      minSamplesSplit,
      maxFeatures,
      rng
    ),
    right: buildCartRegressor(
      bestRightIdx.map((i) => X[i]),
      bestRightIdx.map((i) => y[i]),
      depth + 1,
      maxDepth,
      minSamplesSplit,
      maxFeatures,
      rng
    ),
  };
}

export function predictRegressionTree(node: RegressionTreeNode, x: number[]): number {
  if (node.isLeaf) return node.value ?? 0;
  if (x[node.featureIndex!] <= node.threshold!) {
    return predictRegressionTree(node.left!, x);
  }
  return predictRegressionTree(node.right!, x);
}

function stratifiedSplit<T>(X: T[], y: string[], testRatio = 0.2, seed = 42) {
  const rng = createRng(seed);
  const byClass: Record<string, number[]> = {};
  y.forEach((label, i) => {
    if (!byClass[label]) byClass[label] = [];
    byClass[label].push(i);
  });

  const trainIdx: number[] = [];
  const testIdx: number[] = [];

  for (const idxs of Object.values(byClass)) {
    const shuffled = [...idxs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const nTest = Math.max(1, Math.round(shuffled.length * testRatio));
    testIdx.push(...shuffled.slice(0, nTest));
    trainIdx.push(...shuffled.slice(nTest));
  }

  return {
    XTrain: trainIdx.map((i) => X[i]),
    yTrain: trainIdx.map((i) => y[i]),
    XTest: testIdx.map((i) => X[i]),
    yTest: testIdx.map((i) => y[i]),
  };
}

function evaluateClassification(yTrue: string[], yPred: string[], classes: string[]) {
  let correct = 0;
  for (let i = 0; i < yTrue.length; i++) {
    if (yTrue[i] === yPred[i]) correct++;
  }
  const accuracy = correct / (yTrue.length || 1);

  let precisionSum = 0;
  let recallSum = 0;
  let f1Sum = 0;
  let validClasses = 0;

  for (const cls of classes) {
    let tp = 0, fp = 0, fn = 0;
    for (let i = 0; i < yTrue.length; i++) {
      if (yPred[i] === cls && yTrue[i] === cls) tp++;
      else if (yPred[i] === cls && yTrue[i] !== cls) fp++;
      else if (yPred[i] !== cls && yTrue[i] === cls) fn++;
    }
    if (tp + fn === 0) continue;
    validClasses++;
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;
    precisionSum += prec;
    recallSum += rec;
    f1Sum += f1;
  }

  const denom = validClasses || 1;
  return {
    accuracy: Number((accuracy * 100).toFixed(2)),
    macroPrecision: Number(((precisionSum / denom) * 100).toFixed(2)),
    macroRecall: Number(((recallSum / denom) * 100).toFixed(2)),
    macroF1: Number(((f1Sum / denom) * 100).toFixed(2)),
  };
}

let cachedBundle: TrainedModelsBundle | null = null;

export function trainOrLoadModels(forceRetrain = false): TrainedModelsBundle {
  if (cachedBundle && !forceRetrain) return cachedBundle;

  ensureDatasetsExist();
  fs.mkdirSync(config.trainedModelsDir, { recursive: true });
  const bundlePath = path.join(config.trainedModelsDir, 'models_bundle.json');

  if (!forceRetrain && fs.existsSync(bundlePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(bundlePath, 'utf-8')) as TrainedModelsBundle;
      if (parsed?.cropModel?.trees?.length && parsed?.yieldModel?.trees?.length) {
        cachedBundle = parsed;
        return parsed;
      }
    } catch {
      // Fall through to retrain cleanly
    }
  }

  // 1. Train Crop Recommendation Random Forest Classifier
  const cropCsv = parseCleanCsv(path.join(config.datasetsDir, 'crop_recommendation.csv'));
  const cropFeatures = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall'];
  const cropX: number[][] = [];
  const cropY: string[] = [];
  for (const row of cropCsv.rows) {
    const nums = row.slice(0, 7).map(Number);
    if (nums.some((n) => Number.isNaN(n))) continue;
    cropX.push(nums);
    cropY.push(row[7]);
  }
  const cropClasses = Array.from(new Set(cropY)).sort();
  const cropSplit = stratifiedSplit(cropX, cropY, 0.2, 2026);
  const cropTrees: DecisionTreeNode[] = [];
  const cropImp = new Array(cropFeatures.length).fill(0);
  const cropRng = createRng(101);

  const numCropTrees = 24;
  for (let t = 0; t < numCropTrees; t++) {
    const bootX: number[][] = [];
    const bootY: string[] = [];
    for (let i = 0; i < cropSplit.XTrain.length; i++) {
      const idx = Math.floor(cropRng() * cropSplit.XTrain.length);
      bootX.push(cropSplit.XTrain[idx]);
      bootY.push(cropSplit.yTrain[idx]);
    }
    cropTrees.push(buildCartClassifier(bootX, bootY, 0, 10, 4, 3, cropRng, cropImp));
  }

  const cropTestPreds = cropSplit.XTest.map((x) => {
    const agg: Record<string, number> = {};
    for (const tree of cropTrees) {
      const probs = predictTreeProbs(tree, x);
      for (const [cls, p] of Object.entries(probs)) {
        agg[cls] = (agg[cls] || 0) + p / numCropTrees;
      }
    }
    return Object.entries(agg).sort((a, b) => b[1] - a[1])[0]?.[0] || cropClasses[0];
  });
  const cropEval = evaluateClassification(cropSplit.yTest, cropTestPreds, cropClasses);

  const totalImp = cropImp.reduce((a, b) => a + b, 0) || 1;
  const featureImportances: Record<string, number> = {};
  cropFeatures.forEach((f, idx) => {
    featureImportances[f] = Number(((cropImp[idx] / totalImp) * 100).toFixed(1));
  });

  // 2. Train Fertilizer Recommendation Random Forest Classifier
  const fertCsv = parseCleanCsv(path.join(config.datasetsDir, 'fertilizer_recommendation.csv'));
  const fertFeatures = ['N', 'P', 'K', 'ph', 'moisture'];
  const fertX: number[][] = [];
  const fertY: string[] = [];
  for (const row of fertCsv.rows) {
    const nums = row.slice(0, 5).map(Number);
    if (nums.some((n) => Number.isNaN(n))) continue;
    fertX.push(nums);
    fertY.push(row[6]);
  }
  const fertClasses = Array.from(new Set(fertY)).sort();
  const fertSplit = stratifiedSplit(fertX, fertY, 0.2, 3030);
  const fertTrees: DecisionTreeNode[] = [];
  const fertImp = new Array(fertFeatures.length).fill(0);
  const fertRng = createRng(505);
  const numFertTrees = 18;

  for (let t = 0; t < numFertTrees; t++) {
    const bootX: number[][] = [];
    const bootY: string[] = [];
    for (let i = 0; i < fertSplit.XTrain.length; i++) {
      const idx = Math.floor(fertRng() * fertSplit.XTrain.length);
      bootX.push(fertSplit.XTrain[idx]);
      bootY.push(fertSplit.yTrain[idx]);
    }
    fertTrees.push(buildCartClassifier(bootX, bootY, 0, 8, 3, 3, fertRng, fertImp));
  }

  const fertTestPreds = fertSplit.XTest.map((x) => {
    const agg: Record<string, number> = {};
    for (const tree of fertTrees) {
      const probs = predictTreeProbs(tree, x);
      for (const [cls, p] of Object.entries(probs)) {
        agg[cls] = (agg[cls] || 0) + p / numFertTrees;
      }
    }
    return Object.entries(agg).sort((a, b) => b[1] - a[1])[0]?.[0] || fertClasses[0];
  });
  const fertEval = evaluateClassification(fertSplit.yTest, fertTestPreds, fertClasses);

  // 3. Train Yield Prediction Random Forest Regressor
  const yieldCsv = parseCleanCsv(path.join(config.datasetsDir, 'yield_prediction.csv'));
  const cropIndexMap: Record<string, number> = {};
  cropClasses.forEach((c, idx) => {
    cropIndexMap[c] = idx;
  });

  const yieldX: number[][] = [];
  const yieldY: number[] = [];
  for (const row of yieldCsv.rows) {
    const cropIdx = cropIndexMap[row[0]];
    if (cropIdx === undefined) continue;
    const nums = row.slice(1, 9).map(Number);
    if (nums.some((n) => Number.isNaN(n))) continue;
    const target = Number(row[9]);
    if (Number.isNaN(target)) continue;
    yieldX.push([cropIdx, ...nums]);
    yieldY.push(target);
  }

  const yieldRng = createRng(808);
  const yIndices = Array.from({ length: yieldX.length }, (_, i) => i);
  for (let i = yIndices.length - 1; i > 0; i--) {
    const j = Math.floor(yieldRng() * (i + 1));
    [yIndices[i], yIndices[j]] = [yIndices[j], yIndices[i]];
  }
  const nYieldTest = Math.max(1, Math.round(yIndices.length * 0.2));
  const yTestIdx = yIndices.slice(0, nYieldTest);
  const yTrainIdx = yIndices.slice(nYieldTest);

  const yXTrain = yTrainIdx.map((i) => yieldX[i]);
  const yYTrain = yTrainIdx.map((i) => yieldY[i]);
  const yXTest = yTestIdx.map((i) => yieldX[i]);
  const yYTest = yTestIdx.map((i) => yieldY[i]);

  const yieldTrees: RegressionTreeNode[] = [];
  const numYieldTrees = 22;
  for (let t = 0; t < numYieldTrees; t++) {
    const bootX: number[][] = [];
    const bootY: number[] = [];
    for (let i = 0; i < yXTrain.length; i++) {
      const idx = Math.floor(yieldRng() * yXTrain.length);
      bootX.push(yXTrain[idx]);
      bootY.push(yYTrain[idx]);
    }
    yieldTrees.push(buildCartRegressor(bootX, bootY, 0, 12, 4, 4, yieldRng));
  }

  const yTestPreds = yXTest.map((x) => {
    const sum = yieldTrees.reduce((acc, tree) => acc + predictRegressionTree(tree, x), 0);
    return sum / numYieldTrees;
  });

  const yMean = yYTest.reduce((a, b) => a + b, 0) / (yYTest.length || 1);
  let ssRes = 0, ssTot = 0, absErr = 0;
  for (let i = 0; i < yYTest.length; i++) {
    const diff = yYTest[i] - yTestPreds[i];
    ssRes += diff * diff;
    ssTot += (yYTest[i] - yMean) ** 2;
    absErr += Math.abs(diff);
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const rmse = Math.sqrt(ssRes / (yYTest.length || 1));
  const mae = absErr / (yYTest.length || 1);

  const bundle: TrainedModelsBundle = {
    trainedAt: new Date().toISOString(),
    cropModel: {
      algorithm: 'Random Forest Classifier (24 CART Trees, Gini Impurity)',
      features: cropFeatures,
      classes: cropClasses,
      trees: cropTrees,
      featureImportances,
      metrics: {
        trainSamples: cropSplit.XTrain.length,
        testSamples: cropSplit.XTest.length,
        ...cropEval,
      },
    },
    fertilizerModel: {
      algorithm: 'Random Forest Classifier (18 CART Trees, Nutrient-pH Splits)',
      features: fertFeatures,
      classes: fertClasses,
      trees: fertTrees,
      metrics: {
        trainSamples: fertSplit.XTrain.length,
        testSamples: fertSplit.XTest.length,
        accuracy: fertEval.accuracy,
        macroF1: fertEval.macroF1,
      },
    },
    yieldModel: {
      algorithm: 'Random Forest Regressor (22 Variance-Reduction Trees)',
      cropIndexMap,
      features: ['crop_id', ...cropFeatures, 'area_acres'],
      trees: yieldTrees,
      metrics: {
        trainSamples: yXTrain.length,
        testSamples: yXTest.length,
        r2: Number(r2.toFixed(4)),
        rmse: Number(rmse.toFixed(3)),
        mae: Number(mae.toFixed(3)),
      },
    },
  };

  fs.writeFileSync(bundlePath, JSON.stringify(bundle), 'utf-8');
  cachedBundle = bundle;
  return bundle;
}
