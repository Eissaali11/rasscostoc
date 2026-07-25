import { useTranslation } from "@/lib/language";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  QrCode, 
  Search, 
  User, 
  Calendar, 
  Tag, 
  AlertCircle, 
  CheckCircle, 
  Smartphone, 
  Handshake, 
  FileText, 
  Cable, 
  Boxes, 
  History, 
  MapPin, 
  ArrowRight,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Building2,
  PackageCheck,
  Clock,
  ArrowUpRight,
  Phone,
  MessageCircle,
  AtSign,
  Activity,
  GitCommit,
  UserCheck,
  ChevronLeft
} from "lucide-react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type HistoryLogItem = {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedById: string;
  changedByName: string;
  changedByUsername?: string | null;
  changedByProfileImage?: string | null;
  notes?: string | null;
  changedAt: string;
};

type SerialLookupResult = {
  id: string;
  serialNumber: string;
  status: string;
  itemTypeId: string | null;
  carrierName: string | null;
  createdAt: string;
  updatedAt: string | null;
  itemTypeName: string | null;
  itemTypeCategory: string | null;
  ownerName: string | null;
  ownerId: string | null;
  ownerCity?: string | null;
  ownerRegionName?: string | null;
  technicianId?: string | null;
  technicianName?: string | null;
  technicianUsername?: string | null;
  technicianPhone?: string | null;
  technicianCity?: string | null;
  technicianRegionName?: string | null;
  technicianProfileImage?: string | null;
  deliveredAt?: string | null;
  orderNumber?: string | null;
  closedById?: string | null;
  closedByName?: string | null;
  closedByUsername?: string | null;
  closedByProfileImage?: string | null;
  historyLogs?: HistoryLogItem[];
};

