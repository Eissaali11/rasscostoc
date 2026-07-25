import React, { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { TransfersPage } from './pages/TransfersPage';
import { ShipmentScanPage } from './pages/ShipmentScanPage';
import { api, User } from './api/client';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'transfers' | 'scan'>('transfers');
  const [activeTransferId, setActiveTransferId] = useState<string | undefined>(undefined);

  // Hash Router Listener & URL Permalinks
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/transfers';
      if (hash.startsWith('#/scan')) {
        const parts = hash.split('/');
        const id = parts[2];
        setActiveTransferId(id && id.trim().length > 0 ? id : undefined);
        setCurrentView('scan');
      } else {
        setCurrentView('transfers');
        setActiveTransferId(undefined);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const savedUser = localStorage.getItem('fani_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (_) {}
    }
    const me = await api.getMe();
    if (me) {
      setUser(me);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    window.location.hash = '#/login';
  };

  const handleOpenScan = (transferId?: string) => {
    if (transferId) {
      window.location.hash = `#/scan/${transferId}`;
    } else {
      window.location.hash = '#/scan';
    }
  };

  const handleBackToTransfers = () => {
    window.location.hash = '#/transfers';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center text-slate-900 font-bold">
        <div className="text-sm animate-pulse text-[#0F5EA8]">جاري تحميل نظام RASSCO الويب...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={(u) => { setUser(u); window.location.hash = '#/transfers'; }} />;
  }

  if (currentView === 'scan') {
    return (
      <ShipmentScanPage
        transferId={activeTransferId}
        onBack={handleBackToTransfers}
      />
    );
  }

  return (
    <TransfersPage
      user={user}
      onLogout={handleLogout}
      onOpenScan={handleOpenScan}
    />
  );
};
