import React, { useEffect, useState } from 'react';
import { ActiveFarmBanner } from '../components/ActiveFarmBanner';
import { AgroDoughnutChart } from '../components/Charts';
import { useApp } from '../context/AppContext';

export const ProfitPage: React.FC = () => {
  const { activeBundle, apiFetch, tr } = useApp();

  const [cropName, setCropName] = useState(activeBundle?.cropRecommendation.recommendedCrop || 'maize');
  const [areaAcres, setAreaAcres] = useState(String(activeBundle?.farm.areaAcres ?? 3.5));
  const [expectedQuintals, setExpectedQuintals] = useState(
    String(activeBundle?.yieldPrediction.totalEstimatedQuintals ?? 45)
  );
  const [seedsCost, setSeedsCost] = useState('4500');
  const [fertilizerCost, setFertilizerCost] = useState('9200');
  const [labourCost, setLabourCost] = useState('16500');
  const [irrigationCost, setIrrigationCost] = useState('4800');
  const [otherCost, setOtherCost] = useState('3500');
  const [sellingPrice, setSellingPrice] = useState('2350');
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeBundle) {
      setCropName(activeBundle.cropRecommendation.recommendedCrop);
      setAreaAcres(String(activeBundle.farm.areaAcres));
      setExpectedQuintals(String(activeBundle.yieldPrediction.totalEstimatedQuintals));
    }
  }, [activeBundle?.farm.id]);

  const loadHistory = async () => {
    const res = await apiFetch('/api/profit');
    if (res.ok) {
      const d = await res.json();
      setHistory(d.history || []);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const totalCostLive =
    Number(seedsCost || 0) +
    Number(fertilizerCost || 0) +
    Number(labourCost || 0) +
    Number(irrigationCost || 0) +
    Number(otherCost || 0);
  const expectedRevenueLive = Number(expectedQuintals || 0) * Number(sellingPrice || 0);
  const estimatedProfitLive = expectedRevenueLive - totalCostLive;
  const costPerAcreLive = Number(areaAcres) > 0 ? totalCostLive / Number(areaAcres) : 0;
  const roiLive = totalCostLive > 0 ? (estimatedProfitLive / totalCostLive) * 100 : 0;

  const saveCalculation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/profit', {
        method: 'POST',
        body: JSON.stringify({
          farmId: activeBundle?.farm.id || null,
          cropName,
          areaAcres: Number(areaAcres),
          expectedQuintals: Number(expectedQuintals),
          seedsCost: Number(seedsCost),
          fertilizerCost: Number(fertilizerCost),
          labourCost: Number(labourCost),
          irrigationCost: Number(irrigationCost),
          otherCost: Number(otherCost),
          sellingPricePerQuintal: Number(sellingPrice),
        }),
      });
      if (res.ok) {
        setResult(await res.json());
        loadHistory();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navProfit')}</h1>
        <p className="text-sm text-emerald-900/75 mt-0.5">
          Calculate cultivation expenses, revenue from ML-predicted yield, cost per acre, and return on investment.
        </p>
      </div>

      <ActiveFarmBanner />

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={saveCalculation} className="lg:col-span-6 rounded-xl bg-white border border-emerald-200/80 p-5 sm:p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-[#0D3B26]">Season Expenses & Market Price</h2>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">Crop</label>
              <input
                type="text"
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-200 capitalize"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">Area (Acres)</label>
              <input
                type="number"
                step="0.1"
                value={areaAcres}
                onChange={(e) => setAreaAcres(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">Yield (Quintals)</label>
              <input
                type="number"
                step="0.1"
                value={expectedQuintals}
                onChange={(e) => setExpectedQuintals(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">Seeds Cost (INR)</label>
              <input
                type="number"
                min="0"
                value={seedsCost}
                onChange={(e) => setSeedsCost(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">Fertilizer Cost (INR)</label>
              <input
                type="number"
                min="0"
                value={fertilizerCost}
                onChange={(e) => setFertilizerCost(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">Labour Cost (INR)</label>
              <input
                type="number"
                min="0"
                value={labourCost}
                onChange={(e) => setLabourCost(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">Irrigation Cost (INR)</label>
              <input
                type="number"
                min="0"
                value={irrigationCost}
                onChange={(e) => setIrrigationCost(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">Other Expenses (INR)</label>
              <input
                type="number"
                min="0"
                value={otherCost}
                onChange={(e) => setOtherCost(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">Expected Selling Price (INR/q)</label>
              <input
                type="number"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800"
          >
            {saving ? 'Saving Estimate...' : 'Save Profit Estimate to Farm Record'}
          </button>
          {result && (
            <div className="text-xs text-emerald-800 bg-[#F0FDF4] border border-emerald-200 rounded-lg p-2.5">
              Saved profit calculation #{result.id}. Included automatically in PDF farm reports.
            </div>
          )}
        </form>

        <div className="lg:col-span-6 space-y-5">
          <div className="rounded-xl bg-[#F0FDF4] border border-emerald-300 p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-[#0D3B26]">Financial Projection Summary</h2>
            <div className="grid grid-cols-2 gap-3.5">
              <div className="rounded-lg bg-white border border-emerald-200 p-3.5">
                <div className="text-xs text-emerald-800">Total Cultivation Cost</div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] mt-1 tabular-nums">
                  ₹{totalCostLive.toLocaleString('en-IN')}
                </div>
                <div className="text-xs font-mono text-emerald-800/75">
                  ₹{Math.round(costPerAcreLive).toLocaleString('en-IN')}/acre
                </div>
              </div>
              <div className="rounded-lg bg-white border border-emerald-200 p-3.5">
                <div className="text-xs text-emerald-800">Expected Revenue</div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] mt-1 tabular-nums">
                  ₹{expectedRevenueLive.toLocaleString('en-IN')}
                </div>
                <div className="text-xs font-mono text-emerald-800/75">{expectedQuintals} q × ₹{sellingPrice}</div>
              </div>
              <div className="rounded-lg bg-white border border-emerald-200 p-3.5">
                <div className="text-xs text-emerald-800">Estimated {estimatedProfitLive >= 0 ? 'Net Profit' : 'Net Loss'}</div>
                <div
                  className={`font-mono text-xl font-bold mt-1 tabular-nums ${
                    estimatedProfitLive >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  ₹{estimatedProfitLive.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="rounded-lg bg-white border border-emerald-200 p-3.5">
                <div className="text-xs text-emerald-800">Return on Investment (ROI)</div>
                <div
                  className={`font-mono text-xl font-bold mt-1 tabular-nums ${
                    roiLive >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {roiLive.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
            <h3 className="font-display text-base font-bold text-[#0D3B26] mb-3">Cost Allocation Breakdown</h3>
            <div className="h-56">
              <AgroDoughnutChart
                labels={['Seeds', 'Fertilizer', 'Labour', 'Irrigation', 'Other']}
                values={[
                  Number(seedsCost || 0),
                  Number(fertilizerCost || 0),
                  Number(labourCost || 0),
                  Number(irrigationCost || 0),
                  Number(otherCost || 0),
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
          <h3 className="font-display text-base font-bold text-[#0D3B26] mb-3">Saved Profit Calculations</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F5F8F6] text-xs text-emerald-900">
                <tr>
                  <th className="text-left px-4 py-2.5">Crop</th>
                  <th className="text-right px-4 py-2.5">Area</th>
                  <th className="text-right px-4 py-2.5">Total Cost</th>
                  <th className="text-right px-4 py-2.5">Revenue</th>
                  <th className="text-right px-4 py-2.5">Net Profit</th>
                  <th className="text-right px-4 py-2.5">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2.5 capitalize font-medium text-[#0D3B26]">{h.crop_name}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{h.area_acres} ac</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">₹{h.total_cost.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">₹{h.expected_revenue.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold">
                      ₹{h.estimated_profit.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{h.roi_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
