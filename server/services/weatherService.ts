import { config } from '../config.ts';

export interface WeatherForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  humidity: number;
  rainMm: number;
  condition: string;
}

export interface WeatherResponse {
  available: boolean;
  provider: 'OpenWeatherMap' | 'Open-Meteo' | 'Unavailable';
  location: string;
  resolvedName: string;
  current: {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeedKmh: number;
    condition: string;
  } | null;
  forecast: WeatherForecastDay[];
  alerts: Array<{ severity: 'Moderate' | 'High'; title: string; detail: string }>;
  cropPlanningImpact: string;
  errorMessage?: string;
}

function wmoCodeToCondition(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Fog / Mist';
  if (code <= 57) return 'Light Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow / Hail';
  if (code <= 82) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

function buildAlertsAndImpact(temp: number, humidity: number, total5DayRain: number) {
  const alerts: WeatherResponse['alerts'] = [];
  if (temp >= 37) {
    alerts.push({
      severity: 'High',
      title: 'Heat Stress Advisory',
      detail: `Daytime temperature (${temp.toFixed(1)}°C) may accelerate evapotranspiration and stress flowering crops.`,
    });
  } else if (temp <= 10) {
    alerts.push({
      severity: 'Moderate',
      title: 'Cool Temperature Watch',
      detail: `Cool ambient conditions (${temp.toFixed(1)}°C) can slow germination in warm-season crops.`,
    });
  }

  if (total5DayRain >= 80) {
    alerts.push({
      severity: 'High',
      title: 'Heavy Rainfall Alert',
      detail: `Forecasted 5-day rainfall (${total5DayRain.toFixed(1)} mm) warrants clearing drainage channels and delaying fertilizer top-dressing.`,
    });
  } else if (total5DayRain < 3 && humidity < 45) {
    alerts.push({
      severity: 'Moderate',
      title: 'Dry Spell Notice',
      detail: 'Minimal rain and low humidity ahead; schedule preventive root-zone irrigation and mulching.',
    });
  }

  if (humidity >= 85 && temp >= 22) {
    alerts.push({
      severity: 'Moderate',
      title: 'Fungal Canopy Risk',
      detail: `High humidity (${Math.round(humidity)}%) favors leaf blight and mildew; scout lower canopy regularly.`,
    });
  }

  const impact =
    alerts.length > 0
      ? alerts.map((a) => `${a.title}: ${a.detail}`).join(' ')
      : `Favorable short-term conditions (${temp.toFixed(1)}°C, ${Math.round(humidity)}% RH, ${total5DayRain.toFixed(1)} mm 5-day rain) support normal sowing, irrigation, and field operations.`;

  return { alerts, impact };
}

export async function getWeatherForLocation(locationQuery: string): Promise<WeatherResponse> {
  const cleanLoc = (locationQuery || 'Guntur').trim();

  // 1. Try OpenWeatherMap if user configured OPENWEATHER_API_KEY
  if (config.openWeatherApiKey && config.openWeatherApiKey.trim().length > 5) {
    try {
      const curUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cleanLoc)}&units=metric&appid=${config.openWeatherApiKey}`;
      const fUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(cleanLoc)}&units=metric&appid=${config.openWeatherApiKey}`;
      const [curRes, fRes] = await Promise.all([fetch(curUrl), fetch(fUrl)]);
      if (curRes.ok && fRes.ok) {
        const curJson = (await curRes.json()) as any;
        const fJson = (await fRes.json()) as any;
        const rain1h = curJson.rain?.['1h'] || curJson.rain?.['3h'] || 0;

        const byDate: Record<string, WeatherForecastDay> = {};
        for (const item of fJson.list || []) {
          const d = String(item.dt_txt).split(' ')[0];
          const r = item.rain?.['3h'] || 0;
          if (!byDate[d]) {
            byDate[d] = {
              date: d,
              tempMin: item.main.temp_min,
              tempMax: item.main.temp_max,
              humidity: item.main.humidity,
              rainMm: r,
              condition: item.weather?.[0]?.main || 'Clear',
            };
          } else {
            byDate[d].tempMin = Math.min(byDate[d].tempMin, item.main.temp_min);
            byDate[d].tempMax = Math.max(byDate[d].tempMax, item.main.temp_max);
            byDate[d].rainMm = Number((byDate[d].rainMm + r).toFixed(1));
          }
        }
        const forecast = Object.values(byDate).slice(0, 5);
        const total5DayRain = forecast.reduce((a, b) => a + b.rainMm, 0);
        const { alerts, impact } = buildAlertsAndImpact(curJson.main.temp, curJson.main.humidity, total5DayRain);

        return {
          available: true,
          provider: 'OpenWeatherMap',
          location: cleanLoc,
          resolvedName: `${curJson.name}, ${curJson.sys?.country || ''}`.trim(),
          current: {
            temperature: Number(curJson.main.temp.toFixed(1)),
            humidity: Math.round(curJson.main.humidity),
            rainfall: Number((rain1h * 20 + total5DayRain * 2).toFixed(1)),
            windSpeedKmh: Number(((curJson.wind?.speed || 0) * 3.6).toFixed(1)),
            condition: curJson.weather?.[0]?.description || 'Clear',
          },
          forecast,
          alerts,
          cropPlanningImpact: impact,
        };
      }
    } catch {
      // Fall through to Open-Meteo live fallback
    }
  }

  // 2. Live Open-Meteo Geocoding + Forecast (free, no key required)
  try {
    const cityToken = cleanLoc.split(',')[0].trim();
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityToken)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout(4500) }
    );
    if (!geoRes.ok) throw new Error('Geocoding unreachable');
    const geoJson = (await geoRes.json()) as any;
    const place = geoJson.results?.[0];
    if (!place) throw new Error(`Location "${cleanLoc}" not found`);

    const metRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,relative_humidity_2m_mean&timezone=auto&forecast_days=5`,
      { signal: AbortSignal.timeout(4500) }
    );
    if (!metRes.ok) throw new Error('Weather API unreachable');
    const metJson = (await metRes.json()) as any;

    const cur = metJson.current;
    const daily = metJson.daily;
    const forecast: WeatherForecastDay[] = (daily.time || []).map((date: string, i: number) => ({
      date,
      tempMin: Number((daily.temperature_2m_min?.[i] ?? cur.temperature_2m).toFixed(1)),
      tempMax: Number((daily.temperature_2m_max?.[i] ?? cur.temperature_2m).toFixed(1)),
      humidity: Math.round(daily.relative_humidity_2m_mean?.[i] ?? cur.relative_humidity_2m),
      rainMm: Number((daily.precipitation_sum?.[i] ?? 0).toFixed(1)),
      condition: wmoCodeToCondition(daily.weather_code?.[i] ?? 0),
    }));

    const total5DayRain = forecast.reduce((a, b) => a + b.rainMm, 0);
    const { alerts, impact } = buildAlertsAndImpact(cur.temperature_2m, cur.relative_humidity_2m, total5DayRain);

    return {
      available: true,
      provider: 'Open-Meteo',
      location: cleanLoc,
      resolvedName: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
      current: {
        temperature: Number(cur.temperature_2m.toFixed(1)),
        humidity: Math.round(cur.relative_humidity_2m),
        rainfall: Number(Math.max(40, (cur.precipitation || 0) * 15 + total5DayRain * 3.5).toFixed(1)),
        windSpeedKmh: Number((cur.wind_speed_10m || 0).toFixed(1)),
        condition: wmoCodeToCondition(cur.weather_code ?? 0),
      },
      forecast,
      alerts,
      cropPlanningImpact: impact,
    };
  } catch (err: any) {
    return {
      available: false,
      provider: 'Unavailable',
      location: cleanLoc,
      resolvedName: cleanLoc,
      current: null,
      forecast: [],
      alerts: [],
      cropPlanningImpact:
        'Live weather API is currently unavailable or offline. Please enter Temperature, Humidity, and Rainfall manually in the Crop Planning form.',
      errorMessage: err?.message || 'Weather service unavailable',
    };
  }
}
