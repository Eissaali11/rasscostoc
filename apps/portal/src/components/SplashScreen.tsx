import { useEffect, useState } from "react";
import splashImage from "@assets/Gemini_Generated_Image_r38bxpr38bxpr38b_1762468250103.png";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      style={{
        animation: "fadeOut 0.5s ease-out 2s forwards",
      }}
      data-testid="splash-screen"
    >
      <style>{`
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
            visibility: hidden;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .splash-image {
          animation: scaleIn 0.6s ease-out;
        }

        .splash-text {
          animation: slideUp 0.8s ease-out 0.3s backwards;
        }

        .splash-subtitle {
          animation: slideUp 0.8s ease-out 0.5s backwards;
        }
      `}</style>

      <div className="flex flex-col items-center justify-center gap-8 px-4">
        <div className="splash-image">
          <img
            src={splashImage}
            alt="RASSCO Logo"
            className="w-64 h-64 md:w-80 md:h-80 object-contain drop-shadow-2xl"
            data-testid="splash-logo"
          />
        </div>

        <div className="flex flex-col items-center gap-3">
          <h1
            className="splash-text text-5xl md:text-6xl font-bold text-gray-800 dark:text-white text-center"
            style={{
              fontFamily: "'Poppins', sans-serif",
            }}
            data-testid="splash-title"
          >
            StockPro
          </h1>
        </div>

        <div className="splash-subtitle mt-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-[#18B2B0] animate-pulse"></div>
            <div className="h-1 w-1 rounded-full bg-[#18B2B0] animate-pulse" style={{ animationDelay: "0.2s" }}></div>
            <div className="h-1 w-1 rounded-full bg-[#18B2B0] animate-pulse" style={{ animationDelay: "0.4s" }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
