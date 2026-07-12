export interface RiskAssessmentResult {
  riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk';
  hazardSource: string;
}

// Coordinate centers of historically documented high-hazard zones in Davao de Oro
const HAZARD_ZONES = [
  {
    name: 'Diwalwal Mountainous Landslide Zone',
    lat: 7.828,
    lng: 126.155,
    riskLevel: 'High Risk' as const,
    hazardSource: 'UP NOAH Category: Severe Landslide Susceptibility (Steep Mining Slopes)',
    radiusKm: 8.0,
  },
  {
    name: 'New Bataan Debris Flow Zone',
    lat: 7.415,
    lng: 126.132,
    riskLevel: 'High Risk' as const,
    hazardSource: 'UP NOAH Category: Extreme Debris Flow & Landslide Hazard (Typhoon Path Basin)',
    radiusKm: 7.5,
  },
  {
    name: 'Maragusan Alpine Slip Zone',
    lat: 7.332,
    lng: 126.123,
    riskLevel: 'High Risk' as const,
    hazardSource: 'UP NOAH Category: High Landslide Susceptibility (Alpine Valley Fracture Lines)',
    radiusKm: 8.5,
  },
  {
    name: 'Agusan River Basin Lowland Flood Plain',
    lat: 7.811,
    lng: 126.054,
    riskLevel: 'Medium Risk' as const,
    hazardSource: 'UP NOAH Category: High Flooding Susceptibility (Agusan River Drainage Plain)',
    radiusKm: 6.0,
  },
  {
    name: 'Nabunturan Basin Liquefaction Zone',
    lat: 7.602,
    lng: 125.965,
    riskLevel: 'Medium Risk' as const,
    hazardSource: 'UP NOAH Category: Moderate Flood & Liquefaction Susceptibility',
    radiusKm: 5.0,
  }
];

// Haversine formula to calculate distance in kilometers
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function assessRiskLevel(latitude: number, longitude: number, localeName: string): RiskAssessmentResult {
  // First, check distance to high risk hazard zones
  for (const zone of HAZARD_ZONES) {
    const distance = getDistanceKm(latitude, longitude, zone.lat, zone.lng);
    if (distance <= zone.radiusKm) {
      return {
        riskLevel: zone.riskLevel,
        hazardSource: zone.hazardSource,
      };
    }
  }

  // Locale-specific defaults if we fall outside specific hazard radii but match high-risk locales
  const upperLocale = localeName.trim().toUpperCase();
  if (['DIWALWAL', 'NEW BATAAN', 'MARAGUSAN', 'MAINIT'].includes(upperLocale)) {
    return {
      riskLevel: 'High Risk',
      hazardSource: 'UP NOAH Alert: Historical Landslide/Debris Zone (Locale High-Risk Terrain)',
    };
  }

  if (['NABUNTURAN', 'MONKAYO', 'PROSPERIDAD'].includes(upperLocale)) {
    return {
      riskLevel: 'Medium Risk',
      hazardSource: 'UP NOAH Alert: Moderate Flooding Area (Locale Lowland Basin)',
    };
  }

  // Fallback default
  return {
    riskLevel: 'Low Risk',
    hazardSource: 'UP NOAH Category: Low Risk Geohazard Zone (Stable Terrain)',
  };
}
