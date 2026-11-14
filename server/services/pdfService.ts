import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { config } from '../config.ts';

export interface FarmReportPayload {
  farmerName: string;
  farmerEmail: string;
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
  cropRecommendation: {
    recommendedCrop: string;
    displayName: string;
    confidenceScore: number;
    explanation: string;
  };
  fertilizerRecommendation: {
    recommendedFertilizer: string;
    explanation: string;
    organicAlternatives: string[];
  };
  irrigationPlan: {
    level: string;
    estimatedWeeklyMm: number;
    estimatedSeasonalMm: number;
    explanation: string;
  };
  yieldPrediction: {
    yieldTonnesPerHa: number;
    yieldQuintalsPerAcre: number;
    totalEstimatedTonnes: number;
    totalEstimatedQuintals: number;
  };
  riskAssessment: {
    overallLevel: string;
    riskScore: number;
    managementSummary: string;
  };
  profitEstimate?: {
    totalCost: number;
    expectedRevenue: number;
    estimatedProfit: number;
    roiPercent: number;
  };
}

export async function generateFarmPdfReport(payload: FarmReportPayload): Promise<{ fileName: string; buffer: Buffer }> {
  fs.mkdirSync(config.reportsDir, { recursive: true });
  const safeName = payload.farmName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileName = `agrisense_report_${safeName}_${Date.now()}.pdf`;
  const filePath = path.join(config.reportsDir, fileName);

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => {
      const buf = Buffer.concat(chunks);
      fs.writeFileSync(filePath, buf);
      resolve(buf);
    });
    doc.on('error', reject);

    // Header Banner
    doc.rect(0, 0, doc.page.width, 86).fill('#0D3B26');
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('AgriSense Farm Decision Support Report', 48, 26);
    doc.fontSize(10).font('Helvetica').fillColor('#D1FAE5').text(
      `Generated on ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}  |  Intelligent Crop Planning System`,
      48,
      54
    );

    doc.moveDown(3);
    doc.fillColor('#112419');

    const sectionTitle = (title: string) => {
      doc.moveDown(0.7);
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#14532D').text(title);
      doc.moveTo(48, doc.y + 2).lineTo(547, doc.y + 2).strokeColor('#BBF7D0').lineWidth(1).stroke();
      doc.moveDown(0.5);
      doc.fillColor('#1F2937').fontSize(10).font('Helvetica');
    };

    sectionTitle('1. Farmer & Farm Profile');
    doc.text(`Farmer Name: ${payload.farmerName} (${payload.farmerEmail})`);
    doc.text(`Farm Plot: ${payload.farmName}  |  Location: ${payload.location}`);
    doc.text(`Land Area: ${payload.areaAcres} acres (${(payload.areaAcres / 2.47105).toFixed(2)} hectares)`);

    sectionTitle('2. Soil & Environmental Measurements');
    doc.text(`Nitrogen (N): ${payload.nitrogen} kg/ha   |   Phosphorus (P): ${payload.phosphorus} kg/ha   |   Potassium (K): ${payload.potassium} kg/ha`);
    doc.text(`Soil pH: ${payload.ph}   |   Indicative Soil Health Score: ${payload.soilHealthScore} / 100 (Not a certified lab test)`);
    doc.text(`Temperature: ${payload.temperature} °C   |   Humidity: ${payload.humidity}%   |   Rainfall: ${payload.rainfall} mm`);

    sectionTitle('3. Crop Recommendation (Machine Learning)');
    doc.font('Helvetica-Bold').text(`Recommended Crop: ${payload.cropRecommendation.displayName} (Suitability: ${payload.cropRecommendation.confidenceScore}%)`);
    doc.font('Helvetica').text(payload.cropRecommendation.explanation);

    sectionTitle('4. Fertilizer Guidance');
    doc.font('Helvetica-Bold').text(`Primary Recommendation: ${payload.fertilizerRecommendation.recommendedFertilizer}`);
    doc.font('Helvetica').text(payload.fertilizerRecommendation.explanation);
    doc.text(`Organic Alternatives: ${payload.fertilizerRecommendation.organicAlternatives.slice(0, 2).join('; ')}`);

    sectionTitle('5. Irrigation Planning');
    doc.font('Helvetica-Bold').text(`Irrigation Requirement: ${payload.irrigationPlan.level} (~${payload.irrigationPlan.estimatedWeeklyMm} mm/week, ${payload.irrigationPlan.estimatedSeasonalMm} mm seasonal deficit)`);
    doc.font('Helvetica').text(payload.irrigationPlan.explanation);

    sectionTitle('6. Yield Prediction');
    doc.text(`Predicted Yield: ${payload.yieldPrediction.yieldTonnesPerHa} tonnes/ha (${payload.yieldPrediction.yieldQuintalsPerAcre} quintals/acre)`);
    doc.text(`Estimated Total Production: ${payload.yieldPrediction.totalEstimatedTonnes} tonnes (${payload.yieldPrediction.totalEstimatedQuintals} quintals)`);

    sectionTitle('7. Agricultural Risk Assessment');
    doc.font('Helvetica-Bold').text(`Overall Risk Level: ${payload.riskAssessment.overallLevel} (Risk Index: ${payload.riskAssessment.riskScore}/100)`);
    doc.font('Helvetica').text(payload.riskAssessment.managementSummary);

    if (payload.profitEstimate) {
      sectionTitle('8. Farm Profit & ROI Estimate');
      doc.text(`Total Cultivation Cost: INR ${payload.profitEstimate.totalCost.toLocaleString('en-IN')}`);
      doc.text(`Expected Revenue: INR ${payload.profitEstimate.expectedRevenue.toLocaleString('en-IN')}`);
      doc.text(`Estimated Net Profit: INR ${payload.profitEstimate.estimatedProfit.toLocaleString('en-IN')} (ROI: ${payload.profitEstimate.roiPercent}%)`);
    }

    doc.moveDown(1.2);
    doc.fontSize(8.5).fillColor('#6B7280').text(
      'Disclaimer: Machine learning predictions and indicative soil scores are decision-support estimates. Validate bulk fertilizer dosages and high-value farm investments with certified laboratory soil tests and regional agricultural extension officers.'
    );

    doc.end();
  });

  return { fileName, buffer };
}
