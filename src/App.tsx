/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { User, Locale, FamilyHead, Staff } from './types.ts';
import PublicForm from './components/PublicForm.tsx';
import AdminLogin from './components/AdminLogin.tsx';
import AdminPortal from './components/AdminPortal.tsx';
import GeminiChatbot from './components/GeminiChatbot.tsx';

type ScreenState = 'public' | 'login' | 'admin';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('public');
  const [adminUser, setAdminUser] = useState<User | null>(null);

  // Global shared master lists (for speed and consistency across public and private panels)
  const [localesList, setLocalesList] = useState<Locale[]>([]);
  const [familyHeadsList, setFamilyHeadsList] = useState<FamilyHead[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load master lists and verify pre-existing administrative sessions
  const loadMasterDataAndVerifySession = async () => {
    try {
      setIsLoading(true);
      
      // 1. Fetch public locales, family heads, and staff directories
      const [localesRes, fHeadsRes, staffRes] = await Promise.all([
        fetch('/api/locales'),
        fetch('/api/family-heads'),
        fetch('/api/staff')
      ]);

      if (localesRes.ok) {
        const lData = await localesRes.json();
        setLocalesList(lData);
      }
      if (fHeadsRes.ok) {
        const fhData = await fHeadsRes.json();
        setFamilyHeadsList(fhData);
      }
      if (staffRes.ok) {
        const sData = await staffRes.json();
        setStaffList(sData);
      }

      // 2. Validate cached session
      const cachedToken = localStorage.getItem('ddrms_token');
      const cachedUser = localStorage.getItem('ddrms_user');

      if (cachedToken && cachedUser) {
        const parsedUser = JSON.parse(cachedUser) as User;
        
        // Quick verify with backend by fetching admin members list
        const verifyRes = await fetch('/api/members', {
          headers: {
            'Authorization': `Bearer ${cachedToken}`
          }
        });

        if (verifyRes.ok) {
          setAdminUser(parsedUser);
          setScreen('admin');
        } else {
          // Token expired or invalid
          localStorage.removeItem('ddrms_token');
          localStorage.removeItem('ddrms_user');
        }
      }
    } catch (error) {
      console.error('Error initializing DDRMS portal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMasterDataAndVerifySession();
  }, []);

  const handleLoginSuccess = (token: string, user: User) => {
    localStorage.setItem('ddrms_token', token);
    localStorage.setItem('ddrms_user', JSON.stringify(user));
    setAdminUser(user);
    setScreen('admin');
  };

  const handleLogout = () => {
    localStorage.removeItem('ddrms_token');
    localStorage.removeItem('ddrms_user');
    setAdminUser(null);
    setScreen('public');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center gap-4">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center p-2 shadow-2xl animate-bounce">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/e/eb/Coat_of_arms_of_the_Philippines.svg" 
            alt="Republic of the Philippines Seal" 
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-black tracking-widest uppercase text-emerald-400">Davao de Oro DRRMS</h2>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Synchronizing secure geohazard networks...</p>
        </div>
        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-emerald-500 selection:text-white">
      {screen === 'public' && (
        <PublicForm 
          onAdminLoginClick={() => setScreen('login')}
          localesList={localesList}
          familyHeadsList={familyHeadsList}
          staffList={staffList}
        />
      )}

      {screen === 'login' && (
        <AdminLogin 
          onLoginSuccess={handleLoginSuccess}
          onBackClick={() => setScreen('public')}
        />
      )}

      {screen === 'admin' && adminUser && (
        <AdminPortal 
          adminUser={adminUser}
          onLogout={handleLogout}
          localesList={localesList}
        />
      )}

      {/* Floating Gemini AI Chatbot Widget */}
      <GeminiChatbot />
    </div>
  );
}

