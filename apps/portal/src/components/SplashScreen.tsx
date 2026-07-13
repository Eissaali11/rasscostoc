import { useEffect, useState } from "react";
import rasscoLogo from "@/assets/rassco-logo.png";

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#eefbfb] via-white to-[#F7F8FA]"
      style={{
        animation: "fadeOut 0.5s ease-out 2s forwards",
      }}
      data-testid="splash-screen"
    >
      <style>{`
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; visibility: hidden; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .splash-image { animation: scaleIn 0.6s ease-out; }
        .splash-text { animation: slideUp 0.8s ease-out 0.3s backwards; }
        .splash-subtitle { animation: slideUp 0.8s ease-out 0.5s backwards; }
      `}</style>

      <div className="flex flex-col items-center justify-center gap-8 px-4">
        <div className="splash-image">
          <img
            src={rasscoLogo}
            alt="RASSCO Logo"
            className="w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-2xl"
            data-testid="splash-logo"
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1
            className="splash-text text-4xl md:text-5xl font-bold text-[#2D3135] text-center"
            style={{
              fontFamily: '"Noto Kufi Arabic", ui-sans-serif, system-ui, sans-serif',
              fontWeight: 700,
            }}
            data-testid="splash-title"
          >
            StockPro
          </h1>
          <p className="splash-subtitle text-sm md:text-base text-[#5F6368] font-medium tracking-wide">
            RASSCO Enterprise
          </p>
        </div>

        <div className="splash-subtitle mt-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[#18B2B0] animate-pulse" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#18B2B0] animate-pulse" style={{ animationDelay: "0.2s" }} />
            <div className="h-1.5 w-1.5 rounded-full bg-[#18B2B0] animate-pulse" style={{ animationDelay: "0.4s" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
