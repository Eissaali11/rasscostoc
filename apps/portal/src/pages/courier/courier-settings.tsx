import { useTranslation } from "@/lib/language";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import {
  Loader2,
  Settings,
  Users,
  MapPin,
  Wifi,
  Building,
  AlertOctagon,
  Search,
} from "lucide-react";

interface LookupsResponse {
  cities: Array<{ id: number; name_en: string; name_ar: string }>;
  technicians: Array<{ id: number; name: string; code: string }>;
  simTypes: Array<{ id: number; name: string }>;
  vendorTypes: Array<{ id: number; name: string }>;
  failureReasons: Array<{ id: number; name: string; sortOrder: number }>;
}

type TabKey = "technicians" | "cities" | "simTypes" | "vendorTypes" | "failureReasons";

const RASSCO = {
  primary: "#18B2B0",
  gray: "#6B7280",
};

export default function CourierSettingsPage() {
  const { t, dir } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("technicians");
  const [search, setSearch] = useState("");

  const { data: lookups, isLoading } = useQuery<LookupsResponse>({
    queryKey: ["/api/courier/lookups"],
    queryFn: () => apiRequest("GET", "/api/courier/lookups").then((r) => r.json()),
  });

  const getFilteredItems = () => {
    if (!lookups) return [];
    const query = search.toLowerCase();

    switch (activeTab) {
      case "technicians":
        return lookups.technicians.filter(
          (item) =>
            (item.name || "").toLowerCase().includes(query) ||
            (item.code || "").toLowerCase().includes(query),
        );
      case "cities":
        return lookups.cities.filter(
          (c) => (c.name_en || "").toLowerCase().includes(query) || (c.name_ar || "").includes(query),
        );
      case "simTypes":
        return lookups.simTypes.filter((s) => (s.name || "").toLowerCase().includes(query));
      case "vendorTypes":
        return lookups.vendorTypes.filter((v) => (v.name || "").toLowerCase().includes(query));
      case "failureReasons":
        return lookups.failureReasons.filter((f) => (f.name || "").toLowerCase().includes(query));
      default:
        return [];
    }
  };

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Users; count: number }> = [
    {
      key: "technicians",
      label: t("courier.technicians_1"),
      icon: Users,
      count: lookups?.technicians.length ?? 0,
    },
    {
      key: "cities",
      label: t("courier.item_20771"),
      icon: MapPin,
      count: lookups?.cities.length ?? 0,
    },
    {
      key: "simTypes",
      label: t("courier.sims"),
      icon: Wifi,
      count: lookups?.simTypes.length ?? 0,
    },
    {
      key: "vendorTypes",
      label: t("courier.item_22289"),
      icon: Building,
      count: lookups?.vendorTypes.length ?? 0,
    },
    {
      key: "failureReasons",
      label: t("courier.fail_3"),
      icon: AlertOctagon,
      count: lookups?.failureReasons.length ?? 0,
    },
  ];

  const filtered = getFilteredItems();
  const activeMeta = tabs.find((tab) => tab.key === activeTab);

  return (
    <div dir={dir} className="space-y-6 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2D3135] flex items-center gap-2">
          <span
            className="size-10 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: `${RASSCO.primary}18`, color: RASSCO.primary }}
          >
            <Settings className="w-5 h-5" />
          </span>
          {t("courier.settings_1")}
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("courier.text_2")}</p>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <motion.button
              key={tab.key}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => {
                setActiveTab(tab.key);
                setSearch("");
              }}
              className={`rassco-glass p-4 text-right transition-all ${
                active ? "ring-2 ring-[#18B2B0]/35 border-[#18B2B0]" : ""
              }`}
            >
              <div
                className="size-9 rounded-xl flex items-center justify-center mb-3"
                style={{
                  backgroundColor: active ? RASSCO.primary : `${RASSCO.primary}14`,
                  color: active ? "#fff" : RASSCO.primary,
                }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-[#6B7280] mb-1 truncate">{tab.label}</p>
              <p className="text-xl font-extrabold text-[#2D3135]">{tab.count.toLocaleString("ar-SA")}</p>
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={`pill-${tab.key}`}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setSearch("");
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                active
                  ? "bg-[#18B2B0] text-white shadow-md shadow-[#18B2B0]/20"
                  : "text-[#6B7280] hover:text-[#2D3135] hover:bg-white/70 border border-[rgba(24,178,176,0.12)] bg-white/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 max-w-md rassco-glass px-3 py-2 focus-within:ring-2 focus-within:ring-[#18B2B0]/25">
        <Search className="w-4 h-4 text-[#6B7280] shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("courier.item_20836")}
          className="w-full bg-transparent border-0 text-[#2D3135] text-sm focus:outline-none focus:ring-0 placeholder:text-[#9CA3AF]"
        />
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rassco-glass overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[rgba(24,178,176,0.12)] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#2D3135]">{activeMeta?.label}</h2>
          <span className="text-xs font-semibold text-[#6B7280]">
            {filtered.length.toLocaleString("ar-SA")} / {(activeMeta?.count ?? 0).toLocaleString("ar-SA")}
          </span>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-[#6B7280]">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: RASSCO.primary }} />
              {t("courier.loading_1")}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[#6B7280]">{t("courier.no_logs_1")}</div>
        ) : (
          <div className="divide-y divide-[rgba(24,178,176,0.08)]">
            {activeTab === "technicians" &&
              (filtered as LookupsResponse["technicians"]).map((tech) => (
                <div key={tech.id} className="p-4 flex items-center justify-between hover:bg-[rgba(24,178,176,0.04)] transition-colors">
                  <span className="font-semibold text-[#2D3135]">{tech.name}</span>
                  <span className="text-xs font-mono text-[#18B2B0] px-2.5 py-1 bg-[rgba(24,178,176,0.1)] rounded-lg">
                    {tech.code}
                  </span>
                </div>
              ))}

            {activeTab === "cities" &&
              (filtered as LookupsResponse["cities"]).map((city) => (
                <div key={city.id} className="p-4 flex items-center justify-between hover:bg-[rgba(24,178,176,0.04)] transition-colors">
                  <span className="font-semibold text-[#2D3135]">{city.name_ar}</span>
                  <span className="text-sm font-mono text-[#6B7280]">{city.name_en}</span>
                </div>
              ))}

            {activeTab === "simTypes" &&
              (filtered as LookupsResponse["simTypes"]).map((sim) => (
                <div key={sim.id} className="p-4 flex items-center justify-between hover:bg-[rgba(24,178,176,0.04)] transition-colors">
                  <span className="font-semibold text-[#2D3135]">{sim.name}</span>
                  <span className="text-xs text-[#6B7280]">
                    {t("courier.item_9741")}
                    {sim.id}
                  </span>
                </div>
              ))}

            {activeTab === "vendorTypes" &&
              (filtered as LookupsResponse["vendorTypes"]).map((vendor) => (
                <div key={vendor.id} className="p-4 flex items-center justify-between hover:bg-[rgba(24,178,176,0.04)] transition-colors">
                  <span className="font-semibold text-[#2D3135]">{vendor.name}</span>
                  <span className="text-xs text-[#6B7280]">
                    {t("courier.item_9741")}
                    {vendor.id}
                  </span>
                </div>
              ))}

            {activeTab === "failureReasons" &&
              (filtered as LookupsResponse["failureReasons"]).map((reason) => (
                <div key={reason.id} className="p-4 flex items-center justify-between hover:bg-[rgba(24,178,176,0.04)] transition-colors">
                  <span className="font-semibold text-[#2D3135]">{reason.name}</span>
                  <span className="text-xs text-[#6B7280]">
                    {t("courier.rank")}
                    {reason.sortOrder}
                  </span>
                </div>
              ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
