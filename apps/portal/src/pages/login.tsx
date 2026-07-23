/**
 * OFFICIAL RASSCO LOGIN — DO NOT REPLACE WITH LEGACY STOCK LAYOUT
 *
 * Single Source of Truth for /login. Full-bleed `/assets/video-erasio.mp4` +
 * glassmorphism (`login-glass-card`). Never revive the two-column particle
 * branding panel (legacy Stock hero / inventory-systems footer copy).
 *
 * Guarded by: scripts/validate-official-login.mjs (runs on every npm run build).
 */
import { useTranslation } from "@/lib/language";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { loginSchema, type LoginRequest } from "@shared/schema";
import { AlertCircle, ArrowRight, Loader2, Lock, User } from "lucide-react";
import { useLocation } from "wouter";
import logo1 from "@/assets/rassco-logo-horizontal.png";

/** Build/deploy fingerprint — scripts/validate-official-login.mjs requires this. */
export const RASSCO_OFFICIAL_LOGIN_MARKER = "RASSCO_OFFICIAL_LOGIN_V1" as const;

export default function Login() {
  const { t, dir } = useTranslation();
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [videoLoaded, setVideoLoaded] = useState(false);
  const isRtl = dir === "rtl";

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
          title: t("reports.completed_successfully"),
          description: t("reports.item_10533", { var_0: result.user?.fullName }),
        });
        setLocation("/home");
      } else {
        const message = result.message || t("reports.error_data_other");
        setErrorMessage(message);
        toast({
          variant: "destructive",
          title: t("reports.error"),
          description: message,
        });
      }
    } catch (error: any) {
      const message = error?.message || t("reports.error_1");
      setErrorMessage(message);
      toast({
        variant: "destructive",
        title: t("reports.error"),
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
        }}
        dir={dir}
      >
        <Loader2 style={{ width: 40, height: 40, color: "#18B2B0" }} className="animate-spin" />
      </div>
    );
  }

  const usernameError = form.formState.errors.username?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <div
      dir={dir}
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        fontFamily: isRtl
          ? '"Noto Kufi Arabic","Montserrat",ui-sans-serif,system-ui,sans-serif'
          : '"Montserrat","Noto Kufi Arabic",ui-sans-serif,system-ui,sans-serif',
      }}
    >
      {/* Full-bleed video background */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setVideoLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: videoLoaded ? 1 : 0,
            transition: "opacity 1.6s ease",
            filter: "brightness(0.9)",
          }}
        >
          <source src="/assets/video-erasio.mp4" type="video/mp4" />
        </video>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 0%, rgba(2,6,23,0.45) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: isRtl
              ? "linear-gradient(to left,  rgba(2,6,23,0.82) 0%, rgba(2,6,23,0.55) 35%, transparent 65%)"
              : "linear-gradient(to right, rgba(2,6,23,0.82) 0%, rgba(2,6,23,0.55) 35%, transparent 65%)",
          }}
        />
      </div>

      {/* Glass card */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: isRtl ? "flex-end" : "flex-start",
          padding: "32px clamp(20px, 5vw, 80px)",
        }}
      >
        <div className="login-glass-card">
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "10%",
              right: "10%",
              height: 1,
              background:
                "linear-gradient(to right, transparent, rgba(24,178,176,0.7), rgba(255,255,255,0.3), rgba(24,178,176,0.7), transparent)",
              borderRadius: "50%",
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 30,
              gap: 14,
            }}
          >
            <img
              src={logo1}
              alt="RASSCO"
              style={{
                height: 85,
                width: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 0 16px rgba(24, 178, 176, 0.25))",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 16,
                  height: 1,
                  background: "linear-gradient(to left, rgba(24,178,176,0.6), transparent)",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#fff",
                  textShadow: "0 0 8px rgba(24,178,176,0.4)",
                }}
              >
                {isRtl ? "نظام المخزون" : "Inventory System"}
              </span>
              <div
                style={{
                  width: 16,
                  height: 1,
                  background: "linear-gradient(to right, rgba(24,178,176,0.6), transparent)",
                }}
              />
            </div>
          </div>

          <h1
            style={{
              fontSize: "clamp(1.5rem,2.2vw,1.85rem)",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.025em",
              margin: "0 0 6px",
              lineHeight: 1.2,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t("reports.item_22313")}
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "rgba(148,163,184,0.65)",
              margin: "0 0 30px",
              lineHeight: 1.6,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t("reports.submit_data_dashboard_control")}
          </p>

          {!!errorMessage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 12,
                padding: "11px 14px",
                marginBottom: 20,
              }}
            >
              <AlertCircle style={{ width: 14, height: 14, color: "#f87171", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#f87171" }}>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div style={{ marginBottom: 18 }}>
              <label className="lp-label" style={{ textAlign: isRtl ? "right" : "left" }}>
                {t("reports.name_user")}
              </label>
              <div className="lp-3d-inp" style={{ flexDirection: isRtl ? "row-reverse" : "row" }}>
                <span className="lp-ic">
                  <User size={15} />
                </span>
                <input
                  {...form.register("username")}
                  placeholder={t("reports.name_user_1")}
                  type="text"
                  disabled={isSubmitting}
                  data-testid="input-username"
                  style={{ direction: "ltr", textAlign: "center" }}
                />
              </div>
              {!!usernameError && <p className="lp-ferr">{usernameError}</p>}
            </div>

            <div style={{ marginBottom: 22 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                  flexDirection: isRtl ? "row-reverse" : "row",
                }}
              >
                <label className="lp-label" style={{ margin: 0 }}>
                  {t("reports.item_15983")}
                </label>
                <button type="button" className="lp-forgot">
                  {t("reports.item_23963")}
                </button>
              </div>
              <div className="lp-3d-inp" style={{ flexDirection: isRtl ? "row-reverse" : "row" }}>
                <span className="lp-ic">
                  <Lock size={15} />
                </span>
                <input
                  {...form.register("password")}
                  placeholder="••••••••••••"
                  type="password"
                  disabled={isSubmitting}
                  data-testid="input-password"
                  style={{ textAlign: "center" }}
                />
              </div>
              {!!passwordError && <p className="lp-ferr">{passwordError}</p>}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 26,
                flexDirection: isRtl ? "row-reverse" : "row",
              }}
            >
              <input
                id="rem"
                type="checkbox"
                style={{ width: 14, height: 14, accentColor: "#18B2B0", cursor: "pointer" }}
              />
              <label
                htmlFor="rem"
                style={{ fontSize: 12, color: "rgba(100,116,139,0.7)", cursor: "pointer" }}
              >
                {t("reports.device")}
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-login"
              className="lp-submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                  <span>{t("reports.item_24067")}</span>
                </>
              ) : (
                <>
                  <span>{t("reports.system")}</span>
                  <ArrowRight size={16} style={{ transform: isRtl ? "rotate(180deg)" : "none" }} />
                </>
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: 26,
              paddingTop: 20,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 11,
              color: "rgba(71,85,105,0.55)",
            }}
          >
            <Lock size={11} />
            <span>{t("users.system_1")}</span>
            <span
              style={{
                color: "rgba(24,178,176,0.55)",
                fontFamily: "Montserrat,monospace",
                fontWeight: 700,
                fontSize: 10,
              }}
            >
              AES-256
            </span>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "20%",
              right: "20%",
              height: 1,
              background: "linear-gradient(to right, transparent, rgba(24,178,176,0.3), transparent)",
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 18,
          zIndex: 10,
          ...(isRtl ? { left: 24 } : { right: 24 }),
          fontSize: 10,
          color: "rgba(71,85,105,0.4)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontFamily: "Montserrat,ui-sans-serif",
        }}
      >
        RASSCO © 2026
      </div>

      <style>{`
        @keyframes cardIn {
          from { opacity:0; transform:translateY(28px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }

        .login-glass-card {
          position: relative;
          width: 100%;
          max-width: 420px;
          padding: 44px 40px;
          border-radius: 28px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 50%, rgba(24,178,176,0.04) 100%);
          backdrop-filter: blur(32px) saturate(180%);
          -webkit-backdrop-filter: blur(32px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow:
            0 0 0 1px rgba(24,178,176,0.08),
            0 40px 80px rgba(0,0,0,0.55),
            0 16px 40px rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(255,255,255,0.15),
            inset 0 -1px 0 rgba(0,0,0,0.2),
            0 0 60px rgba(24,178,176,0.06);
          animation: cardIn 0.75s cubic-bezier(0.22,1,0.36,1) both;
          overflow: hidden;
        }

        .lp-label {
          display: block;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(71,85,105,0.85);
          margin-bottom: 9px;
        }

        .lp-3d-inp {
          display: flex;
          align-items: center;
          position: relative;
          background: rgba(2,6,23,0.45);
          border-radius: 13px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.08),
            0 4px 12px rgba(0,0,0,0.4),
            inset 0 2px 6px rgba(0,0,0,0.35),
            inset 0 -1px 0 rgba(255,255,255,0.04);
          transition: border-color .25s, box-shadow .25s, background .25s;
        }
        .lp-3d-inp:focus-within {
          background: rgba(4,10,30,0.5);
          border-color: rgba(24,178,176,0.45);
          box-shadow:
            0 0 0 3px rgba(24,178,176,0.13),
            0 4px 16px rgba(24,178,176,0.1),
            0 6px 18px rgba(0,0,0,0.45),
            inset 0 2px 8px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(24,178,176,0.12);
        }
        .lp-3d-inp input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #e2e8f0;
          font-size: 14px;
          font-family: inherit;
          padding: 14px 14px;
        }
        .lp-3d-inp input::placeholder { color: rgba(71,85,105,0.45); }
        .lp-ic {
          display: flex; align-items: center;
          padding: 0 14px;
          color: rgba(71,85,105,0.6);
          transition: color .25s;
          flex-shrink: 0;
        }
        .lp-3d-inp:focus-within .lp-ic { color: rgba(24,178,176,0.85); }

        .lp-forgot {
          font-size: 11px; color: rgba(24,178,176,0.55);
          background: none; border: none; cursor: pointer;
          font-family: inherit; transition: color .2s;
        }
        .lp-forgot:hover { color: #18B2B0; }

        .lp-ferr {
          font-size: 11px; color: #f87171;
          margin: 5px 0 0; text-align: start;
        }

        .lp-submit {
          width: 100%; padding: 15px;
          border-radius: 13px;
          cursor: pointer; font-family: inherit;
          font-size: 14.5px; font-weight: 700; letter-spacing: .05em;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          position: relative; overflow: hidden;
          color: #fff;
          border: 1px solid rgba(24,178,176,0.5);
          background: linear-gradient(135deg, #0f8f8c 0%, #0d6e70 50%, #0a5254 100%);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.15) inset,
            0 -1px 0 rgba(0,0,0,0.2) inset,
            0 8px 24px rgba(24,178,176,0.3),
            0 2px 6px rgba(0,0,0,0.3);
          transition: transform .22s, box-shadow .22s, filter .22s;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        .lp-submit::before {
          content: "";
          position: absolute; top: 0; left: 0; right: 0; height: 50%;
          background: linear-gradient(to bottom, rgba(255,255,255,0.12), transparent);
          border-radius: 13px 13px 0 0;
          pointer-events: none;
        }
        .lp-submit::after {
          content: "";
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
          transform: translateX(-130%);
          transition: transform .65s ease;
        }
        .lp-submit:hover::after { transform: translateX(140%); }
        .lp-submit:hover:not(:disabled) {
          filter: brightness(1.12);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.15) inset,
            0 -1px 0 rgba(0,0,0,0.2) inset,
            0 12px 32px rgba(24,178,176,0.4),
            0 4px 10px rgba(0,0,0,0.35);
          transform: translateY(-2px);
        }
        .lp-submit:active:not(:disabled) { transform: translateY(0); filter: brightness(0.95); }
        .lp-submit:disabled { opacity: .5; cursor: not-allowed; }

        @media (max-width: 600px) {
          .login-glass-card { padding: 32px 24px; border-radius: 20px; max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
