import { useTranslation, t } from "@/lib/language";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Hourglass,
  Layers,
  Sliders,
} from "lucide-react";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const QUICK_EXPORTS = [
  {
    label: t("courier.export_logs"),
    icon: Layers,
    params: new URLSearchParams(),
    accent: "#18B2B0",
  },
  {
    label: t("courier.export_transaction_day"),
    icon: Calendar,
    params: new URLSearchParams({ dateFrom: todayIso(), dateTo: todayIso() }),
    accent: "#18B2B0",
  },
  {
    label: t("courier.export_requests"),
    icon: CheckCircle2,
    params: new URLSearchParams({ status: "Installation Completed - NL" }),
    accent: "#149D9B",
  },
  {
    label: t("courier.export_requests_1"),
    icon: XCircle,
    params: new URLSearchParams({ status: "Not Completed" }),
    accent: "#E05252",
  },
  {
    label: t("courier.export_1"),
    icon: Hourglass,
    params: new URLSearchParams({ status: "Under Process" }),
    accent: "#F4B740",
  },
];

export default function CourierExportPage() {
  const { t, dir } = useTranslation();
  const getExportUrl = (params: URLSearchParams) => {
    // Download authenticates via the httpOnly cookie on the GET navigation.
    return `/api/courier/requests/export?${params.toString()}`;
  };

  return (
    <div dir={dir} className="rassco-page space-y-7 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-2 border-b border-[rgba(24,178,176,0.16)] pb-6"
      >
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2D3135] flex items-center gap-3">
          <span className="courier-icon-badge">
            <Download className="w-5 h-5" />
          </span>
          {t("courier.export")}
        </h1>
        <p className="text-sm text-[#6B7280] leading-relaxed max-w-2xl ps-14">
          {t("courier.text_1")}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUICK_EXPORTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.a
              key={idx}
              href={getExportUrl(item.params)}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="courier-export-card"
              style={{ borderColor: `${item.accent}33` }}
            >
              <div
                className="courier-export-icon"
                style={{
                  color: item.accent,
                  backgroundColor: `${item.accent}14`,
                  borderColor: `${item.accent}33`,
                }}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-[#2D3135] block truncate">{item.label}</span>
                <span className="text-xs text-[#6B7280] mt-1 block">{t("courier.file")}</span>
              </div>
            </motion.a>
          );
        })}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href="/courier/reports" className="courier-export-card h-full">
            <div className="courier-export-icon">
              <Sliders className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-[#2D3135] block">{t("courier.item_25538")}</span>
              <span className="text-xs text-[#6B7280] mt-1 block">{t("courier.reports_1")}</span>
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
