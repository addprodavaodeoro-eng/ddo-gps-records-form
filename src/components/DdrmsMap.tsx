import { useEffect, useRef, useState } from 'react';
import { Member } from '../types.ts';
import { Navigation, MapPin } from 'lucide-react';

interface DdrmsMapProps {
  members: Member[];
  selectedMember?: Member | null;
  onSelectMember?: (member: Member) => void;
  height?: string;
  interactive?: boolean;
  previewLocation?: { lat: number; lng: number } | null;
  onPreviewLocationChange?: (lat: number, lng: number) => void;
}

declare global {
  interface Window {
    L: any;
  }
}

export default function DdrmsMap({
  members,
  selectedMember,
  onSelectMember,
  height = '450px',
  interactive = true,
  previewLocation,
  onPreviewLocationChange
}: DdrmsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const previewMarkerRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Load Leaflet dynamically to prevent build-time SSR issues or bundle size bloat
  useEffect(() => {
    let cssLink = document.getElementById('leaflet-css') as HTMLLinkElement;
    if (!cssLink) {
      cssLink = document.createElement('link');
      cssLink.id = 'leaflet-css';
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(cssLink);
    }

    let jsScript = document.getElementById('leaflet-js') as HTMLScriptElement;
    if (!jsScript) {
      jsScript = document.createElement('script');
      jsScript.id = 'leaflet-js';
      jsScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      jsScript.onload = () => setLeafletLoaded(true);
      document.body.appendChild(jsScript);
    } else {
      if (window.L) {
        setLeafletLoaded(true);
      } else {
        jsScript.addEventListener('load', () => setLeafletLoaded(true));
      }
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;

    const L = window.L;
    
    // Default focus: Nabunturan, Davao de Oro
    const centerLat = 7.602;
    const centerLng = 125.965;

    // Create Map
    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 10,
      zoomControl: interactive,
      scrollWheelZoom: interactive,
      dragging: interactive,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Handle map click for placing preview coordinates on the public form
    if (interactive && onPreviewLocationChange) {
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        onPreviewLocationChange(lat, lng);
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded]);

  // Update Markers when members or preview location change
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    // Clear existing markers
    markersGroupRef.current.clearLayers();

    // 1. Plot member markers
    if (members && members.length > 0) {
      members.forEach((member) => {
        if (!member.latitude || !member.longitude) return;

        // Custom Marker Pin Colors based on Risk level
        let color = '#10B981'; // Green (Low Risk)
        if (member.riskLevel === 'Medium Risk') color = '#FBBF24'; // Yellow
        if (member.riskLevel === 'High Risk') color = '#EF4444'; // Red

        // Create Custom Leaflet DivIcon representing hazard rating
        const customIcon = L.divIcon({
          html: `<div class="relative w-8 h-8 flex items-center justify-center">
                   <div class="absolute inset-0 rounded-full opacity-30 animate-ping" style="background-color: ${color};"></div>
                   <div class="w-4 h-4 rounded-full shadow-lg border-2 border-white" style="background-color: ${color};"></div>
                 </div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -10],
        });

        const gMapsUrl = `https://www.google.com/maps/search/?api=1&query=${member.latitude},${member.longitude}`;

        const popupContent = `
          <div class="p-3 font-sans max-w-xs text-slate-800">
            <h4 class="font-bold text-base text-slate-900 border-b pb-1 mb-2">${member.fullName}</h4>
            <div class="space-y-1.5 text-xs">
              <p><strong>Locale:</strong> ${member.localeName}</p>
              <p><strong>Phone:</strong> ${member.cellphoneNumber}</p>
              <p><strong>Family Head:</strong> ${member.familyHeadName || 'None assigned'}</p>
              <p><strong>Coordinates:</strong> ${member.latitude.toFixed(5)}, ${member.longitude.toFixed(5)}</p>
              <p class="flex items-center gap-1 mt-1 font-semibold">
                <strong>UP NOAH Risk:</strong> 
                <span class="px-2 py-0.5 rounded text-white" style="background-color: ${color}; font-size: 10px;">
                  ${member.riskLevel}
                </span>
              </p>
            </div>
            <a href="${gMapsUrl}" target="_blank" referrerPolicy="no-referrer" 
               class="flex items-center justify-center gap-1.5 w-full mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-navigation"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              Google Maps Navigate
            </a>
          </div>
        `;

        const marker = L.marker([member.latitude, member.longitude], { icon: customIcon })
          .bindPopup(popupContent)
          .addTo(markersGroupRef.current);

        marker.on('click', () => {
          if (onSelectMember) onSelectMember(member);
        });
      });
    }

    // 2. Plot custom form preview location marker if active
    if (previewLocation) {
      if (previewMarkerRef.current) {
        map.removeLayer(previewMarkerRef.current);
      }

      const previewIcon = L.divIcon({
        html: `<div class="relative w-8 h-8 flex items-center justify-center">
                 <div class="absolute inset-0 rounded-full bg-blue-500 opacity-40 animate-pulse"></div>
                 <div class="w-5 h-5 rounded-full shadow-lg border-2 border-white bg-blue-600 flex items-center justify-center text-white">
                   <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                 </div>
               </div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      previewMarkerRef.current = L.marker([previewLocation.lat, previewLocation.lng], { icon: previewIcon })
        .addTo(map)
        .bindPopup(`
          <div class="p-2 font-sans text-xs">
            <p class="font-bold text-blue-600">Selected GPS Location</p>
            <p class="text-slate-500">${previewLocation.lat.toFixed(5)}, ${previewLocation.lng.toFixed(5)}</p>
            <p class="text-[10px] text-slate-400 mt-1">Drag map or click anywhere to reposition.</p>
          </div>
        `)
        .openPopup();

      // Pan to preview location
      map.setView([previewLocation.lat, previewLocation.lng], 13);
    } else {
      if (previewMarkerRef.current) {
        map.removeLayer(previewMarkerRef.current);
        previewMarkerRef.current = null;
      }
    }
  }, [members, previewLocation, leafletLoaded]);

  // Handle selected member focus changes
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !selectedMember) return;
    const map = mapInstanceRef.current;
    if (selectedMember.latitude && selectedMember.longitude) {
      map.setView([selectedMember.latitude, selectedMember.longitude], 14);
    }
  }, [selectedMember, leafletLoaded]);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-slate-50">
      {!leafletLoaded && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white bg-opacity-80">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-2"></div>
          <p className="text-sm font-medium text-slate-600">Loading Geohazard Mapping...</p>
        </div>
      )}
      <div id="ddrms-leaflet-map" ref={mapContainerRef} style={{ height }} className="w-full z-10" />
    </div>
  );
}
