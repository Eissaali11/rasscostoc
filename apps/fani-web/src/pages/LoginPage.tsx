import React, { useState } from 'react';
import { User, Lock, ArrowLeft, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { api, User as UserType } from '../api/client';
import { RasscoLogo } from '../components/RasscoLogo';

interface LoginPageProps {
  onLoginSuccess: (user: UserType) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('eissa11');
  const [password, setPassword] = useState('Aa112233');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('يرجى كتابة اسم المستخدم وكلمة المرور');
      return;
    }
    setLoading(true);
    setError(null);

    const result = await api.login(username.trim(), password.trim());
    setLoading(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setError(result.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#070d18] relative overflow-hidden">
      {/* Background Decorative RASSCO Glows */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#18B2B0]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main RASSCO Brand Card */}
      <div className="w-full max-w-md rassco-glass-card rounded-3xl p-8 sm:p-10 relative z-10 border border-[#18B2B0]/25 shadow-2xl backdrop-blur-xl">
        
        {/* Official RASSCO Logo Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <RasscoLogo size="xl" subtitle="بوابة الفنيين — إدارة وتأكيد الاستلام" />
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 mr-1">
              اسم المستخدم
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#18B2B0]">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full pl-4 pr-12 py-4 rounded-2xl glass-input text-white placeholder-slate-500 text-sm font-semibold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 mr-1">
              كلمة المرور
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#18B2B0]">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full pl-4 pr-12 py-4 rounded-2xl glass-input text-white placeholder-slate-500 text-sm font-semibold"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl rassco-btn-primary text-base shadow-xl flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري المصادقة...</span>
              </>
            ) : (
              <>
                <span>تسجيل الدخول</span>
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500 border-t border-slate-800/80 pt-6 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#18B2B0]" />
          <span>نظام RASSCO Enterprise STOCKPRO © 2026</span>
        </div>
      </div>
    </div>
  );
};
