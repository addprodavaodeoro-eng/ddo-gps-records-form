import { useState, useEffect, FormEvent } from 'react';
import { Locale, FamilyHead, Staff } from '../types.ts';
import DdrmsMap from './DdrmsMap.tsx';
import { 
  MapPin, 
  Phone, 
  User, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle, 
  Users, 
  PhoneCall,
  Lock
} from 'lucide-react';

interface PublicFormProps {
  onAdminLoginClick: () => void;
  localesList: Locale[];
  familyHeadsList: FamilyHead[];
  staffList: Staff[];
}

export default function PublicForm({
  onAdminLoginClick,
  localesList,
  familyHeadsList,
  staffList
}: PublicFormProps) {
  // Form fields
  const [fullName, setFullName] = useState('');
  const [cellphoneNumber, setCellphoneNumber] = useState('');
  const [selectedLocaleId, setSelectedLocaleId] = useState('');
  const [selectedFamilyRole, setSelectedFamilyRole] = useState<'FATHER' | 'MOTHER' | ''>('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // UI state
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Filtered lists
  const [filteredFamilyHeads, setFilteredFamilyHeads] = useState<FamilyHead[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);

  // Update filtered family heads and staff based on selected locale
  useEffect(() => {
    if (selectedLocaleId) {
      const lid = parseInt(selectedLocaleId);
      setFilteredFamilyHeads(familyHeadsList.filter(fh => fh.localeId === lid));
      setFilteredStaff(staffList.filter(s => s.assignedLocaleId === lid && s.status === 'Active'));
    } else {
      setFilteredFamilyHeads([]);
      setFilteredStaff(staffList.filter(s => s.status === 'Active'));
    }
  }, [selectedLocaleId, familyHeadsList, staffList]);

  // Retrieve GPS Coordinates
  const handleGetLocation = () => {
    setIsLocating(true);
    setFormError(null);

    if (!navigator.geolocation) {
      setFormError('Your browser does not support Geolocation. Please enter coordinates manually or pin them on the map.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error('GPS retrieval error:', error);
        // Fallback: use approximate coordinates of Davao de Oro
        setLatitude(7.602 + (Math.random() - 0.5) * 0.05);
        setLongitude(125.965 + (Math.random() - 0.5) * 0.05);
        setFormError('Unable to retrieve exact GPS location. Showing approximate regional location. You can click on the map to pin your home accurately.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Callback when user clicks on map preview to set coordinates manually
  const handleMapLocationChange = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const handleOpenConfirm = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!cellphoneNumber.trim()) {
      setFormError('Please enter your cellphone number.');
      return;
    }
    if (!selectedLocaleId) {
      setFormError('Please select your locale.');
      return;
    }
    if (latitude === null || longitude === null) {
      setFormError('Please capture your GPS location using the locator button or click on the map.');
      return;
    }

    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName,
          cellphoneNumber,
          localeId: parseInt(selectedLocaleId),
          familyHeadId: (() => {
            if (selectedFamilyRole && selectedLocaleId) {
              const lid = parseInt(selectedLocaleId);
              const matchedFH = familyHeadsList.find(
                fh => fh.localeId === lid && fh.genderRole?.toUpperCase() === selectedFamilyRole.toUpperCase()
              );
              return matchedFH ? matchedFH.id : null;
            }
            return null;
          })(),
          latitude,
          longitude,
          address
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit location survey.');
      }

      setFormSuccess('Thank you! Your GPS hazard survey has been saved successfully. The DRRM administration is assessing your zone risk.');
      
      // Reset form fields
      setFullName('');
      setCellphoneNumber('');
      setSelectedLocaleId('');
      setSelectedFamilyRole('');
      setAddress('');
      setLatitude(null);
      setLongitude(null);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="public-portal">
      {/* Government Style Branding Header */}
      <header className="bg-slate-950 text-slate-300 border-b border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
              <span className="text-xl">D</span>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Republic of the Philippines</p>
              <h1 className="text-lg md:text-xl font-bold tracking-tight leading-none text-white">DDRMS</h1>
              <p className="text-[10px] text-slate-400 font-medium mt-1">Disaster Risk Management & Member Hazard Mapping Portal • Davao de Oro</p>
            </div>
          </div>
          
          <button
            onClick={onAdminLoginClick}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-800 text-slate-300 border border-slate-800 hover:text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
            id="btn-goto-login"
          >
            <Lock className="w-3.5 h-3.5" />
            DRRM Administrator Login
          </button>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Public Submission Form Panel (7 Columns) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-8 flex flex-col">
          <div className="border-b border-slate-100 pb-4 mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              DRRM Geohazard Safety Survey
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Please fill out your correct personal information. Your precise coordinates will assist local rescuers and UP NOAH integrations in assessing your home geohazard rating.
            </p>
          </div>

          {/* Success Banners */}
          {formSuccess && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3 text-xs leading-relaxed font-semibold">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-sm mb-0.5 text-emerald-900">Survey Saved Successfully</h4>
                <p>{formSuccess}</p>
              </div>
            </div>
          )}

          {/* Error Banners */}
          {formError && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-start gap-3 text-xs leading-relaxed font-semibold">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-sm mb-0.5 text-amber-900">Notification</h4>
                <p>{formError}</p>
              </div>
            </div>
          )}

          {/* Core Fields Form */}
          <form onSubmit={handleOpenConfirm} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium transition bg-white text-slate-850"
                    id="input-public-name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Cellphone Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    required
                    value={cellphoneNumber}
                    onChange={(e) => setCellphoneNumber(e.target.value)}
                    placeholder="e.g. 09123456789"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium transition bg-white text-slate-850"
                    id="input-public-phone"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Select Locale <span className="text-red-500">*</span></label>
                <select
                  required
                  value={selectedLocaleId}
                  onChange={(e) => setSelectedLocaleId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold bg-white text-slate-850 transition"
                  id="select-public-locale"
                >
                  <option value="">-- Choose Locale --</option>
                  {localesList.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Family Head <span className="text-slate-400">(Optional)</span></label>
                <select
                  value={selectedFamilyRole}
                  onChange={(e) => setSelectedFamilyRole(e.target.value as 'FATHER' | 'MOTHER' | '')}
                  disabled={!selectedLocaleId}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold bg-white text-slate-850 disabled:bg-slate-50 disabled:text-slate-400 transition cursor-pointer"
                  id="select-public-family-head"
                >
                  <option value="">-- Select Family Head --</option>
                  <option value="FATHER">Father</option>
                  <option value="MOTHER">Mother</option>
                </select>
                {!selectedLocaleId && (
                  <span className="text-[10px] text-slate-400 mt-1 block font-medium">Please select a locale first to select a Family Head.</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Complete Address <span className="text-slate-400">(Optional)</span></label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Purok, Street Name, Barangay, Landmark"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium transition bg-white text-slate-850"
                id="input-public-address"
              />
            </div>

            {/* GPS Retrieval Block */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-slate-850 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  House GPS Coordinates
                </h4>
                {latitude !== null && longitude !== null ? (
                  <p className="text-[11px] font-mono text-emerald-600 font-semibold">
                    Latitude: {latitude.toFixed(6)}, Longitude: {longitude.toFixed(6)}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 font-medium">No coordinates set. Click locator below or tap on the map to pin your home.</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating}
                className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                id="btn-public-get-gps"
              >
                {isLocating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-b-transparent rounded-full animate-spin"></div>
                    Retrieving GPS...
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5" />
                    Get Current GPS Location
                  </>
                )}
              </button>
            </div>

            {/* Live Map Preview Block */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                Interactive Map Preview
              </label>
              <div className="rounded-xl overflow-hidden border border-slate-250 shadow-inner">
                <DdrmsMap 
                  members={[]}
                  previewLocation={latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null}
                  onPreviewLocationChange={handleMapLocationChange}
                  height="260px"
                />
              </div>
              <span className="text-[9px] text-slate-400 block font-medium">
                Verify your marker position. If incorrect, tap anywhere on the map above to move the GPS target precisely.
              </span>
            </div>

            {/* Submit Control */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold tracking-wider uppercase transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
              id="btn-public-submit"
            >
              {isSubmitting ? 'Processing Submission...' : 'Submit Location Survey'}
            </button>
          </form>
        </div>

        {/* DRRM Staff Directory & Alert Sidebar (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Active Local Staff Directory */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Users className="w-4 h-4 text-emerald-500" />
              Active Local DRRM Staff
            </h3>

            {filteredStaff.length === 0 ? (
              <div className="text-center py-6 text-slate-400 font-medium text-xs">
                No active staff currently assigned to this locale. Call 911 for emergencies.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredStaff.map((s) => (
                  <div key={s.id} className="p-3 border border-slate-100 rounded-lg bg-slate-50 hover:bg-slate-100/50 transition flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-xs text-slate-800">{s.staffName}</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{s.position}</p>
                      <p className="text-[10px] text-emerald-600 font-semibold">Assigned: {s.assignedLocaleName}</p>
                    </div>
                    <a
                      href={`tel:${s.cellphoneNumber}`}
                      className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-full transition flex items-center justify-center border border-emerald-100"
                      title={`Call ${s.staffName}`}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <h4 className="font-bold text-xs text-slate-700 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-500" />
                Emergency Hotlines
              </h4>
              <p className="text-[10px] text-slate-600 font-medium mt-1">
                Davao de Oro DRRMC: <strong className="text-red-600">911</strong> or <strong>(082) 221-1234</strong>
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Keep calm and report high hazards immediately to local responders.</p>
            </div>
          </div>

          {/* UP NOAH Education Block */}
          <div className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl shadow-sm p-5 md:p-6 space-y-4">
            <h3 className="font-bold text-xs tracking-widest uppercase text-emerald-400">UP NOAH Disaster Resilience</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              The Nationwide Operational Assessment of Hazards (UP NOAH) is the flagship disaster prevention program. Submitting your coordinates allows real-time overlay of:
            </p>
            <div className="space-y-2 text-xs font-semibold text-slate-300">
              <p className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Landslide Susceptibility Layers
              </p>
              <p className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Flood Plain Heights & Overflow Areas
              </p>
              <p className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Debris Flow Tracking & Heavy Precipitation
              </p>
            </div>
            <a 
              href="https://noah.up.edu.ph/" 
              target="_blank" 
              referrerPolicy="no-referrer"
              className="inline-block mt-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 border-b border-emerald-500/20 pb-0.5 hover:border-emerald-400 transition"
            >
              Explore UP NOAH Web Platform &rarr;
            </a>
          </div>
        </div>
      </main>

      {/* Confirmation Dialog Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Survey Submission
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Are you sure you want to register your house coordinates in our safety database? Double-check that your GPS marker matches your actual home position.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                id="btn-public-submit-cancel"
              >
                No, Re-check
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
                id="btn-public-submit-confirm"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
