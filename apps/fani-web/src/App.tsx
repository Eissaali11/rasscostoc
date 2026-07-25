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
  };

  const handleOpenScan = (transferId?: string) => {
    setActiveTransferId(transferId);
    setCurrentView('scan');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1322] flex items-center justify-center text-white">
        <div className="text-sm font-medium animate-pulse text-cyan-400">جاري تحميل نظام RASSCO الويب...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={(u) => setUser(u)} />;
  }

  if (currentView === 'scan') {
    return (
      <ShipmentScanPage
        transferId={activeTransferId}
        onBack={() => setCurrentView('transfers')}
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
