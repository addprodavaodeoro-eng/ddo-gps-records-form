import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { Member, Locale, FamilyHead, User } from '../types.ts';
import * as XLSX from 'xlsx';
import { 
  Users, Search, Trash2, Edit3, Filter, Phone, MapPin, CheckCircle, X,
  FileSpreadsheet, ArrowUpRight, ArrowDownLeft, AlertOctagon, HelpCircle, AlertTriangle, Printer
} from 'lucide-react';

interface MemberManagerProps {
  adminUser: User | null;
  localesList: Locale[];
  familyHeadsList: FamilyHead[];
  members: Member[];
  onRefreshData: () => void;
}

export default function MemberManager({
  adminUser,
  localesList,
  familyHeadsList,
  members,
  onRefreshData
}: MemberManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocale, setFilterLocale] = useState('');
  const [filterFamilyHead, setFilterFamilyHead] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Editing state
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocaleId, setEditLocaleId] = useState('');
  const [editFamilyHeadId, setEditFamilyHeadId] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editRiskLevel, setEditRiskLevel] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Custom modal states
  const [memberToDelete, setMemberToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [importReport, setImportReport] = useState<{ imported: number; skipped: number; failed: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter members list
  const filteredMembers = members.filter(m => {
    const nameMatch = m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      m.cellphoneNumber.includes(searchQuery);
    const localeMatch = filterLocale ? m.localeId === parseInt(filterLocale) : true;
    const fHeadMatch = filterFamilyHead ? m.familyHeadId === parseInt(filterFamilyHead) : true;
    const riskMatch = filterRisk ? m.riskLevel === filterRisk : true;
    
    let dateMatch = true;
    if (filterDate) {
      const surveyDate = new Date(m.submittedAt).toISOString().split('T')[0];
      dateMatch = surveyDate === filterDate;
    }

    return nameMatch && localeMatch && fHeadMatch && riskMatch && dateMatch;
  });

  // Handle Editing Open
  const handleOpenEdit = (m: Member) => {
    setEditingMember(m);
    setEditFullName(m.fullName);
    setEditPhone(m.cellphoneNumber);
    setEditLocaleId(String(m.localeId));
    setEditFamilyHeadId(m.familyHeadId ? String(m.familyHeadId) : '');
    setEditAddress(m.address || '');
    setEditLat(String(m.latitude));
    setEditLng(String(m.longitude));
    setEditRiskLevel(m.riskLevel || '');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim() || !editPhone.trim() || !editLocaleId || !editLat || !editLng || isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const token = localStorage.getItem('ddrms_token');

    try {
      const res = await fetch(`/api/members/${editingMember?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: editFullName.trim(),
          cellphoneNumber: editPhone.trim(),
          localeId: parseInt(editLocaleId),
          familyHeadId: editFamilyHeadId ? parseInt(editFamilyHeadId) : null,
          latitude: parseFloat(editLat),
          longitude: parseFloat(editLng),
          address: editAddress,
          riskLevel: editRiskLevel || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save edits.');
      }

      setSuccessMsg('Member survey updated successfully.');
      onRefreshData();
      setTimeout(() => {
        setEditingMember(null);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to complete update.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Deleting
  const handleDeleteClick = (id: number, name: string) => {
    setMemberToDelete({ id, name });
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    const token = localStorage.getItem('ddrms_token');

    try {
      const res = await fetch(`/api/members/${memberToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Deletion failed');
      }

      setMemberToDelete(null);
      onRefreshData();
    } catch (error) {
      console.error(error);
      setDeleteError('Failed to delete member survey.');
    } finally {
      setIsDeleting(false);
    }
  };

  // SheetJS Excel Upload
  const handleExcelImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setImportError(null);
      setImportReport(null);
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawJson.length === 0) {
          setImportError('The selected Excel sheet appears to be empty.');
          return;
        }

        const token = localStorage.getItem('ddrms_token');
        const res = await fetch('/api/members/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ data: rawJson })
        });

        const report = await res.json();
        if (!res.ok) {
          throw new Error(report.error || 'Failed to upload and import data.');
        }

        setImportReport({
          imported: report.imported,
          skipped: report.skipped,
          failed: report.failed
        });
        onRefreshData();
      } catch (err: any) {
        console.error(err);
        setImportError(err.message || 'Failed to process Excel data import.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // SheetJS Excel Export
  const handleExcelExport = () => {
    const exportData = filteredMembers.map(m => ({
      'Full Name': m.fullName,
      'Cellphone Number': m.cellphoneNumber,
      'Locale': m.localeName,
      'Family Head': m.familyHeadName || 'None',
      'Latitude': m.latitude,
      'Longitude': m.longitude,
      'Risk Level': m.riskLevel,
      'Date Submitted': new Date(m.submittedAt).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DRRMC Surveys');
    XLSX.writeFile(wb, 'ddrms_members_export.xlsx');
  };

  // SheetJS CSV Export
  const handleCSVExport = () => {
    const exportData = filteredMembers.map(m => ({
      'Full Name': m.fullName,
      'Cellphone Number': m.cellphoneNumber,
      'Locale': m.localeName,
      'Family Head': m.familyHeadName || 'None',
      'Latitude': m.latitude,
      'Longitude': m.longitude,
      'Risk Level': m.riskLevel,
      'Date Submitted': new Date(m.submittedAt).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'ddrms_members_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6" id="members-surveys-manager">
      
      {/* 1. Filtering & Action Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        
        {/* Row 1: Search & Controls */}
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="relative w-full xl:w-96">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search surveys by name, number..."
              className="w-full pl-9 pr-3 py-2 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium bg-slate-50 focus:bg-white transition text-slate-900"
              id="input-member-search"
            />
          </div>

          {/* Import/Export suites */}
          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-end">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleExcelImport}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            
            <a
              href="https://noah.up.edu.ph/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm"
              id="btn-view-noah-map-global"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              View Map (UP NOAH)
            </a>

            {adminUser?.role !== 'Staff' && (
              <>
                <button
                  onClick={handleTriggerFileInput}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
                  id="btn-import-excel"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Import Excel
                </button>

                <button
                  onClick={handleExcelExport}
                  className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer border border-emerald-200/50"
                  id="btn-export-excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export Excel
                </button>

                <button
                  onClick={handleCSVExport}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-850"
                  id="btn-export-csv"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Deep Multi-Criteria Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Locale */}
          <div className="relative">
            <select
              value={filterLocale}
              onChange={(e) => setFilterLocale(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium bg-white transition text-slate-800"
              id="select-filter-locale"
            >
              <option value="">All Locales</option>
              {localesList.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Family Head */}
          <div className="relative">
            <select
              value={filterFamilyHead}
              onChange={(e) => setFilterFamilyHead(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium bg-white transition text-slate-800"
              id="select-filter-family-head"
            >
              <option value="">All Family Heads</option>
              {familyHeadsList.map(fh => (
                <option key={fh.id} value={fh.id}>{fh.fullName}</option>
              ))}
            </select>
          </div>

          {/* Risk severity */}
          <div className="relative">
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium bg-white transition text-slate-800"
              id="select-filter-risk"
            >
              <option value="">All Risk Ratings</option>
              <option value="Low Risk">Low Risk Area</option>
              <option value="Medium Risk">Medium Risk Area</option>
              <option value="High Risk">High Risk Area</option>
            </select>
          </div>

          {/* Date Picker */}
          <div className="relative">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium bg-white transition text-slate-800"
              id="input-filter-date"
            />
          </div>
        </div>
      </div>

      {/* 2. Surveys Registry Grid Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-4">Full Name</th>
                <th className="p-4">Locale / Coordinates</th>
                <th className="p-4">Family Head</th>
                <th className="p-4">Hazard Susceptibility</th>
                <th className="p-4">Survey Date</th>
                {adminUser?.role !== 'Staff' && <th className="p-4 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-bold">
                    No location surveys currently logged.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  let badgeColor = 'bg-emerald-500';
                  if (m.riskLevel === 'Medium Risk') badgeColor = 'bg-amber-500';
                  if (m.riskLevel === 'High Risk') badgeColor = 'bg-red-500 animate-pulse';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4 space-y-0.5">
                        <div className="font-bold text-slate-900 text-sm">{m.fullName}</div>
                        <div className="text-slate-400 font-semibold flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {m.cellphoneNumber}
                        </div>
                      </td>
                      <td className="p-4 space-y-1">
                        <div className="font-bold text-slate-800">{m.localeName}</div>
                        <div className="flex flex-col gap-1">
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-emerald-500" />
                            {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}
                          </div>
                          <a
                            href="https://noah.up.edu.ph/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] font-bold text-sky-600 hover:text-sky-800 hover:underline flex items-center gap-0.5"
                          >
                            <ArrowUpRight className="w-3 h-3 text-sky-500" />
                            Verify UP NOAH Hazard
                          </a>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-600">{m.familyHeadName || 'Unassigned'}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${badgeColor}`}>
                          {m.riskLevel}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 font-bold">
                        {new Date(m.submittedAt).toLocaleDateString()}
                      </td>
                      {adminUser?.role !== 'Staff' && (
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(m)}
                              className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg border border-slate-200 transition"
                              title="Edit Member details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(m.id, m.fullName)}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg border border-red-100 transition cursor-pointer"
                              title="Delete Member details"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Edit Member details Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-lg w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Edit3 className="w-5 h-5 text-emerald-600" />
                Modify DRRM Location Survey
              </h3>
              <button 
                onClick={() => setEditingMember(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg flex items-center gap-2 text-xs font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-650" />
                <p>{successMsg}</p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <p>{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-semibold text-slate-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold transition bg-slate-50 text-slate-900"
                    id="modal-edit-name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Cellphone Number</label>
                  <input
                    type="text"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold transition bg-slate-50 text-slate-900"
                    id="modal-edit-phone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Locale</label>
                  <select
                    required
                    value={editLocaleId}
                    onChange={(e) => setEditLocaleId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-bold bg-slate-50 transition text-slate-800"
                    id="modal-edit-locale"
                  >
                    <option value="">-- Choose Locale --</option>
                    {localesList.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Family Head</label>
                  <select
                    value={editFamilyHeadId}
                    onChange={(e) => setEditFamilyHeadId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-bold bg-slate-50 transition text-slate-800"
                    id="modal-edit-fh"
                  >
                    <option value="">-- Unassigned --</option>
                    {familyHeadsList.map(fh => (
                      <option key={fh.id} value={fh.id}>{fh.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition bg-slate-50 text-slate-900"
                    id="modal-edit-lat"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition bg-slate-50 text-slate-900"
                    id="modal-edit-lng"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Complete Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold transition bg-slate-50 text-slate-900"
                  id="modal-edit-address"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Hazard Risk Level</label>
                <select
                  value={editRiskLevel}
                  onChange={(e) => setEditRiskLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-bold bg-slate-50 transition text-slate-800"
                  id="modal-edit-risk"
                >
                  <option value="">-- Use Auto-Assessment --</option>
                  <option value="Low Risk">Low Risk (Stable Terrain)</option>
                  <option value="Medium Risk">Medium Risk (Moderate Flood / Slopes)</option>
                  <option value="High Risk">High Risk (Severe Landslide / Debris Flow)</option>
                </select>
                <p className="text-[9px] text-slate-400 font-medium leading-tight">Leave unselected to auto-calculate via coordinates. Explicitly set if verified via UP NOAH map.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
                  id="modal-edit-submit"
                >
                  {isSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-red-600 border-b pb-3 border-slate-100">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">Delete Location Survey</h4>
            </div>
            
            <div className="space-y-2 text-xs">
              <p className="font-medium text-slate-600 leading-normal">
                Are you sure you want to permanently delete the geohazard location survey log for <span className="font-black text-slate-900">{memberToDelete.name}</span>?
              </p>
              <p className="text-[10px] text-red-500 font-semibold">This operation is permanent and cannot be undone.</p>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-150 text-red-800 rounded-lg text-[10px] font-bold">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setMemberToDelete(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Excel Import Report Modal */}
      {importReport && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2 text-emerald-600">
                <FileSpreadsheet className="w-5 h-5" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">Excel Import Complete</h4>
              </div>
              <button 
                onClick={() => setImportReport(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">
              The geohazard survey registry database was updated successfully.
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Imported</p>
                <p className="text-xl font-black text-emerald-600">{importReport.imported}</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Skipped</p>
                <p className="text-xl font-black text-amber-600">{importReport.skipped}</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Failed</p>
                <p className="text-xl font-black text-rose-600">{importReport.failed}</p>
              </div>
            </div>

            <button
              onClick={() => setImportReport(null)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Close Summary
            </button>
          </div>
        </div>
      )}

      {/* Custom Excel Import Error Modal */}
      {importError && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-rose-600 border-b pb-3 border-slate-100">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">Import Failed</h4>
            </div>
            
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-semibold">
              {importError}
            </div>

            <button
              onClick={() => setImportError(null)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
