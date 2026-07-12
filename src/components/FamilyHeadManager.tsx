import { useState, useEffect, FormEvent } from 'react';
import { FamilyHead, Locale, User } from '../types.ts';
import { 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Filter, 
  Phone, 
  MapPin, 
  CheckCircle, 
  X,
  PlusCircle,
  AlertTriangle
} from 'lucide-react';

interface FamilyHeadManagerProps {
  adminUser: User | null;
  localesList: Locale[];
  familyHeads: FamilyHead[];
  onRefreshData: () => void;
}

export default function FamilyHeadManager({
  adminUser,
  localesList,
  familyHeads,
  onRefreshData
}: FamilyHeadManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocaleId, setSelectedLocaleId] = useState('');

  // Form modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Add Family Head');
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [fullName, setFullName] = useState('');
  const [cellNumber, setCellNumber] = useState('');
  const [localeId, setLocaleId] = useState('');
  const [genderRole, setGenderRole] = useState<'MOTHER' | 'FATHER'>('FATHER');
  const [familySize, setFamilySize] = useState<number>(1);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom modal states for deleting
  const [fhToDelete, setFhToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filter family heads list
  const filteredHeads = familyHeads.filter(fh => {
    const matchesSearch = fh.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          fh.cellNumber.includes(searchQuery);
    const matchesLocale = selectedLocaleId ? fh.localeId === parseInt(selectedLocaleId) : true;
    return matchesSearch && matchesLocale;
  });

  const handleOpenAdd = () => {
    setModalTitle('Add Family Head');
    setEditingId(null);
    setFullName('');
    setCellNumber('');
    setLocaleId('');
    setGenderRole('FATHER');
    setFamilySize(1);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (fh: FamilyHead) => {
    setModalTitle('Edit Family Head');
    setEditingId(fh.id);
    setFullName(fh.fullName);
    setCellNumber(fh.cellNumber);
    setLocaleId(String(fh.localeId));
    setGenderRole((fh.genderRole as 'MOTHER' | 'FATHER') || 'FATHER');
    setFamilySize(fh.familySize || 1);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !cellNumber.trim() || !localeId || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const isEdit = editingId !== null;
    const url = isEdit ? `/api/family-heads/${editingId}` : '/api/family-heads';
    const method = isEdit ? 'PUT' : 'POST';

    const token = localStorage.getItem('ddrms_token');

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          cellNumber: cellNumber.trim(),
          localeId: parseInt(localeId),
          genderRole,
          familySize: parseInt(String(familySize)) || 1
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save family head.');
      }

      setSuccessMsg(isEdit ? 'Family head updated successfully.' : 'Family head created successfully.');
      onRefreshData();
      
      setTimeout(() => {
        setIsModalOpen(false);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to complete transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: number, name: string) => {
    setFhToDelete({ id, name });
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!fhToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    const token = localStorage.getItem('ddrms_token');

    try {
      const res = await fetch(`/api/family-heads/${fhToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to delete family head.');
      }

      setFhToDelete(null);
      onRefreshData();
    } catch (error: any) {
      console.error(error);
      setDeleteError(error.message || 'Failed to delete family head. Please verify your permissions.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6" id="family-heads-manager">
      
      {/* 1. Filtering & Adding Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Searches & Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search family heads..."
              className="w-full pl-9 pr-3 py-2 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium bg-slate-50 focus:bg-white transition text-slate-900"
              id="input-fh-search"
            />
          </div>

          <div className="relative w-full sm:w-48">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <Filter className="w-3.5 h-3.5" />
            </span>
            <select
              value={selectedLocaleId}
              onChange={(e) => setSelectedLocaleId(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold bg-white transition text-slate-800"
              id="select-fh-locale-filter"
            >
              <option value="">All Locales</option>
              {localesList.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Add Trigger Button */}
        {adminUser?.role !== 'Staff' && (
          <button
            onClick={handleOpenAdd}
            className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            id="btn-fh-add"
          >
            <Plus className="w-4 h-4" />
            Add Family Head
          </button>
        )}
      </div>

      {/* 2. Family Heads Listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHeads.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white border border-slate-200 rounded-xl text-slate-400 text-sm font-semibold shadow-sm">
            No family heads match your filter criteria.
          </div>
        ) : (
          filteredHeads.map((fh) => (
            <div 
              key={fh.id}
              className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 hover:shadow-md transition-all duration-300"
              id={`fh-card-${fh.id}`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <Users className="w-4 h-4 text-emerald-600" />
                    {fh.fullName}
                    {fh.genderRole && (
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                        fh.genderRole === 'MOTHER' 
                          ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                          : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        {fh.genderRole}
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    Locale: {fh.localeName}
                  </p>
                </div>
                
                {/* Actions */}
                {adminUser?.role !== 'Staff' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(fh)}
                      className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg border border-slate-205 transition"
                      title="Edit Family Head"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(fh.id, fh.fullName)}
                      className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg border border-red-100 transition cursor-pointer"
                      title="Delete Family Head"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Card Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg space-y-0.5">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Registered</p>
                  <p className="text-base font-bold text-emerald-600">{fh.memberCount || 0}</p>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg space-y-0.5">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Family Size</p>
                  <p className="text-base font-bold text-slate-700">{fh.familySize || 1}</p>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex flex-col justify-center items-center text-[9px] text-slate-500 font-semibold overflow-hidden">
                  <Phone className="w-3 h-3 text-slate-400 mb-0.5" />
                  <span className="truncate w-full text-center block text-slate-700 font-medium" title={fh.cellNumber}>{fh.cellNumber}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Add/Edit Family Head Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                {modalTitle}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold bg-slate-50 text-slate-900 transition"
                  id="modal-fh-name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Cell Number</label>
                <input
                  type="text"
                  required
                  value={cellNumber}
                  onChange={(e) => setCellNumber(e.target.value)}
                  placeholder="e.g. 09123456789"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold bg-slate-50 text-slate-900 transition"
                  id="modal-fh-phone"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Locale</label>
                <select
                  required
                  value={localeId}
                  onChange={(e) => setLocaleId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-bold bg-slate-50 text-slate-800 transition"
                  id="modal-fh-locale"
                >
                  <option value="">-- Select Locale --</option>
                  {localesList.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Gender / Family Head Role</label>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setGenderRole('FATHER')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${genderRole === 'FATHER' ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    FATHER
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenderRole('MOTHER')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${genderRole === 'MOTHER' ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    MOTHER
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">How many in the family?</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={familySize}
                  onChange={(e) => setFamilySize(parseInt(e.target.value) || 1)}
                  placeholder="Total number of family members"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold bg-slate-50 text-slate-900 transition"
                  id="modal-fh-size"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
                  id="modal-fh-submit"
                >
                  {isSubmitting ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {fhToDelete && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-red-600 border-b pb-3 border-slate-100">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">Delete Family Head</h4>
            </div>
            
            <div className="space-y-2 text-xs">
              <p className="font-medium text-slate-600 leading-normal">
                Are you sure you want to permanently delete <span className="font-black text-slate-900">{fhToDelete.name}</span>? All members linked to this family head will be set to pending.
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
                onClick={() => setFhToDelete(null)}
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
    </div>
  );
}
