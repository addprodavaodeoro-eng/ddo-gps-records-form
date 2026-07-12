import { useState, FormEvent } from 'react';
import { Staff, Locale, User } from '../types.ts';
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
  Shield,
  PlusCircle,
  AlertTriangle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface StaffManagerProps {
  adminUser: User | null;
  localesList: Locale[];
  staffList: Staff[];
  onRefreshData: () => void;
}

export default function StaffManager({
  adminUser,
  localesList,
  staffList,
  onRefreshData
}: StaffManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocaleId, setSelectedLocaleId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Add Staff Member');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [staffName, setStaffName] = useState('');
  const [position, setPosition] = useState('');
  const [cellphoneNumber, setCellphoneNumber] = useState('');
  const [assignedLocaleId, setAssignedLocaleId] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom delete modal states
  const [staffToDelete, setStaffToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filter staff list
  const filteredStaff = staffList.filter(s => {
    const matchesSearch = s.staffName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.cellphoneNumber.includes(searchQuery);
    const matchesLocale = selectedLocaleId ? s.assignedLocaleId === parseInt(selectedLocaleId) : true;
    const matchesStatus = selectedStatus ? s.status === selectedStatus : true;
    return matchesSearch && matchesLocale && matchesStatus;
  });

  const handleOpenAdd = () => {
    setModalTitle('Add Staff Member');
    setEditingId(null);
    setStaffName('');
    setPosition('');
    setCellphoneNumber('');
    setAssignedLocaleId('');
    setStatus('Active');
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Staff) => {
    setModalTitle('Edit Staff Member');
    setEditingId(s.id);
    setStaffName(s.staffName);
    setPosition(s.position);
    setCellphoneNumber(s.cellphoneNumber);
    setAssignedLocaleId(String(s.assignedLocaleId));
    setStatus(s.status);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !position.trim() || !cellphoneNumber.trim() || !assignedLocaleId || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const isEdit = editingId !== null;
    const url = isEdit ? `/api/staff/${editingId}` : '/api/staff';
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
          staffName: staffName.trim(),
          position: position.trim(),
          cellphoneNumber: cellphoneNumber.trim(),
          assignedLocaleId: parseInt(assignedLocaleId),
          status
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save staff member details.');
      }

      setSuccessMsg(isEdit ? 'Staff member details updated.' : 'Staff member registered successfully.');
      onRefreshData();

      setTimeout(() => {
        setIsModalOpen(false);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Transaction failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: number, name: string) => {
    setStaffToDelete({ id, name });
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!staffToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    const token = localStorage.getItem('ddrms_token');

    try {
      const res = await fetch(`/api/staff/${staffToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Deletion failed.');
      }

      setStaffToDelete(null);
      onRefreshData();
    } catch (error: any) {
      console.error(error);
      setDeleteError(error.message || 'Failed to delete staff member.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6" id="staff-manager-panel">
      
      {/* 1. Header with Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col lg:flex-row items-center justify-between gap-4">
        
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff by name/position..."
              className="w-full pl-9 pr-3 py-2 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium bg-slate-50 focus:bg-white transition text-slate-900"
              id="input-staff-search"
            />
          </div>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <Filter className="w-3.5 h-3.5" />
            </span>
            <select
              value={selectedLocaleId}
              onChange={(e) => setSelectedLocaleId(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold bg-white transition text-slate-800"
              id="select-staff-locale-filter"
            >
              <option value="">All Locales</option>
              {localesList.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <Shield className="w-3.5 h-3.5" />
            </span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold bg-white transition text-slate-800"
              id="select-staff-status-filter"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Add Trigger */}
        {adminUser?.role === 'Super Admin' && (
          <button
            onClick={handleOpenAdd}
            className="w-full lg:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            id="btn-staff-add"
          >
            <Plus className="w-4 h-4" />
            Add Staff Member
          </button>
        )}
      </div>

      {/* 2. Staff Listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStaff.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white border border-slate-200 rounded-xl text-slate-400 text-sm font-semibold shadow-sm">
            No staff members found matching your filters.
          </div>
        ) : (
          filteredStaff.map((s) => (
            <div 
              key={s.id}
              className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 hover:shadow-md transition-all duration-300"
              id={`staff-card-${s.id}`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    {s.staffName}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">{s.position}</p>
                </div>
                
                {/* Actions */}
                {adminUser?.role === 'Super Admin' && (
                  <div className="flex items-center gap-1 text-slate-400">
                    <button
                      onClick={() => handleOpenEdit(s)}
                      className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg border border-slate-205 transition"
                      title="Edit Staff Member"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(s.id, s.staffName)}
                      className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg border border-red-100 transition cursor-pointer"
                      title="Delete Staff Member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Card Stats / Assigned Locale */}
              <div className="space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-400"><MapPin className="w-3.5 h-3.5 text-emerald-500" /> Assigned Locale</span>
                  <span className="text-slate-800">{s.assignedLocaleName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-400"><Phone className="w-3.5 h-3.5 text-slate-400" /> Cellphone</span>
                  <span className="text-slate-800">{s.cellphoneNumber}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-100/50">
                  <span className="text-slate-400">Duty Status</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${s.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                    {s.status}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Add/Edit Staff Modal */}
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
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Staff Name</label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold bg-slate-50 text-slate-900 transition"
                  id="modal-staff-name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Position</label>
                <input
                  type="text"
                  required
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Responder, Coordinator"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold bg-slate-50 text-slate-900 transition"
                  id="modal-staff-position"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Cellphone Number</label>
                <input
                  type="text"
                  required
                  value={cellphoneNumber}
                  onChange={(e) => setCellphoneNumber(e.target.value)}
                  placeholder="e.g. 09123456789"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold bg-slate-50 text-slate-900 transition"
                  id="modal-staff-phone"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Assigned Locale</label>
                <select
                  required
                  value={assignedLocaleId}
                  onChange={(e) => setAssignedLocaleId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-bold bg-slate-50 text-slate-800 transition"
                  id="modal-staff-locale"
                >
                  <option value="">-- Choose Locale --</option>
                  {localesList.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Duty Status</label>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setStatus('Active')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${status === 'Active' ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('Inactive')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${status === 'Inactive' ? 'bg-slate-500 border-slate-500 text-white shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                  >
                    Inactive
                  </button>
                </div>
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
                  id="modal-staff-submit"
                >
                  {isSubmitting ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {staffToDelete && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-red-600 border-b pb-3 border-slate-100">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">Delete Staff Member</h4>
            </div>
            
            <div className="space-y-2 text-xs">
              <p className="font-medium text-slate-600 leading-normal">
                Are you sure you want to permanently delete staff member <span className="font-black text-slate-900">{staffToDelete.name}</span>?
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
                onClick={() => setStaffToDelete(null)}
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
