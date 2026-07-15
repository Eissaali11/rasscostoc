import { useTranslation } from "@/lib/language";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { loginSchema, type LoginRequest } from "@shared/schema";
import { AlertCircle, ArrowLeft, Loader2, Lock, User } from "lucide-react";
import { useLocation } from "wouter";
import stockLogo from "@/assets/rassco-logo-horizontal.png";

export default function Login() {
  const { t, dir } = useTranslation();
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [videoLoaded, setVideoLoaded] = useState(false);

  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginRequest) => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const result = await login(data);

      if (result.success) {
        toast({
          title: t('reports.completed_successfully'),
          description: t('reports.item_10533', { var_0: result.user?.fullName }),
        });
        setLocation("/home");
      } else {
        const message = result.message || t('reports.error_data_other');
        setErrorMessage(message);
        toast({
          variant: "destructive",
          title: t('reports.error'),
          description: message,
        });
      }
    } catch (error: any) {
      const message = error?.message || t('reports.error_1');
      setErrorMessage(message);
      toast({
        variant: "destructive",
        title: t('reports.error'),
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]" dir={dir}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-teal-400 mx-auto mb-4" />
          <p className="text-white text-lg font-semibold">{t('reports.loading')}</p>
        </div>
      </div>
    );
  }

  const usernameError = form.formState.errors.username?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <>
      <style>{`
        .login-root {
          --obsidian: #020617;
          --glass-border: rgba(255, 255, 255, 0.05);
          --glass-bg: rgba(15, 23, 42, 0.6);
          font-family: "Noto Kufi Arabic", ui-sans-serif, system-ui, sans-serif;
          background: var(--obsidian);
        }

        .glass-panel {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          position: relative;
          overflow: hidden;
          animation: fadeUp 0.7s ease-out both;
        }

        @keyframes logoBreath {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-8px) scale(1.02);
          }
        }

        @keyframes ringSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes ambientDrift {
          0%,
          100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(18px, -12px);
          }
        }

        @keyframes pulseParticle {
          0%,
          100% {
            opacity: 0.4;
            transform: translateY(0px);
          }
          50% {
            opacity: 1;
            transform: translateY(-10px);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes sheenMove {
          from {
            transform: translateX(-120%);
          }
          to {
            transform: translateX(140%);
          }
        }

        .glass-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            transparent 30%,
            rgba(45, 212, 191, 0.08) 50%,
            transparent 70%
          );
          animation: sheenMove 7s linear infinite;
          pointer-events: none;
        }

        .brand-logo-shell {
          position: relative;
          animation: logoBreath 5.5s ease-in-out infinite;
        }

        .brand-logo-ring {
          position: absolute;
          inset: -10px;
          border-radius: 28px;
          border: 1px solid rgba(45, 212, 191, 0.22);
          border-top-color: rgba(34, 211, 238, 0.55);
          border-bottom-color: rgba(16, 185, 129, 0.45);
          animation: ringSpin 14s linear infinite;
          pointer-events: none;
        }

        .ambient-blob-one {
          animation: ambientDrift 11s ease-in-out infinite;
        }

        .ambient-blob-two {
          animation: ambientDrift 13s ease-in-out infinite reverse;
        }

        .input-container-elite {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          transition: all 0.3s ease;
        }

        .input-container-elite:focus-within {
          border-color: rgba(45, 212, 191, 0.45);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 0 20px rgba(45, 212, 191, 0.08);
        }

        .message-box {
          animation: slideDown 0.35s ease-out forwards;
        }

        .grid-overlay {
          background-image:
            linear-gradient(to right, rgba(255, 255, 255, 0.012) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.012) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        .particle {
          animation: pulseParticle 8s ease-in-out infinite;
        }

        .brand-content {
          animation: fadeUp 0.65s ease-out both;
          animation-delay: 0.1s;
        }

        .capability-item {
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(45, 212, 191, 0.14);
          border-radius: 12px;
          padding: 10px 12px;
          color: #cbd5e1;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          opacity: 0;
          transform: translateY(8px);
          animation: fadeUp 0.6s ease-out forwards;
          transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease;
        }

        .capability-item:hover {
          transform: translateY(-2px);
          border-color: rgba(45, 212, 191, 0.35);
          background: rgba(15, 23, 42, 0.72);
        }

        .capability-item:nth-child(1) {
          animation-delay: 0.18s;
        }

        .capability-item:nth-child(2) {
          animation-delay: 0.28s;
        }

        .capability-item:nth-child(3) {
          animation-delay: 0.38s;
        }

        .performance-summary {
          margin-top: 14px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(45, 212, 191, 0.16);
          background: linear-gradient(145deg, rgba(8, 47, 73, 0.35), rgba(15, 23, 42, 0.35));
          animation: fadeUp 0.6s ease-out both;
          animation-delay: 0.16s;
        }

        .performance-title {
          font-size: 12px;
          color: #5eead4;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .performance-text {
          font-size: 11px;
          color: #a7b3c8;
          line-height: 1.9;
        }

        .performance-metrics {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .metric-pill {
          border-radius: 10px;
          padding: 8px 6px;
          border: 1px solid rgba(45, 212, 191, 0.14);
          background: rgba(2, 6, 23, 0.45);
          text-align: center;
          animation: fadeUp 0.6s ease-out both;
        }

        .metric-pill:nth-child(1) {
          animation-delay: 0.2s;
        }

        .metric-pill:nth-child(2) {
          animation-delay: 0.27s;
        }

        .metric-pill:nth-child(3) {
          animation-delay: 0.34s;
        }

        .metric-value {
          color: #99f6e4;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .metric-label {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 10px;
        }

        .mobile-brand-logo {
          filter: drop-shadow(0 0 28px rgba(45, 212, 191, 0.2));
        }

        .cta-button {
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }

        .cta-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 0 24px rgba(45, 212, 191, 0.18);
        }
      `}</style>

      <div className="login-root min-h-screen text-slate-100 relative overflow-hidden" dir={dir}>
        {/* Ambient background with video */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setVideoLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-1000 ease-in-out ${
              videoLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105"
            }`}
            style={{ 
              filter: "brightness(0.55) contrast(1.1)", 
            }}
          >
            <source src="/assets/video-erasio.mp4" type="video/mp4" />
          </video>
          {/* Subtle gradient overlay to enhance visual depth and contrast */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/75 to-slate-950/90" 
            style={{ 
              mixBlendMode: "multiply"
            }} 
          />
          <div 
            className="absolute inset-0 bg-[#020617]/40" 
          />
        </div>

        <div className="flex min-h-screen relative z-10">
          <div className="hidden lg:flex w-1/2 relative bg-transparent items-center justify-center overflow-hidden border-l border-white/[0.03]">
            <div className="absolute inset-0" style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(45,212,191,0.08), transparent 35%), radial-gradient(circle at 80% 70%, rgba(6,182,212,0.08), transparent 40%)",
            }} />
            <div className="ambient-blob-one absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
            <div className="ambient-blob-two absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px]" />

            <div className="absolute inset-0 pointer-events-none">
              <div className="particle absolute top-[15%] left-[10%] w-1.5 h-1.5 bg-cyan-400/30 rounded-full blur-[1px]" />
              <div className="particle absolute top-[60%] left-[20%] w-1 h-1 bg-teal-400/40 rounded-full blur-[1px]" style={{ animationDelay: "-2s" }} />
              <div className="particle absolute top-[30%] left-[80%] w-2 h-2 bg-cyan-400/20 rounded-full blur-[2px]" style={{ animationDelay: "-5s" }} />
              <div className="particle absolute top-[80%] left-[70%] w-1 h-1 bg-teal-400/30 rounded-full blur-[1px]" style={{ animationDelay: "-7s" }} />
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="brand-logo-shell relative mb-10">
                <div className="brand-logo-ring" />
                <div className="rounded-3xl p-8 border border-teal-400/15 bg-slate-900/40 backdrop-blur-lg">
                  <img src={stockLogo} alt="Stock Enterprise" className="h-28 w-auto object-contain" />
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-72 h-12 bg-teal-500/20 blur-2xl rounded-full" />
              </div>

              <div className="brand-content text-center space-y-4 px-10 max-w-md">
                <h1 className="text-5xl font-light tracking-widest text-white">{t('reports.item_6376')}</h1>
                <div className="w-12 h-0.5 bg-teal-500/30 mx-auto my-4" />

              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative bg-transparent">
            <div className="absolute inset-0 grid-overlay" />

            <div className="lg:hidden absolute top-12 left-1/2 -translate-x-1/2 text-center">
              <img src={stockLogo} alt="Stock Enterprise" className="mobile-brand-logo h-20 w-auto object-contain mx-auto mb-3" />
              <h1 className="text-3xl font-bold text-white">{t('reports.item_6376')}</h1>
            </div>

            <div className="glass-panel w-full max-w-[440px] p-8 md:p-12 rounded-[2rem] relative z-10 mt-16 lg:mt-0">
              <div className="mb-6 min-h-0" id="alert-container">
                {!!errorMessage && (
                  <div className="message-box bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="text-red-400 h-4 w-4 shrink-0" />
                    <p className="text-red-400 text-xs">{errorMessage}</p>
                  </div>
                )}
              </div>

              <div className="mb-8 text-right">
                <h2 className="text-2xl font-light text-white mb-2 tracking-tight">{t('reports.item_22313')}</h2>
                <p className="text-slate-400 text-sm font-light">{t('reports.submit_data_dashboard_control')}</p>
              </div>

              <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-[0.2em] mr-1">{t('reports.name_user')}</label>
                  <div className="input-container-elite group relative flex items-center">
                    <User className="absolute right-4 text-slate-500 group-focus-within:text-teal-400 transition-colors h-4 w-4" />
                    <input
                      {...form.register("username")}
                      className="w-full bg-transparent border-none text-white pr-12 pl-4 py-3.5 rounded-xl focus:outline-none placeholder:text-slate-700 text-sm"
                      placeholder={t('reports.name_user_1')}
                      type="text"
                      disabled={isSubmitting}
                      data-testid="input-username"
                    />
                  </div>
                  {!!usernameError && <p className="text-[11px] text-red-400 mr-1">{usernameError}</p>}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-[0.2em]">{t('reports.item_15983')}</label>
                    <button
                      type="button"
                      className="text-[11px] text-teal-500/60 hover:text-teal-400 transition-colors"
                    >
                      {t('reports.item_23963')}
                    </button>
                  </div>
                  <div className="input-container-elite group relative flex items-center">
                    <Lock className="absolute right-4 text-slate-500 group-focus-within:text-teal-400 transition-colors h-4 w-4" />
                    <input
                      {...form.register("password")}
                      className="w-full bg-transparent border-none text-white pr-12 pl-4 py-3.5 rounded-xl focus:outline-none placeholder:text-slate-700 text-sm"
                      placeholder="••••••••••••"
                      type="password"
                      disabled={isSubmitting}
                      data-testid="input-password"
                    />
                  </div>
                  {!!passwordError && <p className="text-[11px] text-red-400 mr-1">{passwordError}</p>}
                </div>

                <div className="flex items-center px-1">
                  <input
                    className="w-3.5 h-3.5 rounded-sm border-white/10 bg-white/5 text-teal-600 focus:ring-teal-500/20 focus:ring-offset-0"
                    id="remember"
                    type="checkbox"
                  />
                  <label className="mr-3 text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors" htmlFor="remember">
                    {t('reports.device')}
                  </label>
                </div>

                <button
                  className="cta-button w-full py-4 bg-teal-600/10 hover:bg-teal-600/20 border border-teal-500/20 hover:border-teal-500/40 text-teal-400 font-medium text-sm rounded-xl flex items-center justify-center gap-3 transition-all duration-300 group disabled:opacity-60 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-login"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="text-lg animate-spin h-4 w-4" />
                      <span>{t('reports.item_24067')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('reports.system')}</span>
                      <ArrowLeft className="text-lg h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-10 pt-8 border-t border-white/5 flex flex-col items-center gap-6">
                <p className="text-[10px] text-slate-600 flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  {t('users.system_1')} <span className="text-teal-500/40 font-mono">AES-256 BIT</span>
                </p>
                <div className="flex gap-8">
                  <button className="text-slate-500 hover:text-white transition-colors text-[11px] font-medium tracking-wide" type="button">
                    ENGLISH
                  </button>
                  <button className="text-slate-500 hover:text-white transition-colors text-[11px] font-medium" type="button">
                    {t('reports.item_14371')}
                  </button>
                </div>
              </div>
            </div>

            <div className="absolute bottom-8 right-12 hidden lg:block">
              <p className="text-[10px] text-slate-600 tracking-[0.2em] uppercase font-bold">Stock Inventory Systems © 2026</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
