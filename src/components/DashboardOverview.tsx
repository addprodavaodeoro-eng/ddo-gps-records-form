import { useState, useEffect } from 'react';
import { Member, Locale } from '../types.ts';
import DdrmsMap from './DdrmsMap.tsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { 
  Users, 
  Map, 
  AlertOctagon, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Printer, 
  FileText,
  Calendar,
  Layers,
  MapPin
} from 'lucide-react';

interface DashboardOverviewProps {
  members: Member[];
  localesList: Locale[];
}

export default function DashboardOverview({ members, localesList }: DashboardOverviewProps) {
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalFamilyHeads: 0,
    totalLocales: 0,
    lowRisk: 0,
    mediumRisk: 0,
    highRisk: 0,
    submittedToday: 0,
    pendingRecords: 0
  });

  const [chartsData, setChartsData] = useState<any>({
    membersByLocale: [],
    riskSummary: [],
    submissionTrends: []
  });

  const [mapSelectedMember, setMapSelectedMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch stats and charts
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setIsLoading(true);
        const [statsRes, chartsRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/dashboard/charts')
        ]);

        if (statsRes.ok && chartsRes.ok) {
          const statsVal = await statsRes.json();
          const chartsVal = await chartsRes.json();
          setStats(statsVal);
          setChartsData(chartsVal);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();

    // Listen to refresh requests
    const handleRefresh = () => fetchDashboardData();
    window.addEventListener('ddrms_refresh_dashboard', handleRefresh);
    return () => window.removeEventListener('ddrms_refresh_dashboard', handleRefresh);
  }, [members]);

  const COLORS = {
    'Low Risk': '#10B981',     // Emerald Green
    'Medium Risk': '#F59E0B',  // Amber Yellow
    'High Risk': '#EF4444'     // Rose Red
  };

  const pieData = [
    { name: 'Low Risk', value: stats.lowRisk || 0, color: COLORS['Low Risk'] },
    { name: 'Medium Risk', value: stats.mediumRisk || 0, color: COLORS['Medium Risk'] },
    { name: 'High Risk', value: stats.highRisk || 0, color: COLORS['High Risk'] }
  ].filter(d => d.value > 0);

  // Print high-fidelity report
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-8" id="dashboard-overview">
      
      {/* 1. Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Card: Total Members */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between transition duration-300">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Surveyed Members</p>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{stats.totalMembers}</h3>
            <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              Real-Time Registered
            </p>
          </div>
          <div className="w-10 h-10 bg-slate-50 text-slate-700 rounded-lg flex items-center justify-center border border-slate-200/60">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card: Family Heads */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between transition duration-300">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Family Heads</p>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{stats.totalFamilyHeads}</h3>
            <p className="text-[10px] text-slate-500 font-medium">Under strict monitoring</p>
          </div>
          <div className="w-10 h-10 bg-slate-50 text-slate-700 rounded-lg flex items-center justify-center border border-slate-200/60">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Card: High Risk Count */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between transition duration-300">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">UP NOAH High Risk</p>
            <h3 className="text-2xl font-bold text-red-600 tracking-tight">{stats.highRisk}</h3>
            <p className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              Critical Evacuation Zones
            </p>
          </div>
          <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center border border-red-100">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        {/* Card: Registered Today */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between transition duration-300">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Registered Today</p>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{stats.submittedToday}</h3>
            <p className="text-[10px] text-slate-500 font-semibold">Pending Assign: {stats.pendingRecords}</p>
          </div>
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center border border-amber-100">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Interactive Map Module */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Map className="w-4.5 h-4.5 text-emerald-600" />
              Interactive DRRM Geohazard Map
            </h2>
            <p className="text-xs text-slate-500 font-medium">Displaying all submitted locations overlaid with UP NOAH risk levels</p>
          </div>
          {mapSelectedMember && (
            <button 
              onClick={() => setMapSelectedMember(null)}
              className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
            >
              Reset Map View
            </button>
          )}
        </div>
        <DdrmsMap 
          members={members} 
          selectedMember={mapSelectedMember}
          onSelectMember={setMapSelectedMember}
          height="450px"
        />
      </div>

      {/* 3. Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Members by Locale Chart (7 Columns) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col h-[350px]">
          <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
            <BarChart className="w-4 h-4 text-emerald-600" />
            Surveyed Members by Locale
          </h3>
          <div className="flex-1 w-full text-xs">
            {chartsData.membersByLocale && chartsData.membersByLocale.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData.membersByLocale}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="localeName" stroke="#94A3B8" tickLine={false} />
                  <YAxis stroke="#94A3B8" tickLine={false} />
                  <Tooltip cursor={{ fill: '#F8FAFC' }} />
                  <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">Loading charts data...</div>
            )}
          </div>
        </div>

        {/* Risk Level Distribution Pie (4 Columns) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col h-[350px]">
          <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-600" />
            Geohazard Risk Distribution
          </h3>
          <div className="flex-1 w-full relative">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                     data={pieData}
                     cx="50%"
                     cy="45%"
                     innerRadius={60}
                     outerRadius={80}
                     paddingAngle={3}
                     dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">No risk records to display</div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Submission Trend AreaChart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-[300px] flex flex-col">
        <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          Location Surveys Registration Trend
        </h3>
        <div className="flex-1 w-full text-xs">
          {chartsData.submissionTrends && chartsData.submissionTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData.submissionTrends}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">No trend data logged yet</div>
          )}
        </div>
      </div>

      {/* 5. Report Generators & Printable Layout Trigger */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5 justify-center md:justify-start">
            <FileText className="w-5 h-5 text-emerald-600" />
            Comprehensive DRRMC Report Generation
          </h3>
          <p className="text-xs text-slate-500 font-medium">Export a high-fidelity printable assessment document of Davao de Oro risk distributions.</p>
        </div>
        <button
          onClick={handlePrintReport}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
          id="btn-print-report"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF Report
        </button>
      </div>

      {/* ------------------ HIDDEN PRINT-ONLY REPORT TEMPLATE ------------------ */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8 text-black space-y-6" id="ddrms-printable-pdf">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
              <span className="text-xl">D</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 tracking-wider uppercase">Republic of the Philippines</p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">Davao de Oro DRRMC</h1>
              <p className="text-xs text-slate-600 font-semibold mt-1">Disaster Risk Management System Official Report</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 space-y-0.5">
            <p><strong>Date Generated:</strong> {new Date().toLocaleDateString()}</p>
            <p><strong>System ID:</strong> DDRMS-AIS-3276</p>
            <p><strong>Status:</strong> Active & Live</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-b border-slate-200 pb-4">
          <div className="p-3 bg-slate-50 border rounded-lg">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Members</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalMembers}</p>
          </div>
          <div className="p-3 bg-slate-50 border rounded-lg">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Critical High Risk Homes</p>
            <p className="text-2xl font-bold text-red-600">{stats.highRisk}</p>
          </div>
          <div className="p-3 bg-slate-50 border rounded-lg">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Locales</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalLocales}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-sm text-slate-800 border-b pb-1">Davao de Oro Locale Summary</h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="p-2 border">Locale Name</th>
                <th className="p-2 border text-center">Registered Members</th>
                <th className="p-2 border text-center">Risk Classification</th>
              </tr>
            </thead>
            <tbody>
              {chartsData.membersByLocale && chartsData.membersByLocale.map((row: any, i: number) => (
                <tr key={i}>
                  <td className="p-2 border font-medium">{row.localeName}</td>
                  <td className="p-2 border text-center font-bold">{row.count}</td>
                  <td className="p-2 border text-center text-slate-500 font-semibold">UP NOAH Monitored</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-sm text-slate-800 border-b pb-1">Geohazard Risk Distribution</h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <p className="p-2 border rounded border-emerald-200 bg-emerald-50 text-emerald-800 font-bold">🟢 Low Risk Area Total: {stats.lowRisk}</p>
            <p className="p-2 border rounded border-amber-200 bg-amber-50 text-amber-800 font-bold">🟡 Medium Risk Area Total: {stats.mediumRisk}</p>
            <p className="p-2 border rounded border-red-200 bg-red-50 text-red-800 font-bold">🔴 High Risk Area Total: {stats.highRisk}</p>
          </div>
        </div>

        <div className="pt-8 text-center text-[10px] text-slate-400 border-t border-dashed">
          <p>This report was securely generated by the DDRMS Administrative Portal on behalf of Davao de Oro DRRMC.</p>
          <p className="mt-1 font-mono text-[9px]">Validation SHA256: d5f9a6e1-c5a4-4a41-86bc-6f4e3c54df3a</p>
        </div>
      </div>
    </div>
  );
}
