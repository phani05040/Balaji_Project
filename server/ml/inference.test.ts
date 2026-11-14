import { describe, expect, it } from 'vitest';
import { computeSoilHealth } from './inference.ts';

describe('computeSoilHealth', () => {
  it('rates balanced NPK and optimal pH as optimal soil health', () => {
    const result = computeSoilHealth({
      location: 'Test farm',
      areaAcres: 1,
      nitrogen: 75,
      phosphorus: 50,
      potassium: 45,
      ph: 6.6,
      temperature: 25,
      humidity: 60,
      rainfall: 800,
    });

    expect(result.score).toBe(100);
    expect(result.rating).toBe('Optimal');
    expect(result.suggestions).toHaveLength(1);
  });
});
