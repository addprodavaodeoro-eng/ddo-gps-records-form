import { useState, useEffect } from 'react';
import { User } from '../types.ts';
import { 
  Users, 
  Search, 
  Check, 
  X, 
  Trash2, 
  Shield, 
  UserCheck, 
  UserMinus, 
  AlertTriangle,
  RefreshCw,
  Mail,
  Calendar
} from 'lucide-react';

interface AccountApprovalManagerProps {
  adminUser: User;
  onRefresh?: () => void;
}

export default function AccountApprovalManager({ adminUser, onRefresh }: AccountApprovalManagerProps) {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Custom delete modal states
  const [accountToDelete, setAccountToDelete] = useState<{ id: number; username: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const token = localStorage.getItem('ddrms_token');
    try {
      const res = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch users list');
      }
      setUsersList(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load system accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleApproval = async (userId: number, currentApproved: boolean, username: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const token = localStorage.getItem('ddrms_token');
    const newStatus = !currentApproved;

    try {
      const res = await fetch(`/api/users/${userId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isApproved: newStatus })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update approval status');
      }

      setSuccessMsg(`Account for "${username}" has been ${newStatus ? 'approved' : 'suspended'} successfully.`);
      fetchUsers();
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Action failed.');
    }
  };

  const handleDeleteUser = (userId: number, username: string) => {
    if (userId === adminUser.id) {
      setErrorMsg('You cannot delete your own currently logged-in account.');
      return;
    }
    setAccountToDelete({ id: userId, username });
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    const token = localStorage.getItem('ddrms_token');

    try {
      const res = await fetch(`/api/users/${accountToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }

      setSuccessMsg(`Account for "${accountToDelete.username}" was permanently deleted.`);
      setAccountToDelete(null);
      fetchUsers();
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.message || 'Deletion failed.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filterTab === 'pending') {
      return matchesSearch && !u.isApproved;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6" id="account-approval-manager">
      
      {/* Search Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts by username/email..."
            className="w-full pl-9 pr-3 py-2 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium bg-slate-50 focus:bg-white transition text-slate-900"
            id="input-account-search"
          />
        </div>

        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="w-full md:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm border border-slate-200 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Accounts List
        </button>
      </div>

      {/* Approval Status Tab Filter & Summary Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200/50">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition duration-200 cursor-pointer ${
              filterTab === 'all'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Accounts ({usersList.length})
          </button>
          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition duration-200 flex items-center gap-1.5 cursor-pointer ${
              filterTab === 'pending'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Pending Approval ({usersList.filter(u => !u.isApproved).length})</span>
            {usersList.filter(u => !u.isApproved).length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </button>
        </div>

        <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
          <span>{usersList.filter(u => !u.isApproved).length} Accounts awaiting Super Admin approval</span>
        </div>
      </div>

      {/* Alert Messages */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <UserCheck className="w-4 h-4 text-emerald-650" />
          <p>{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-100 text-red-800 rounded-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Accounts List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredUsers.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white border border-slate-200 rounded-xl text-slate-400 text-sm font-semibold shadow-sm">
            {isLoading ? 'Loading system accounts...' : 'No admin/staff accounts found.'}
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isSelf = u.id === adminUser.id;
            return (
              <div 
                key={u.id}
                className={`bg-white border rounded-xl shadow-sm p-5 space-y-4 hover:shadow-md transition-all duration-300 relative overflow-hidden ${
                  !u.isApproved ? 'border-amber-200 bg-amber-50/5' : 'border-slate-200'
                }`}
                id={`user-card-${u.id}`}
              >
                {/* Status Indicator Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  !u.isApproved ? 'bg-amber-400' : 'bg-emerald-500'
                }`} />

                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                      <Shield className="w-4 h-4 text-slate-500" />
                      {u.username}
                      {isSelf && (
                        <span className="px-1.5 py-0.5 text-[8px] font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                          YOU
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                        u.role === 'Super Admin' 
                          ? 'bg-purple-50 text-purple-600 border-purple-100' 
                          : u.role === 'Admin'
                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                            : 'bg-teal-50 text-teal-600 border-teal-100'
                      }`}>
                        {u.role}
                      </span>
                    </h3>
                    
                    {u.email && (
                      <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {u.email}
                      </p>
                    )}

                    <p className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Registered: {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {u.isApproved ? (
                      <span className="px-2.5 py-1 text-[9px] font-black rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                        APPROVED
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-[9px] font-black rounded-full bg-amber-100 text-amber-800 uppercase tracking-wider animate-pulse">
                        PENDING APPROVAL
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between">
                  <div className="flex gap-2">
                    {/* Approve / Suspend Toggle */}
                    {!isSelf && (
                      <button
                        onClick={() => handleToggleApproval(u.id, u.isApproved, u.username)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                          u.isApproved 
                            ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                            : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm'
                        }`}
                        title={u.isApproved ? 'Suspend account access' : 'Approve account access'}
                      >
                        {u.isApproved ? (
                          <>
                            <UserMinus className="w-3.5 h-3.5" />
                            Suspend
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            Approve Account
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Delete Account */}
                  {!isSelf && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.username)}
                      className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg transition cursor-pointer"
                      title="Permanently Delete Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-red-600 border-b pb-3 border-slate-100">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">Delete User Account</h4>
            </div>
            
            <div className="space-y-2 text-xs">
              <p className="font-medium text-slate-600 leading-normal">
                Are you sure you want to permanently delete the administrator/staff account for <span className="font-black text-slate-900">{accountToDelete.username}</span>?
              </p>
              <p className="text-[10px] text-red-500 font-semibold">This operation is permanent, and they will lose all database access immediately.</p>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-150 text-red-800 rounded-lg text-[10px] font-bold">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setAccountToDelete(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
