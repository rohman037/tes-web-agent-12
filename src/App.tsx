import React, { useState, useEffect } from 'react';
import LoginView from './components/views/LoginView';
import PaketAksesView from './components/views/PaketAksesView';
import AdminDashboardView from './components/views/AdminDashboardView';
import UserLayout from './components/layouts/UserLayout';
import { initRealtimeSync } from './lib/realtimeSync';
import { initCrossTabSync } from './lib/crossTabSync';
import { syncHistoryAsync } from './lib/history';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { session, logout, refreshSession, setSession, isAuthenticated, isExpired, sessionAudit } = useAuth();
  
  useEffect(() => {
    // [REALTIME-FIX] Initialize central real-time sync (SSE Manager) & Cross-Tab Sync
    const cleanupRealtime = initRealtimeSync();
    const cleanupCrossTab = initCrossTabSync();
    syncHistoryAsync();

    return () => {
      cleanupRealtime();
      cleanupCrossTab();
    };
  }, []);

  // Diagnostic log for Router validation
  useEffect(() => {
    const expiredAt = sessionAudit?.expiryDateIso || session?.expiryDate || null;
    const currentDate = new Date(Date.now()).toISOString();
    console.log('[Router Auth Verification]', {
      expiredAt,
      currentDate,
      isExpired,
      isAuthenticated,
      hasSession: Boolean(session),
      code: session?.code || null,
      role: session?.role || null,
    });
  }, [session, isAuthenticated, isExpired, sessionAudit]);

  const [publicView, setPublicView] = useState<'login' | 'pricing'>('login');
  const [adminViewMode, setAdminViewMode] = useState<'admin_dashboard' | 'workspace'>('admin_dashboard');

  const handleLogout = () => {
    logout();
    setPublicView('login');
  };

  // Proteksi Rute: Jika belum ada session resmi, kedaluwarsa, atau guest access, selalu render tampilan publik
  if (!session || !isAuthenticated || isExpired || session.code === 'GUEST-ACCESS') {
    if (publicView === 'pricing') {
      return (
        <div className="min-h-screen bg-[#fcf8ff] p-4 sm:p-8">
          <PaketAksesView
            onBackToLogin={() => setPublicView('login')}
            onSuccessLogin={() => {
              refreshSession();
              setPublicView('login');
            }}
          />
        </div>
      );
    }

    return (
      <LoginView
        onLoginSuccess={(s) => {
          if (s.code !== 'GUEST-ACCESS') {
            setSession(s);
            setPublicView('login');
          }
        }}
        onOpenPaketAkses={() => {
          setPublicView('pricing');
        }}
      />
    );
  }

  // Tampilan Admin Dashboard
  if (session.role === 'admin' && adminViewMode === 'admin_dashboard') {
    return (
      <AdminDashboardView
        onGoToWorkspace={() => setAdminViewMode('workspace')}
        onLogout={handleLogout}
        onOpenApiKeySettings={() => setAdminViewMode('workspace')}
      />
    );
  }

  // Workspace User Layout (Hanya untuk pengguna terautentikasi resmi)
  return (
    <UserLayout
      session={session}
      onLogout={handleLogout}
      onGoToAdmin={session.role === 'admin' ? () => setAdminViewMode('admin_dashboard') : undefined}
    />
  );
}