export default function VerificationPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scanValue, setScanValue] = useState("");
  const [serialQuery, setSerialQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus scanning input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data: itemData, error, isLoading, refetch } = useQuery<SerialLookupResult>({
    queryKey: [`/api/items/lookup/${serialQuery}`],
    enabled: !!serialQuery,
    retry: false,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      if (!itemData?.id) return;
      const res = await apiRequest("PATCH", `/api/items/${itemData.id}/status`, {
        status,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('verification.completed_update_status_serial'),
        description: t('verification.completed_edit_status_number_s'),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/items/lookup/${serialQuery}`] });
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: t('verification.fail_update_status'),
        description: err.message || t('verification.error'),
        variant: "destructive",
      });
    },
  });

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scanValue.trim()) return;
    setSerialQuery(scanValue.trim());
  };

  const handleQuickScan = (sampleSerial: string) => {
    setScanValue(sampleSerial);
    setSerialQuery(sampleSerial);
  };

  const handleClear = () => {
    setScanValue("");
    setSerialQuery("");
    inputRef.current?.focus();
  };

  const copySerialToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "تم نسخ الرقم التسلسلي",
      description: text,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to resolve category badge & colors
  const getCategoryDetails = (category?: string | null) => {
    switch (category) {
      case "devices":
        return { 
          label: t('verification.pos_devices'), 
          icon: Smartphone, 
          color: "text-teal-700 bg-teal-500/10 border-teal-500/25",
          badgeBg: "bg-teal-50 text-teal-700 border-teal-200" 
        };
      case "sim":
        return { 
          label: t('verification.sim_1'), 
          icon: Handshake, 
          color: "text-purple-700 bg-purple-500/10 border-purple-500/25",
          badgeBg: "bg-purple-50 text-purple-700 border-purple-200" 
        };
      case "papers":
        return { 
          label: t('verification.paper_print'), 
          icon: FileText, 
          color: "text-amber-700 bg-amber-500/10 border-amber-500/25",
          badgeBg: "bg-amber-50 text-amber-700 border-amber-200" 
        };
      case "accessories":
        return { 
          label: t('verification.accessories_chargers'), 
          icon: Cable, 
          color: "text-emerald-700 bg-emerald-500/10 border-emerald-500/25",
          badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200" 
        };
      default:
        return { 
          label: t('verification.item_9565'), 
          icon: Boxes, 
          color: "text-slate-700 bg-slate-500/10 border-slate-500/25",
          badgeBg: "bg-slate-100 text-slate-700 border-slate-200" 
        };
    }
  };

  // Helper to translate and style status
  const getStatusDetails = (status?: string | null) => {
    switch (status) {
      case "RECEIVED_BY_TECHNICIAN":
        return { 
          label: t('verification.technician_1'), 
          color: "bg-emerald-100 text-emerald-900 border-emerald-300 shadow-xs",
          icon: User
        };
      case "DELIVERED":
        return { 
          label: t('verification.completed_2'), 
          color: "bg-teal-100 text-teal-900 border-teal-300 shadow-xs",
          icon: PackageCheck
        };
      case "PENDING_RECEIPT":
      case "PENDING_ACCEPTANCE":
        return { 
          label: t('verification.pending_technician'), 
          color: "bg-amber-100 text-amber-900 border-amber-300 shadow-xs",
          icon: Clock
        };
      case "RETURNED":
        return { 
          label: t('verification.returned'), 
          color: "bg-rose-100 text-rose-900 border-rose-300 shadow-xs",
          icon: RotateCcw
        };
      case "WAREHOUSE":
        return {
          label: "موجود بالمستودع",
          color: "bg-blue-100 text-blue-900 border-blue-300 shadow-xs",
          icon: Building2
        };
      default:
        return { 
          label: status || t('verification.item_11173'), 
          color: "bg-slate-100 text-slate-800 border-slate-300 shadow-xs",
          icon: AlertCircle
        };
    }
  };

  // Helper to format date & time with hours, minutes and seconds
  const formatFullDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "غير متوفر";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("ar-SA", {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const cat = getCategoryDetails(itemData?.itemTypeCategory);
  const IconComponent = cat.icon;
  const statusDetails = getStatusDetails(itemData?.status);
  const StatusIcon = statusDetails.icon;

  const techName = itemData?.technicianName || itemData?.ownerName;
  const techId = itemData?.technicianId || itemData?.ownerId;
  const techUsername = itemData?.technicianUsername;
  const techPhone = itemData?.technicianPhone;
  const techCity = itemData?.technicianCity || itemData?.ownerCity;
  const techRegion = itemData?.technicianRegionName || itemData?.ownerRegionName;
  const techAvatar = itemData?.technicianProfileImage;

  return (
    <div className="space-y-8 font-['Cairo'] pb-16" dir="rtl">
      {/* Top Banner Header */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-800 p-8 text-white shadow-xl shadow-teal-900/10">
        <div className="absolute -left-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-teal-100 border border-white/20">
              <ShieldCheck className="w-4 h-4 text-cyan-300" />
              <span>محرك التدقيق الشامل وتتبع حركة العهد والأجهزة</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <QrCode className="w-8 h-8 text-cyan-300 animate-pulse" />
              {t('verification.verification_number_serial')}
            </h1>
            <p className="text-teal-50 text-sm max-w-xl opacity-90 leading-relaxed">
              {t('verification.search_status_devices')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/home">
              <Button variant="outline" className="bg-white/15 hover:bg-white/25 text-white border-white/25 backdrop-blur-md transition-all font-bold rounded-2xl shadow-sm">
                <ArrowRight className="ml-2 h-4 w-4" />
                {t('verification.control')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Search & Scan Panel (4 Columns) */}
        <Card className="lg:col-span-4 bg-white/85 backdrop-blur-xl border border-slate-200/80 shadow-lg shadow-slate-200/50 rounded-3xl overflow-hidden hover:border-teal-500/30 transition-all flex flex-col justify-between">
          <div>
            <CardHeader className="bg-gradient-to-b from-teal-50/80 to-transparent border-b border-slate-100 pb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 flex items-center justify-center shadow-inner">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-slate-900 text-lg font-bold">
                    {t('verification.scan')}
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-xs mt-0.5">
                    {t('verification.sim_number_serial')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>الرقم التسلسلي / S/N</span>
                    <span className="text-slate-400 font-normal">جميع الأجهزة والشرائح</span>
                  </label>
                  <div className="relative">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      ref={inputRef}
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      placeholder={t('verification.number_serial_3')}
                      className="pr-11 pl-4 h-12 rassco-input-glow rounded-2xl font-mono text-center text-slate-800 text-base placeholder:text-slate-400 placeholder:font-sans font-bold shadow-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button 
                    type="submit" 
                    className="flex-1 h-11 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 transition-all active:scale-[0.98]"
                  >
                    <Search className="w-4 h-4 ml-2" />
                    {t('verification.search')}
                  </Button>
                  {(scanValue || serialQuery) && (
                    <Button 
                      type="button" 
                      onClick={handleClear} 
                      variant="outline" 
                      className="h-11 px-4 border-slate-200 text-slate-600 hover:bg-slate-100 font-bold rounded-xl"
                    >
                      {t('verification.scan_1')}
                    </Button>
                  )}
                </div>
              </form>

              {/* Quick Sample Buttons */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>نماذج سريعة للاختبار:</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleQuickScan("SAW43310018885")}
                    className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-300 transition-all font-semibold text-slate-700"
                  >
                    i9100: SAW43310018885
                  </button>
                  <button
                    onClick={() => handleQuickScan("SAS30810004647")}
                    className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-300 transition-all font-semibold text-slate-700"
                  >
                    i9000S: SAS30810004647
                  </button>
                  <button
                    onClick={() => handleQuickScan("1180234360")}
                    className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-300 transition-all font-semibold text-slate-700"
                  >
                    A960: 1180234360
                  </button>
                </div>
              </div>
            </CardContent>
          </div>

          <CardFooter className="bg-slate-50/80 border-t border-slate-100 p-4 text-xs text-slate-500 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="leading-tight">{t('verification.scan_stickers_devices_mobily_z')}</span>
          </CardFooter>
        </Card>

        {/* Results Panel (8 Columns) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Loading State */}
          {isLoading && (
            <Card className="bg-white/85 backdrop-blur-xl border border-slate-200/80 shadow-lg shadow-slate-200/50 rounded-3xl h-full min-h-[420px] flex items-center justify-center p-12">
              <div className="text-center space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-600 rounded-full animate-spin" />
                  <QrCode className="w-6 h-6 text-teal-600 absolute inset-0 m-auto" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-800">{t('verification.search_data')}</h4>
                  <p className="text-slate-400 text-xs font-mono">{serialQuery}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Initial / Empty State */}
          {!serialQuery && !isLoading && (
            <Card className="bg-white/60 backdrop-blur-md border border-dashed border-slate-300/80 shadow-sm rounded-3xl h-full min-h-[420px] flex items-center justify-center p-12 text-center">
              <div className="max-w-md space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-teal-50 border border-teal-100 text-teal-600 mx-auto flex items-center justify-center shadow-inner">
                  <QrCode className="w-10 h-10 stroke-[1.5] animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">{t('verification.scan_number_serial')}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {t('verification.submit_number_search_details')}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>عرض تلقائي لبيانات الفني المسند ومسؤول الإغلاق والتاريخ والتأطير</span>
                </div>
              </div>
            </Card>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <Card className="bg-white/85 backdrop-blur-xl border border-rose-200 shadow-lg shadow-rose-500/5 rounded-3xl h-full min-h-[420px] flex items-center justify-center p-12 text-center">
              <div className="max-w-md space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 text-rose-500 mx-auto flex items-center justify-center shadow-inner">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900">{t('verification.fail_data')}</h3>
                  <p className="text-rose-600 text-sm font-semibold">{(error as any)?.message || t('verification.error')}</p>
                </div>
                <Button onClick={handleClear} variant="outline" className="border-slate-200 text-slate-700 font-bold rounded-xl mt-2">
                  إعادة المحاولة
                </Button>
              </div>
            </Card>
          )}

          {/* Success / Item Loaded State */}
          {itemData && !isLoading && (
            <>
              <Card className="bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden transition-all">
                {/* Item Header */}
                <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 md:p-8 text-white relative">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 text-teal-300 flex items-center justify-center shrink-0 backdrop-blur-md shadow-inner">
                        <IconComponent className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className={`${cat.badgeBg} font-bold text-xs px-2.5 py-0.5`}>
                            {cat.label}
                          </Badge>
                          {itemData.carrierName && (
                            <Badge className="bg-purple-500/20 text-purple-200 border border-purple-400/30 text-xs font-bold">
                              {itemData.carrierName}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight text-white">
                          {itemData.itemTypeName || t('verification.item_17641')}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-slate-300 text-sm pt-0.5">
                          <span>S/N:</span>
                          <span className="font-mono text-cyan-300 font-bold text-base bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/15">
                            {itemData.serialNumber}
                          </span>
                          <button
                            onClick={() => copySerialToClipboard(itemData.serialNumber)}
                            className="p-1.5 hover:bg-white/15 rounded-lg text-slate-300 hover:text-white transition-all"
                            title="نسخ الرقم التسلسلي"
                          >
                            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <Badge className={`${statusDetails.color} text-sm font-extrabold px-4 py-2 rounded-2xl flex items-center gap-2 border self-start sm:self-auto`}>
                      <StatusIcon className="w-4 h-4" />
                      <span>{statusDetails.label}</span>
                    </Badge>
                  </div>
                </CardHeader>

                {/* Section 1: Detailed Technician / Custody Info */}
                <CardContent className="p-6 md:p-8 space-y-6">
                  <div className="border border-teal-500/25 rounded-2xl bg-gradient-to-b from-teal-500/5 via-slate-50/50 to-white p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-teal-500/15 pb-3">
                      <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-teal-600" />
                        <span>بيانات الفني المسند / صاحب العهدة الحالي</span>
                      </h4>
                      {techId && (
                        <Link href={`/technician-details/${techId}`}>
                          <span className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1">
                            <span>عرض سجل الفني الكامل</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </span>
                        </Link>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Tech Profile & Name */}
                      <div className="flex items-center gap-3.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <Avatar className="h-12 w-12 border-2 border-teal-500/30 shrink-0 shadow-xs">
                          <AvatarImage src={techAvatar || undefined} alt={techName || "Fani"} />
                          <AvatarFallback className="bg-teal-600 text-white font-bold text-sm">
                            {techName ? techName.slice(0, 2) : "فني"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-400">اسم الفني والمستخدم</p>
                          <p className="text-sm font-extrabold text-slate-900 truncate mt-0.5">
                            {techName || "المستودع الرئيسي / لم يُسند"}
                          </p>
                          {techUsername && (
                            <p className="text-xs font-mono text-teal-700 font-semibold flex items-center gap-1 mt-0.5">
                              <AtSign className="w-3 h-3 text-teal-500" />
                              <span>{techUsername}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Tech Phone & Contact */}
                      <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                            <Phone className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400">رقم التواصل / الهاتف</p>
                            <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                              {techPhone || "غير مسجل"}
                            </p>
                          </div>
                        </div>
                        {techPhone && (
                          <div className="flex items-center gap-1">
                            <a
                              href={`tel:${techPhone}`}
                              className="p-2 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 rounded-lg transition-all"
                              title="اتصال تلفوني"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                            <a
                              href={`https://wa.me/${techPhone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-all"
                              title="مراسلة واتساب"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* City */}
                      <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400">المدينة</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">
                            {techCity || "غير محددة"}
                          </p>
                        </div>
                      </div>

                      {/* Region */}
                      <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400">المنطقة والفرع</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">
                            {techRegion || "غير محددة"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Closing Admin / Responsible Person details */}
                  {(itemData.status === "DELIVERED" || itemData.closedByName || itemData.deliveredAt) && (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-teal-50 border border-teal-500/25 space-y-4 shadow-xs">
                      <div className="flex items-center justify-between border-b border-teal-500/20 pb-3">
                        <p className="text-sm font-extrabold text-teal-950 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-teal-600" />
                          <span>بيانات المسؤول عن عملية الإغلاق أو الاستلام والتاريخ والوقت بالكامل</span>
                        </p>
                        <Badge className="bg-teal-600 text-white text-xs font-bold px-2.5 py-0.5">
                          عملية مكتملة
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Admin Info */}
                        <div className="flex items-center gap-3.5 bg-white/90 p-3.5 rounded-xl border border-teal-500/20 shadow-2xs">
                          <Avatar className="h-12 w-12 border-2 border-teal-600/40 shrink-0">
                            <AvatarImage src={itemData.closedByProfileImage || undefined} alt={itemData.closedByName || "Admin"} />
                            <AvatarFallback className="bg-teal-800 text-white font-bold text-sm">
                              {itemData.closedByName ? itemData.closedByName.slice(0, 2) : "أدمن"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-400">مسؤول الإغلاق / الأكشن</p>
                            <p className="text-sm font-extrabold text-slate-900 truncate mt-0.5">
                              {itemData.closedByName || "مشرف النظام الإداري"}
                            </p>
                            {itemData.closedByUsername && (
                              <p className="text-xs font-mono text-teal-700 font-semibold flex items-center gap-1 mt-0.5">
                                <AtSign className="w-3 h-3 text-teal-500" />
                                <span>{itemData.closedByUsername}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Exact Timestamp */}
                        <div className="bg-white/90 p-3.5 rounded-xl border border-teal-500/20 shadow-2xs space-y-1">
                          <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-teal-600" />
                            <span>الوقت والتاريخ الدقيق للعملية (بالساعة والدقيقة والثانية)</span>
                          </p>
                          <p className="text-sm font-bold text-teal-900 font-mono pt-0.5">
                            {formatFullDateTime(itemData.deliveredAt || itemData.updatedAt)}
                          </p>
                          {itemData.orderNumber && (
                            <p className="text-xs font-bold text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                              <span>رقم الطلب / المرجع:</span>
                              <span className="font-mono text-teal-700 font-extrabold">{itemData.orderNumber}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section 3: Status History / Lifecycle Audit Sequence Timeline */}
                  {itemData.historyLogs && itemData.historyLogs.length > 0 && (
                    <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-4 shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                          <GitCommit className="w-4 h-4 text-teal-600" />
                          <span>تسلسل وتاريخ حالات الجهاز (Lifecycle Audit Sequence)</span>
                        </h4>
                        <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-xs font-mono font-bold">
                          {itemData.historyLogs.length} حركة مسجلة
                        </Badge>
                      </div>

                      <div className="relative pr-4 border-r-2 border-teal-500/30 space-y-6 pt-2">
                        {itemData.historyLogs.map((log) => {
                          const toStatusDetail = getStatusDetails(log.toStatus);
                          const fromStatusDetail = getStatusDetails(log.fromStatus);
                          const StatusIconLocal = toStatusDetail.icon;

                          return (
                            <div key={log.id} className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                              {/* Dot on line */}
                              <div className="absolute -right-[23px] top-5 w-3.5 h-3.5 rounded-full bg-teal-500 border-2 border-white ring-2 ring-teal-500/20" />

                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className={`${fromStatusDetail.color} text-xs px-2 py-0.5`}>
                                    {fromStatusDetail.label}
                                  </Badge>
                                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                                  <Badge className={`${toStatusDetail.color} text-xs font-bold px-2.5 py-0.5 flex items-center gap-1`}>
                                    <StatusIconLocal className="w-3 h-3" />
                                    <span>{toStatusDetail.label}</span>
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-2 pt-0.5">
                                  <Avatar className="h-6 w-6 border border-slate-200">
                                    <AvatarImage src={log.changedByProfileImage || undefined} />
                                    <AvatarFallback className="bg-teal-700 text-white text-[10px] font-bold">
                                      {log.changedByName ? log.changedByName.slice(0, 1) : "م"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-bold text-slate-800">{log.changedByName}</span>
                                  {log.changedByUsername && (
                                    <span className="text-[11px] font-mono text-slate-400">(@{log.changedByUsername})</span>
                                  )}
                                </div>

                                {log.notes && (
                                  <p className="text-xs text-slate-600 italic bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                    {log.notes}
                                  </p>
                                )}
                              </div>

                              <div className="text-left sm:text-right shrink-0">
                                <p className="text-xs font-mono font-bold text-slate-600 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{formatFullDateTime(log.changedAt)}</span>
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>

                {/* Status Update Actions */}
                <CardFooter className="bg-slate-50/90 border-t border-slate-200/80 p-6 flex flex-col sm:flex-row gap-3">
                  {itemData.status === "RECEIVED_BY_TECHNICIAN" ? (
                    <Button
                      onClick={() => updateStatusMutation.mutate({ status: "DELIVERED" })}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 h-12 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-extrabold text-base rounded-xl shadow-md shadow-teal-600/20 active:scale-[0.98] transition-all"
                    >
                      {updateStatusMutation.isPending ? t('verification.save') : t('verification.device_close_request')}
                    </Button>
                  ) : itemData.status === "DELIVERED" ? (
                    <Button
                      onClick={() => updateStatusMutation.mutate({ status: "RECEIVED_BY_TECHNICIAN" })}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-base rounded-xl shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all"
                    >
                      {updateStatusMutation.isPending ? t('verification.save') : t('verification.item_28690')}
                    </Button>
                  ) : null}

                  {itemData.status !== "RETURNED" && (
                    <Button
                      onClick={() => updateStatusMutation.mutate({ status: "RETURNED" })}
                      disabled={updateStatusMutation.isPending}
                      variant="outline"
                      className="h-12 px-6 border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-700 font-extrabold rounded-xl transition-all"
                    >
                      {t('verification.primary')}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
