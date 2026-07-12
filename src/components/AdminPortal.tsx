import { useState, useEffect } from 'react';
import { User, Locale, FamilyHead, Member, Staff } from '../types.ts';
import DashboardOverview from './DashboardOverview.tsx';
import MemberManager from './MemberManager.tsx';
import FamilyHeadManager from './FamilyHeadManager.tsx';
import StaffManager from './StaffManager.tsx';
import AccountApprovalManager from './AccountApprovalManager.tsx';
import { io, Socket } from 'socket.io-client';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Shield, 
  LogOut, 
  Bell, 
  MapPin, 
  Activity, 
  RefreshCw,
  Sparkles,
  Settings,
  AlertTriangle,
  Trash2,
  CheckCircle,
  X
} from 'lucide-react';

interface AdminPortalProps {
  adminUser: User;
  onLogout: () => void;
  localesList: Locale[];
}

export default function AdminPortal({
  adminUser,
  onLogout,
  localesList
}: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'members' | 'familyHeads' | 'staff' | 'accounts' | 'settings'>('dashboard');

  // Real-time data lists
  const [members, setMembers] = useState<Member[]>([]);
  const [familyHeads, setFamilyHeads] = useState<FamilyHead[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Settings / Database Reset states
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmResetText, setConfirmResetText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Real-time alerts
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Load all reactive datasets
  const fetchAllData = async () => {
    const token = localStorage.getItem('ddrms_token');
    if (!token) return;

    try {
      const [membersRes, fHeadsRes, staffRes] = await Promise.all([
        fetch('/api/members', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/family-heads', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/staff', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (membersRes.ok && fHeadsRes.ok && staffRes.ok) {
        const mData = await membersRes.json();
        const fhData = await fHeadsRes.json();
        const sData = await staffRes.json();
        
        setMembers(mData);
        setFamilyHeads(fhData);
        setStaffList(sData);
        
        // Dispatch to update charts/stats dynamically
        window.dispatchEvent(new Event('ddrms_refresh_dashboard'));
      }

      // If Super Admin, fetch users to track pending approvals count
      if (adminUser.role === 'Super Admin') {
        const usersRes = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
        if (usersRes.ok) {
          const uData = await usersRes.json();
          setUsersList(uData);
        }
      }
    } catch (error) {
      console.error('Failed to load administrative datasets:', error);
    }
  };

  useEffect(() => {
    fetchAllData();

    // Socket.IO Connection for Real-Time Updates
    const socket: Socket = io();

    socket.on('connect', () => {
      console.log('DRRMC Live Socket connected');
    });

    socket.on('new_hazard_submission', (data: any) => {
      // Add real-time visual push notification
      const alertMsg = `Emergency! ${data.fullName} registered a geohazard survey in ${data.localeName}. Classified as ${data.riskLevel}!`;
      setNotifications(prev => [alertMsg, ...prev]);

      // Refetch datasets to trigger dynamic state propagation
      fetchAllData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleClearNotifications = () => {
    setNotifications([]);
    setShowNotifications(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="admin-workspace">
      
      {/* Admin Panel Header */}
      <header className="bg-slate-950 border-b border-slate-800 text-slate-300 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
              <span className="text-lg">D</span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight leading-none text-white">DDRMS Portal</h1>
              <p className="text-[9px] text-emerald-400 font-bold mt-1 tracking-widest uppercase">Administrative Portal • Davao de Oro</p>
            </div>
          </div>

          {/* Controls & Session Info */}
          <div className="flex items-center gap-3.5">
            
            {/* Live Socket Connection Monitor */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Live Synced
            </div>

            {/* Notifications Alert Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded-lg transition text-slate-400 hover:text-white relative"
                id="btn-admin-notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-black text-white border border-slate-950">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl p-4 space-y-3 z-50 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                    <h4 className="font-bold text-xs text-slate-800">DRRMC Live Notifications</h4>
                    {notifications.length > 0 && (
                      <button 
                        onClick={handleClearNotifications}
                        className="text-[10px] font-bold text-emerald-600 hover:underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-[10px] text-slate-400 text-center py-4 font-semibold">No new geohazard submissions logged.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {notifications.map((n, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 text-[10px] rounded-lg flex items-start gap-1.5 font-semibold text-slate-800 leading-relaxed">
                          <Activity className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <p>{n}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Current Administrative Profile */}
            <div className="flex items-center gap-2 pl-3.5 border-l border-slate-800 text-right">
              <div className="hidden md:block">
                <p className="text-xs font-bold leading-none text-slate-200">{adminUser.username}</p>
                <p className="text-[9px] text-emerald-400 font-bold mt-1 uppercase tracking-wider">{adminUser.role}</p>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-850 rounded-lg transition cursor-pointer"
                title="Log Out Session"
                id="btn-admin-logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Admin Workspace Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Workspace Sidebar Nav (3 Columns) */}
        <aside className="lg:col-span-3 space-y-4">
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-1">
            <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase px-2 mb-2">Management Controls</p>
            
            {/* Tab: Dashboard Overview */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
              id="tab-admin-dashboard"
            >
              <LayoutDashboard className="w-4 h-4" />
              Overview Dashboard
            </button>

            {/* Tab: Member Survey Logs */}
            <button
              onClick={() => setActiveTab('members')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'members' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
              id="tab-admin-members"
            >
              <FileText className="w-4 h-4" />
              Location Surveys Log
            </button>

            {/* Tab: Family Head Register */}
            <button
              onClick={() => setActiveTab('familyHeads')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'familyHeads' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
              id="tab-admin-fh"
            >
              <Users className="w-4 h-4" />
              Family Heads Register
            </button>

            {/* Tab: Local Responders Directory */}
            <button
              onClick={() => setActiveTab('staff')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'staff' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
              id="tab-admin-staff"
            >
              <Shield className="w-4 h-4" />
              DRRM Staff Directory
            </button>

            {/* Tab: Super Admin Accounts Control */}
            {adminUser.role === 'Super Admin' && (
              <button
                onClick={() => setActiveTab('accounts')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'accounts' ? 'bg-purple-50 text-purple-700 border border-purple-200/50 shadow-sm' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
                id="tab-admin-accounts"
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-purple-600" />
                  <span>Manage Accounts</span>
                </div>
                {usersList.filter((u: any) => !u.isApproved).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse shadow-sm">
                    {usersList.filter((u: any) => !u.isApproved).length}
                  </span>
                )}
              </button>
            )}

            {/* Tab: System Settings */}
            {adminUser.role !== 'Staff' && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'settings' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
                id="tab-admin-settings"
              >
                <Settings className="w-4 h-4" />
                System Settings
              </button>
            )}
          </div>

          {/* Quick Stats Panel */}
          <div className="bg-slate-900 border border-slate-850 text-slate-300 rounded-xl shadow-sm p-4 space-y-3.5">
            <h4 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              DRRMC Activity Monitor
            </h4>
            <div className="space-y-2 text-xs font-semibold">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Surveys</span>
                <span className="text-slate-200">{members.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">High Geohazard</span>
                <span className="text-red-400 font-bold">{members.filter(m => m.riskLevel === 'High Risk').length}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-2.5">
                <button
                  onClick={fetchAllData}
                  className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh Database
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Workspace Display Stage (9 Columns) */}
        <main className="lg:col-span-9">
          {activeTab === 'dashboard' && (
            <DashboardOverview members={members} localesList={localesList} />
          )}

          {activeTab === 'members' && (
            <MemberManager 
              adminUser={adminUser}
              localesList={localesList}
              familyHeadsList={familyHeads}
              members={members}
              onRefreshData={fetchAllData}
            />
          )}

          {activeTab === 'familyHeads' && (
            <FamilyHeadManager
              adminUser={adminUser}
              localesList={localesList}
              familyHeads={familyHeads}
              onRefreshData={fetchAllData}
            />
          )}

          {activeTab === 'staff' && (
            <StaffManager
              adminUser={adminUser}
              localesList={localesList}
              staffList={staffList}
              onRefreshData={fetchAllData}
            />
          )}

          {activeTab === 'accounts' && adminUser.role === 'Super Admin' && (
            <AccountApprovalManager adminUser={adminUser} onRefresh={fetchAllData} />
          )}

          {activeTab === 'settings' && adminUser.role !== 'Staff' && (
            <div className="space-y-6">
              {/* Header card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">System Settings</h2>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Perform administrative tasks and maintenance on the Davao de Oro geohazard safety database.
                </p>
              </div>

              {/* Maintenance Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Database Maintenance & Operations</h3>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="space-y-1">
                    <p className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      Reset Location Surveys Log
                    </p>
                    <p className="text-[10px] text-slate-500 leading-relaxed max-w-lg">
                      Irreversibly delete all records from the Location Surveys log. This operation cannot be undone. Other registry files (Locales and Family Heads) will remain untouched.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setConfirmResetText('');
                      setResetSuccess(null);
                      setResetError(null);
                      setShowResetModal(true);
                    }}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Reset Surveys Log
                  </button>
                </div>
              </div>

              {/* Reset Confirmation Modal */}
              {showResetModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95 duration-200 text-left">
                    <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Confirm Log Reset</h4>
                      </div>
                      <button 
                        onClick={() => setShowResetModal(false)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {resetSuccess ? (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg flex items-center gap-2 text-xs font-semibold">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <p>{resetSuccess}</p>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg space-y-1.5 text-xs">
                          <p className="font-bold">⚠️ Warning: Danger Zone</p>
                          <p className="font-medium text-[10px] leading-normal text-red-700">
                            You are about to delete all geohazard location survey logs. This will clear all data on the overview charts and reset geohazard maps. This action is **permanent**.
                          </p>
                        </div>

                        {resetError && (
                          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-semibold">
                            {resetError}
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                            Type <span className="text-red-500 select-all font-black font-mono">RESET</span> to authorize:
                          </label>
                          <input
                            type="text"
                            placeholder="RESET"
                            value={confirmResetText}
                            onChange={(e) => setConfirmResetText(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-black tracking-wider transition bg-slate-50 text-slate-900 text-center"
                          />
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowResetModal(false)}
                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              if (confirmResetText !== 'RESET') {
                                setResetError("Please type 'RESET' exactly to authorize.");
                                return;
                              }
                              setIsResetting(true);
                              setResetError(null);
                              const token = localStorage.getItem('ddrms_token');
                              try {
                                const res = await fetch('/api/members/reset', {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${token}`
                                  }
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  throw new Error(data.error || 'Failed to reset survey log.');
                                }
                                setResetSuccess("All geohazard survey logs have been deleted successfully.");
                                fetchAllData();
                                setTimeout(() => {
                                  setShowResetModal(false);
                                  setActiveTab('dashboard');
                                }, 1500);
                              } catch (err: any) {
                                console.error(err);
                                setResetError(err.message || 'Operation failed.');
                              } finally {
                                setIsResetting(false);
                              }
                            }}
                            disabled={isResetting || confirmResetText !== 'RESET'}
                            className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                          >
                            {isResetting ? 'Resetting...' : 'Permanently Delete'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
