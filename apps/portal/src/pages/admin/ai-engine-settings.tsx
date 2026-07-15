import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BrainCircuit,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  Trash2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/lib/language";

type AiVisionProviderId = "gemini" | "openai" | "claude";

type ConnectionTestResult = {
  ok: boolean;
  provider: AiVisionProviderId;
  model: string;
  latencyMs: number;
  testedAt: string;
  message: string;
  code?: string;
  detail?: string;
};

type AiEngineSettingsPublic = {
  enabled: boolean;
  provider: AiVisionProviderId;
  model: string;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  timeoutMs: number;
  updatedAt: string | null;
  updatedBy: string | null;
  modelsByProvider: Record<AiVisionProviderId, string[]>;
  lastConnectionTest: ConnectionTestResult | null;
};

const PROVIDER_LABELS: Record<AiVisionProviderId, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  claude: "Anthropic Claude",
};

function ConnectionStatusCard({ result }: { result: ConnectionTestResult | null | undefined }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm text-[#64748B]">
        لم يتم اختبار الربط بعد. احفظ المفتاح ثم اضغط «اختبار الربط».
      </div>
    );
  }

  const isQuota = result.code === "quota";

  if (isQuota) {
    return (
      <div className="rounded-xl border border-[#F4B740]/30 bg-[#FFFBEB] p-4 space-y-2">
        <div className="flex items-center gap-2 text-[#92400E] font-bold text-sm">
          <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
          الربط معطّل مؤقتًا — الحصة ممتلئة أو لا يوجد رصيد
        </div>
        <p className="text-sm text-[#78350F]">{result.message}</p>
        {result.detail ? (
          <p className="text-[11px] font-mono text-[#92400E]/70 break-all" dir="ltr">
            {result.detail}
          </p>
        ) : null}
        <p className="text-xs text-[#64748B]" dir="ltr">
          {PROVIDER_LABELS[result.provider] || result.provider} · {result.model} · {new Date(result.testedAt).toLocaleString()}
        </p>
      </div>
    );
  }

  // Key validated: connection is correct.
  if (result.ok) {
    return (
      <div className="rounded-xl border border-[#18B2B0]/30 bg-[#18B2B0]/8 p-4 space-y-1">
        <div className="flex items-center gap-2 text-[#0F766E] font-bold text-sm">
          <CheckCircle2 className="h-5 w-5" />
          الربط صحيح — المفتاح مقبول
        </div>
        <p className="text-sm text-[#334155]">{result.message}</p>
        <p className="text-xs text-[#64748B]" dir="ltr">
          {PROVIDER_LABELS[result.provider] || result.provider} · {result.model} · {new Date(result.testedAt).toLocaleString()}
          {result.latencyMs ? ` · ${result.latencyMs}ms` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E05252]/30 bg-[#FEF2F2] p-4 space-y-1">
      <div className="flex items-center gap-2 font-bold text-sm text-[#B91C1C]">
        <XCircle className="h-5 w-5" />
        الربط لا يعمل
      </div>
      <p className="text-sm text-[#7F1D1D]">{result.message}</p>
      {result.detail ? (
        <p className="text-[11px] font-mono text-[#64748B] break-all" dir="ltr">
          {result.detail}
        </p>
      ) : null}
      <p className="text-xs text-[#64748B]" dir="ltr">
        {PROVIDER_LABELS[result.provider] || result.provider} · {result.model} · {new Date(result.testedAt).toLocaleString()}
      </p>
    </div>
  );
}

export default function AiEngineSettingsPage() {
  const { t, dir } = useTranslation();
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery<AiEngineSettingsPublic>({
    queryKey: ["/api/ai-engine/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai-engine/settings");
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        throw new Error(
          "الخادم لم يُحمّل مسار الإعدادات بعد. أعد تشغيل السيرفر ثم حدّث الصفحة.",
        );
      }
      return res.json();
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<AiVisionProviderId>("gemini");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState(60000);
  const [connectionTest, setConnectionTest] = useState<ConnectionTestResult | null>(null);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setProvider(data.provider);
    setModel(data.model);
    setTimeoutMs(data.timeoutMs);
    setApiKey("");
    setConnectionTest(data.lastConnectionTest ?? null);
  }, [data]);

  const models = useMemo(
    () => data?.modelsByProvider?.[provider] ?? [],
    [data, provider],
  );

  useEffect(() => {
    if (models.length && !models.includes(model)) {
      setModel(models[0]);
    }
  }, [models, model]);

  const saveMutation = useMutation({
    mutationFn: async (opts: { clearApiKey?: boolean; testConnection?: boolean } = {}) => {
      const body: Record<string, unknown> = {
        enabled,
        provider,
        model,
        timeoutMs,
        clearApiKey: opts.clearApiKey === true,
        testConnection: opts.testConnection === true,
      };
      if (!opts.clearApiKey && apiKey.trim()) {
        body.apiKey = apiKey.trim();
      }
      const res = await apiRequest("PUT", "/api/ai-engine/settings", body);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["/api/ai-engine/settings"], result.settings);
      setApiKey("");
      if (result.connectionTest) {
        setConnectionTest(result.connectionTest);
      } else if (result.settings?.lastConnectionTest !== undefined) {
        setConnectionTest(result.settings.lastConnectionTest);
      }
      toast({
        title: t("messages.success"),
        description: result.message || t("ai_engine_settings.saved"),
      });
    },
    onError: (err: Error) => {
      toast({
        title: t("messages.error"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        provider,
        model,
        timeoutMs,
      };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      const res = await apiRequest("POST", "/api/ai-engine/settings/test", body);
      return res.json();
    },
    onSuccess: (result) => {
      setConnectionTest(result.connectionTest);
      if (result.settings) {
        queryClient.setQueryData(["/api/ai-engine/settings"], result.settings);
      }
      toast({
        title: result.connectionTest?.ok
          ? result.connectionTest?.code === "quota"
            ? "الربط صحيح (تنبيه حصة)"
            : "الربط يعمل"
          : "الربط فشل",
        description: result.connectionTest?.message,
        variant: result.connectionTest?.ok ? "default" : "destructive",
      });
    },
    onError: (err: Error) => {
      toast({
        title: t("messages.error"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const busy = saveMutation.isPending || testMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-2 text-rassco-text" dir={dir}>
        <Loader2 className="h-5 w-5 animate-spin text-rassco" />
        <span>{t("messages.loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-3" dir={dir}>
        <p className="text-destructive text-sm">{(error as Error).message}</p>
        <Button variant="outline" onClick={() => refetch()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 md:p-6" dir={dir}>
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-rassco/10 flex items-center justify-center">
            <BrainCircuit className="h-6 w-6 text-rassco" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-rassco-text">{t("titles.ai_engine_settings")}</h1>
            <p className="text-sm text-muted-foreground">{t("ai_engine_settings.subtitle")}</p>
          </div>
        </div>
      </header>

      <ConnectionStatusCard result={connectionTest} />

      <section className="rounded-2xl border bg-white p-5 space-y-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-base">{t("ai_engine_settings.enable")}</Label>
            <p className="text-xs text-muted-foreground mt-1">{t("ai_engine_settings.enable_hint")}</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2">
          <Label>{t("ai_engine_settings.provider")}</Label>
          <Select
            value={provider}
            onValueChange={(v) => {
              setProvider(v as AiVisionProviderId);
              setConnectionTest(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROVIDER_LABELS) as AiVisionProviderId[]).map((id) => (
                <SelectItem key={id} value={id}>
                  {PROVIDER_LABELS[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("ai_engine_settings.model")}</Label>
          <Select
            value={model}
            onValueChange={(v) => {
              setModel(v);
              setConnectionTest(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {t("ai_engine_settings.api_key")}
          </Label>
          {data?.hasApiKey && (
            <p className="text-xs text-muted-foreground">
              {t("ai_engine_settings.current_key")}:{" "}
              <span className="font-mono" dir="ltr">
                {data.apiKeyMasked}
              </span>
            </p>
          )}
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setConnectionTest(null);
              }}
              placeholder={
                data?.hasApiKey
                  ? t("ai_engine_settings.api_key_keep")
                  : t("ai_engine_settings.api_key_placeholder")
              }
              className="pe-10 font-mono"
              dir="ltr"
              autoComplete="off"
            />
            <button
              type="button"
              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? "Hide" : "Show"}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("ai_engine_settings.timeout")}</Label>
          <Input
            type="number"
            min={5000}
            max={300000}
            step={1000}
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Number(e.target.value) || 60000)}
            dir="ltr"
          />
        </div>

        {data?.updatedAt && (
          <p className="text-xs text-muted-foreground">
            {t("ai_engine_settings.last_updated")}:{" "}
            <span dir="ltr">{new Date(data.updatedAt).toLocaleString()}</span>
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={() => saveMutation.mutate({ testConnection: true })}
            disabled={busy}
            className="bg-rassco hover:bg-rassco/90"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin me-2" />
            ) : (
              <Save className="h-4 w-4 me-2" />
            )}
            حفظ واختبار الربط
          </Button>
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={busy || (!apiKey.trim() && !data?.hasApiKey)}
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin me-2" />
            ) : (
              <PlugZap className="h-4 w-4 me-2" />
            )}
            اختبار الربط
          </Button>
          {data?.hasApiKey && (
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate({ clearApiKey: true })}
              disabled={busy}
            >
              <Trash2 className="h-4 w-4 me-2" />
              {t("ai_engine_settings.clear_key")}
            </Button>
          )}
        </div>
      </section>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {t("ai_engine_settings.security_note")}
      </p>
    </div>
  );
}
