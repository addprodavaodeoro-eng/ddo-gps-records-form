import { useState, useEffect } from 'react';
import { MapPin, Crosshair, AlertTriangle } from 'lucide-react';
import DdrmsMap from './DdrmsMap.tsx';
import { assessRiskLevel } from '../utils/noah.ts';

interface MapInterfaceProps {
  onLocationSelect: (lat: number, lng: number, riskLevel: string) => void;
  defaultLocaleName?: string;
  height?: string;
  initialLat?: number | null;
  initialLng?: number | null;
}

export default function MapInterface({ 
  onLocationSelect, 
  defaultLocaleName = 'Davao de Oro',
  height = '300px',
  initialLat = null,
  initialLng = null
}: MapInterfaceProps) {
  const [latitude, setLatitude] = useState<number | null>(initialLat);
  const [longitude, setLongitude] = useState<number | null>(initialLng);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatedRisk = (latitude !== null && longitude !== null)
    ? assessRiskLevel(latitude, longitude, defaultLocaleName)
    : null;

  // Whenever the coordinates change and we calculate a risk, bubble it up.
  useEffect(() => {
    if (latitude !== null && longitude !== null && calculatedRisk) {
      onLocationSelect(latitude, longitude, calculatedRisk.riskLevel);
    }
  }, [latitude, longitude, calculatedRisk?.riskLevel]);

  const handleGetLocation = () => {
    setIsLocating(true);
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocation is not supported. Please tap on the map to pin.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        setError('Could not get exact GPS. Tap the map to set your location manually.');
        setLatitude(7.602 + (Math.random() - 0.5) * 0.05);
        setLongitude(125.965 + (Math.random() - 0.5) * 0.05);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleMapLocationChange = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  return (
    <div className="flex flex-col gap-3 mt-4 mb-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Geohazard Map & Location <span className="text-emerald-500">*</span>
        </label>
      </div>
      
      {/* Risk Assessment Banner */}
      {calculatedRisk ? (
        <div className={`px-3 py-2.5 rounded-lg border flex items-center justify-between ${
          calculatedRisk.riskLevel === 'High Risk' ? 'bg-red-50 border-red-200' :
          calculatedRisk.riskLevel === 'Medium Risk' ? 'bg-amber-50 border-amber-200' :
          'bg-emerald-50 border-emerald-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className={`w-5 h-5 ${
              calculatedRisk.riskLevel === 'High Risk' ? 'text-red-600' :
              calculatedRisk.riskLevel === 'Medium Risk' ? 'text-amber-600' :
              'text-emerald-600'
            }`} />
            <div>
              <p className={`text-[11px] font-bold uppercase tracking-wider ${
                calculatedRisk.riskLevel === 'High Risk' ? 'text-red-800' :
                calculatedRisk.riskLevel === 'Medium Risk' ? 'text-amber-800' :
                'text-emerald-800'
              }`}>{calculatedRisk.riskLevel} Zone</p>
              <p className={`text-[9px] font-medium mt-0.5 ${
                calculatedRisk.riskLevel === 'High Risk' ? 'text-red-600/80' :
                calculatedRisk.riskLevel === 'Medium Risk' ? 'text-amber-600/80' :
                'text-emerald-600/80'
              }`}>{calculatedRisk.hazardSource}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2.5">
          <MapPin className="w-5 h-5 text-slate-400" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">No Location Pinned</p>
            <p className="text-[9px] font-medium text-slate-400 mt-0.5">Risk level will be assessed upon pinning your location.</p>
          </div>
        </div>
      )}

      {/* Map Area */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50">
        
        {/* Floating Controls */}
        <div className="absolute top-3 right-3 z-20">
          <button 
            type="button"
            onClick={handleGetLocation} 
            disabled={isLocating}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur border border-slate-200 rounded-lg shadow text-xs font-bold text-slate-700 hover:bg-white hover:text-emerald-600 transition-all disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {isLocating ? (
              <div className="animate-spin w-3.5 h-3.5 border-2 border-slate-700 border-t-transparent rounded-full" />
            ) : (
              <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
            )}
            {isLocating ? 'Locating...' : 'Get GPS'}
          </button>
        </div>

        {error && (
          <div className="absolute top-14 right-3 z-20 max-w-[200px] p-2 bg-red-100/95 backdrop-blur border border-red-200 text-red-800 text-[10px] leading-tight font-medium rounded shadow-md">
            {error}
          </div>
        )}

        <DdrmsMap 
          members={[]} 
          previewLocation={latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null}
          onPreviewLocationChange={handleMapLocationChange}
          height={height}
          interactive={true}
        />

        {/* Footer Coordinate Bar */}
        <div className="absolute bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t border-slate-200 px-3 py-1.5 z-20 flex justify-between items-center pointer-events-none">
          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-500" />
            {latitude !== null && longitude !== null ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : 'Tap map to pin'}
          </span>
        </div>
      </div>
    </div>
  );
}
