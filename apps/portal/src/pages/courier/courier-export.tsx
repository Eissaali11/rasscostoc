import { useTranslation, t } from "@/lib/language";
import { Link } from "wouter";
import {
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Hourglass,
  Layers,
  Sliders
} from "lucide-react";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const QUICK_EXPORTS = [
  {
    label: t('courier.export_logs'),
    icon: Layers,
    params: new URLSearchParams(),
    color: "text-[#18B2B0] border-[#18B2B0]/30 hover:border-[#18B2B0] hover:bg-[#18B2B0]/05"
  },
  {
    label: t('courier.export_transaction_day'),
    icon: Calendar,
    params: new URLSearchParams({ dateFrom: todayIso(), dateTo: todayIso() }),
    color: "text-[#18B2B0] border-[#18B2B0]/30 hover:border-[#18B2B0] hover:bg-[#18B2B0]/05"
  },
  {
    label: t('courier.export_requests'),
    icon: CheckCircle2,
    params: new URLSearchParams({ status: "Installation Completed - NL" }),
    color: "text-[#18B2B0] border-[#18B2B0]/30 hover:border-[#18B2B0] hover:bg-[#18B2B0]/05"
  },
  {
    label: t('courier.export_requests_1'),
    icon: XCircle,
    params: new URLSearchParams({ status: "Not Completed" }),
    color: "text-[#E05252] border-[#E05252]/30 hover:border-[#E05252] hover:bg-[#E05252]/05"
  },
  {
    label: t('courier.export_1'),
    icon: Hourglass,
    params: new URLSearchParams({ status: "Under Process" }),
    color: "text-[#F4B740] border-[#F4B740]/30 hover:border-[#F4B740] hover:bg-[#F4B740]/05"
  }
];

export default function CourierExportPage() {
  const { t, dir } = useTranslation();
  const getExportUrl = (params: URLSearchParams) => {
    const token = localStorage.getItem("auth-token") || "";
    params.set("token", token);
    return `/api/courier/requests/export?${params.toString()}`;
  };

  return (
    <div dir={dir} className="rassco-page space-y-6 text-[#2D3135] max-w-4xl">
      {/* Header */}
      <div className="border-b border-[#E2E8F0] pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#2D3135] flex items-center gap-2">
          <Download className="w-6 h-6 text-[#18B2B0]" />
          {t('courier.export')}
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {t('courier.text_1')}
        </p>
      </div>

      {/* Grid options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUICK_EXPORTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <a
              key={idx}
              href={getExportUrl(item.params)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-4 p-5 rassco-glass border rounded-2xl transition-all duration-200 ${item.color}`}
            >
              <div className="p-3 bg-[#F8FAFC] rounded-xl">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <span className="font-semibold text-[#2D3135] block">{item.label}</span>
                <span className="text-xs text-[#6B7280] mt-0.5 block">{t('courier.file')}</span>
              </div>
            </a>
          );
        })}

        <Link
          href="/courier/reports"
          className="flex items-center gap-4 p-5 bg-white border border-[#E2E8F0] hover:border-[#18B2B0] hover:bg-[#18B2B0]/05 rounded-2xl shadow-lg transition-all duration-200 text-[#18B2B0]"
        >
          <div className="p-3 bg-[#F8FAFC] rounded-xl">
            <Sliders className="w-6 h-6 text-[#18B2B0]" />
          </div>
          <div>
            <span className="font-semibold text-[#2D3135] block">{t('courier.item_25538')}</span>
            <span className="text-xs text-[#6B7280] mt-0.5 block">{t('courier.reports_1')}</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
