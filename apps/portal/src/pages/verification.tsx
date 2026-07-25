import { useTranslation } from "@/lib/language";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  ChevronLeft,
  Filter,
  ArrowUpDown,
  FileCheck,
  Info,
  ExternalLink,
  Layers,
  Cpu,
  Mail,
  Briefcase,
  Hash,
  Globe,
  Monitor
} from "lucide-react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface UnifiedAssetTrackingData {
  asset: {
    id: string;
    serialNumber: string;
    barcode: string;
    status: string;
    statusLabel: string;
    statusColor: string;
    itemTypeId: string | null;
    itemTypeName: string | null;
    category: string | null;
    carrierName: string | null;
    createdAt: string;
    updatedAt: string | null;
  };
  currentCustodian: {
    id: string;
    fullName: string;
    username: string;
    employeeCode: string | null;
    jobTitle: string | null;
    avatarUrl: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    regionName: string | null;
    warehouseName: string | null;
    isActive: boolean;
    receivedAt: string | null;
    custodyDurationDays: number;
    lastLocation: string | null;
  } | null;
  lastActionBy: {
    id: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    role: string;
    roleLabel: string;
    department: string | null;
    regionName: string | null;
    actionType: string;
    actionLabel: string;
    occurredAt: string;
    actionNumber: string;
    notes: string | null;
  } | null;
  closure: {
    isClosed: boolean;
    status: string;
    statusLabel: string;
    closedAt: string | null;
    closedById: string | null;
    closedByName: string | null;
    closedByUsername: string | null;
    closedByAvatarUrl: string | null;
    closedByRole: string | null;
    orderNumber: string | null;
    clientName: string | null;
    clientNumber: string | null;
    notes: string | null;
    durationFromIntakeDays: number | null;
  } | null;
  linkedIdentifiers: Array<{
    type: string;
    serialNumber: string;
    carrierName?: string | null;
    linkedAt?: string | null;
    linkedBy?: string | null;
  }>;
  summary: {
    currentStatusLabel: string;
    statusColor: string;
    custodianName: string;
    locationName: string;
    lastUpdatedHuman: string;
    totalMovements: number;
    lastActionName: string;
    lastActorName: string;
  };
  timeline: Array<{
    eventId: string;
    eventType: string;
    eventLabel: string;
    title: string;
    description: string | null;
    statusFrom: string;
    statusFromLabel: string;
    statusTo: string;
    statusToLabel: string;
    statusColor: string;
    actor: {
      id: string;
      name: string;
      username: string;
      avatarUrl: string | null;
      role: string;
    };
    technician?: {
      id: string;
      name: string;
    } | null;
    warehouse?: {
      name: string;
    } | null;
    region?: {
      name: string;
    } | null;
    occurredAt: string;
    location?: {
      name: string;
    } | null;
    referenceId?: string | null;
    notes?: string | null;
    metadata?: Record<string, any>;
  }>;
}

export default function VerificationPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scanValue, setScanValue] = useState("");
  const [serialQuery, setSerialQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [timelineFilter, setTimelineFilter] = useState<string>("ALL");
  const [selectedEvent, setSelectedEvent] = useState<UnifiedAssetTrackingData["timeline"][0] | null>(null);
  const [selectedUserModal, setSelectedUserModal] = useState<{ id: string; name: string; username: string; avatar?: string | null; role?: string } | null>(null);
  const [visibleTimelineCount, setVisibleTimelineCount] = useState(10);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data: trackingData, error, isLoading, refetch } = useQuery<UnifiedAssetTrackingData>({
    queryKey: [`/api/verification/assets/${serialQuery}`],
    enabled: !!serialQuery,
    retry: false,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      if (!trackingData?.asset?.id) return;
      const res = await apiRequest("PATCH", `/api/items/${trackingData.asset.id}/status`, {
        status,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم تحديث حالة الأصل بنجاح",
        description: "تحديث شريط التتبع وإضافة حركة جديدة بالسجل.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/verification/assets/${serialQuery}`] });
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
    setVisibleTimelineCount(10);
  };

  const handleQuickScan = (sampleSerial: string) => {
    setScanValue(sampleSerial);
    setSerialQuery(sampleSerial);
    setVisibleTimelineCount(10);
  };

  const handleClear = () => {
    setScanValue("");
    setSerialQuery("");
    setSelectedEvent(null);
    inputRef.current?.focus();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "تم النسخ بنجاح",
      description: text,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // Status Styling Resolver
  const resolveStatusBadge = (colorKey?: string) => {
    switch (colorKey) {
      case "green":
        return "bg-emerald-100 text-emerald-900 border-emerald-300 shadow-xs";
      case "teal":
        return "bg-teal-100 text-teal-900 border-teal-300 shadow-xs";
      case "blue":
        return "bg-blue-100 text-blue-900 border-blue-300 shadow-xs";
      case "orange":
        return "bg-amber-100 text-amber-900 border-amber-300 shadow-xs";
      case "red":
        return "bg-rose-100 text-rose-900 border-rose-300 shadow-xs";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300 shadow-xs";
    }
  };

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

  // Filter & Sort Timeline
  const filteredTimeline = (trackingData?.timeline || []).filter((item) => {
    if (timelineFilter === "ALL") return true;
    if (timelineFilter === "CLOSING") return item.eventType === "CLOSING";
    if (timelineFilter === "CUSTODY") return item.eventType === "CUSTODY";
    if (timelineFilter === "INTAKE") return item.eventType === "INTAKE";
    if (timelineFilter === "RETURN") return item.eventType === "RETURN";
    return true;
  }).sort((a, b) => {
    const timeA = new Date(a.occurredAt).getTime();
    const timeB = new Date(b.occurredAt).getTime();
    return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
  });

  const displayedTimeline = filteredTimeline.slice(0, visibleTimelineCount);

  return (
    <div className="space-y-8 font-['Cairo'] pb-20" dir="rtl">
      {/* Top Banner Header */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 via-cyan-800 to-slate-900 p-8 text-white shadow-xl shadow-teal-950/20">
        <div className="absolute -left-12 -top-12 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-16 h-48 w-48 rounded-full bg-teal-400/20 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-cyan-200 border border-white/20">
              <Activity className="w-4 h-4 text-cyan-300 animate-pulse" />
              <span>STOCKPRO — نظام تتبع رحلة الأصل والدورة الحياتية الميدانية</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <QrCode className="w-8 h-8 text-cyan-300" />
              بوابة تتبع ودورة حياة الرقم التسلسلي
            </h1>
            <p className="text-teal-100 text-sm max-w-2xl opacity-95 leading-relaxed">
              استعلام وتتبع كامل للأجهزة، الباركودات، وشرائح SIM الميدانية مع سجل شفاف يوضح المسند إليه ومسؤول الأكشن والتوقيت بدقة.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/home">
              <Button variant="outline" className="bg-white/15 hover:bg-white/25 text-white border-white/25 backdrop-blur-md transition-all font-bold rounded-2xl shadow-sm">
                <ArrowRight className="ml-2 h-4 w-4" />
                لوحة التحكم الرئيسية
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Search Panel (4 Columns) */}
        <Card className="lg:col-span-4 bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-lg shadow-slate-200/50 rounded-3xl overflow-hidden flex flex-col justify-between self-start">
          <div>
            <CardHeader className="bg-gradient-to-b from-teal-50/90 to-transparent border-b border-slate-100 pb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-700 flex items-center justify-center shadow-inner">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-slate-900 text-lg font-bold">
                    البحث عن أصل أو شريحة
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-xs mt-0.5">
                    أدخل السيريال (S/N) أو IMEI أو ICCID أو الباركود
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>الرقم التسلسلي المعرف / Asset ID</span>
                    <span className="text-slate-400 font-normal">تأطير تلقائي للبادئة</span>
                  </label>
                  <div className="relative">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      ref={inputRef}
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      placeholder="مثال: SAW43310018885"
                      className="pr-11 pl-4 h-12 rassco-input-glow rounded-2xl font-mono text-center text-slate-800 text-base placeholder:text-slate-400 font-bold shadow-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button 
                    type="submit" 
                    className="flex-1 h-11 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 transition-all active:scale-[0.98]"
                  >
                    <Search className="w-4 h-4 ml-2" />
                    بدء التتبع
                  </Button>
                  {(scanValue || serialQuery) && (
                    <Button 
                      type="button" 
                      onClick={handleClear} 
                      variant="outline" 
                      className="h-11 px-4 border-slate-200 text-slate-600 hover:bg-slate-100 font-bold rounded-xl"
                    >
                      تفريغ
                    </Button>
                  )}
                </div>
              </form>

              {/* Quick Sample Buttons */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>نماذج سريعة للاختبار الفوري:</span>
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
            <span className="leading-tight">تكامل تلقائي للتدقيق الأمني والصلاحيات الميدانية</span>
          </CardFooter>
        </Card>

        {/* Tracking Results Area (8 Columns) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Skeleton / Loading State */}
          {isLoading && (
            <Card className="bg-white/85 backdrop-blur-xl border border-slate-200/80 shadow-lg shadow-slate-200/50 rounded-3xl h-full min-h-[420px] flex items-center justify-center p-12">
              <div className="text-center space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-600 rounded-full animate-spin" />
                  <QrCode className="w-6 h-6 text-teal-600 absolute inset-0 m-auto" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-800">جاري تجميع رحلة الأصل والسجل...</h4>
                  <p className="text-slate-400 text-xs font-mono">{serialQuery}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Initial State */}
          {!serialQuery && !isLoading && (
            <Card className="bg-white/60 backdrop-blur-md border border-dashed border-slate-300/80 shadow-sm rounded-3xl h-full min-h-[420px] flex items-center justify-center p-12 text-center">
              <div className="max-w-md space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-teal-50 border border-teal-100 text-teal-600 mx-auto flex items-center justify-center shadow-inner">
                  <QrCode className="w-10 h-10 stroke-[1.5] animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">امسح الباركود أو ادخل الرقم التسلسلي</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    سيتم بناء جدول تتبع زمني حديث يعرض صاحب العهدة الحالي ومسؤول الإغلاق مع كامل حركات السجل التاريخي.
                  </p>
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
                  <h3 className="text-xl font-bold text-slate-900">تعذر العثور على الأصل</h3>
                  <p className="text-rose-600 text-sm font-semibold">{(error as any)?.message || t('verification.error')}</p>
                </div>
                <Button onClick={handleClear} variant="outline" className="border-slate-200 text-slate-700 font-bold rounded-xl mt-2">
                  إعادة المحاولة
                </Button>
              </div>
            </Card>
          )}

          {/* Result Loaded */}
          {trackingData && !isLoading && (
            <div className="space-y-6">
              {/* 1. Summary Header Card (بطاقة ملخص رحلة الجهاز) */}
              <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Badge className={`${resolveStatusBadge(trackingData.asset.statusColor)} text-sm font-extrabold px-3.5 py-1 rounded-xl`}>
                        {trackingData.asset.statusLabel}
                      </Badge>
                      {trackingData.asset.carrierName && (
                        <Badge className="bg-purple-500/20 text-purple-200 border border-purple-400/30 text-xs font-bold">
                          {trackingData.asset.carrierName}
                        </Badge>
                      )}
                    </div>

                    <h2 className="text-2xl font-extrabold text-white pt-1">
                      {trackingData.asset.itemTypeName}
                    </h2>

                    <div className="flex items-center gap-3 text-slate-300 text-sm font-mono pt-1">
                      <span>S/N:</span>
                      <span className="text-cyan-300 font-bold text-base bg-white/10 px-3 py-1 rounded-xl border border-white/15">
                        {trackingData.asset.serialNumber}
                      </span>
                      <button
                        onClick={() => copyToClipboard(trackingData.asset.serialNumber)}
                        className="p-1.5 hover:bg-white/15 rounded-lg text-slate-300 hover:text-white transition-all"
                        title="نسخ الرقم التسلسلي"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-white/10">
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15 text-center">
                      <p className="text-[11px] text-slate-400 font-bold">صاحب العهدة</p>
                      <p className="text-xs font-bold text-white truncate mt-0.5">{trackingData.summary.custodianName}</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15 text-center">
                      <p className="text-[11px] text-slate-400 font-bold">الموقع والحركة</p>
                      <p className="text-xs font-bold text-cyan-300 truncate mt-0.5">{trackingData.summary.locationName}</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15 text-center col-span-2 sm:col-span-1">
                      <p className="text-[11px] text-slate-400 font-bold">إجمالي الحركات</p>
                      <p className="text-xs font-bold text-emerald-300 mt-0.5">{trackingData.summary.totalMovements} حركات مسجلة</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 2. Current Custodian Card (بطاقة صاحب العهدة الحالي) */}
              {trackingData.currentCustodian && (
                <Card className="bg-white/90 backdrop-blur-xl border border-teal-500/30 shadow-lg rounded-3xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-teal-500/10 via-slate-50 to-white border-b border-teal-500/15 p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-teal-600" />
                        <span>بيانات صاحب العهدة الحالي</span>
                      </h3>
                      <button
                        onClick={() => setSelectedUserModal({
                          id: trackingData.currentCustodian!.id,
                          name: trackingData.currentCustodian!.fullName,
                          username: trackingData.currentCustodian!.username,
                          avatar: trackingData.currentCustodian!.avatarUrl,
                          role: "فني ميداني",
                        })}
                        className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
                      >
                        <span>عرض الملف الكامل</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <Avatar className="h-16 w-16 border-2 border-teal-600 shrink-0 shadow-md">
                        <AvatarImage src={trackingData.currentCustodian.avatarUrl || undefined} alt={trackingData.currentCustodian.fullName} />
                        <AvatarFallback className="bg-teal-700 text-white font-bold text-lg">
                          {trackingData.currentCustodian.fullName.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-extrabold text-slate-900">{trackingData.currentCustodian.fullName}</h4>
                          <Badge className="bg-teal-100 text-teal-800 border-teal-300 text-xs">
                            {trackingData.currentCustodian.jobTitle}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span className="font-mono text-teal-700 font-bold flex items-center gap-1">
                            <AtSign className="w-3 h-3 text-teal-500" />
                            {trackingData.currentCustodian.username}
                          </span>
                          {trackingData.currentCustodian.employeeCode && (
                            <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono">
                              كود: {trackingData.currentCustodian.employeeCode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Call & WhatsApp actions */}
                      {trackingData.currentCustodian.phone && (
                        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                          <a
                            href={`tel:${trackingData.currentCustodian.phone}`}
                            className="p-2.5 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center gap-1 text-xs font-bold"
                            title="اتصال تلفوني"
                          >
                            <Phone className="w-4 h-4 text-teal-600" />
                            <span>اتصال</span>
                          </a>
                          <a
                            href={`https://wa.me/${trackingData.currentCustodian.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200 shadow-2xs transition-all flex items-center gap-1 text-xs font-bold"
                            title="مراسلة واتساب"
                          >
                            <MessageCircle className="w-4 h-4 text-emerald-600" />
                            <span>واتساب</span>
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <p className="text-slate-400 font-bold">المنطقة والمدينة</p>
                        <p className="text-slate-900 font-bold mt-0.5">{trackingData.currentCustodian.regionName} — {trackingData.currentCustodian.city}</p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <p className="text-slate-400 font-bold">المستودع التابع له</p>
                        <p className="text-slate-900 font-bold mt-0.5">{trackingData.currentCustodian.warehouseName}</p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <p className="text-slate-400 font-bold">تاريخ الاستلام</p>
                        <p className="text-slate-900 font-mono font-bold mt-0.5">{formatFullDateTime(trackingData.currentCustodian.receivedAt)}</p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <p className="text-slate-400 font-bold">مدة وجود العهدة</p>
                        <p className="text-teal-700 font-extrabold mt-0.5">{trackingData.currentCustodian.custodyDurationDays} أيام متواصلة</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 3. Last Action Responsible Card (بطاقة المسؤول عن آخر إجراء) */}
              {trackingData.lastActionBy && (
                <Card className="bg-white/90 backdrop-blur-xl border border-slate-200 shadow-lg rounded-3xl overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-teal-600" />
                        <span>المسؤول عن آخر إجراء</span>
                      </h3>
                      <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-xs font-mono font-bold">
                        {trackingData.lastActionBy.actionNumber}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                      <Avatar className="h-14 w-14 border-2 border-cyan-600 shrink-0">
                        <AvatarImage src={trackingData.lastActionBy.avatarUrl || undefined} alt={trackingData.lastActionBy.fullName} />
                        <AvatarFallback className="bg-cyan-800 text-white font-bold">
                          {trackingData.lastActionBy.fullName.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-extrabold text-slate-900 truncate">{trackingData.lastActionBy.fullName}</h4>
                          <Badge className="bg-cyan-100 text-cyan-900 border-cyan-300 text-xs">
                            {trackingData.lastActionBy.roleLabel}
                          </Badge>
                        </div>
                        <p className="text-xs font-mono text-cyan-700 font-bold flex items-center gap-1">
                          <AtSign className="w-3 h-3 text-cyan-500" />
                          {trackingData.lastActionBy.username}
                        </p>
                      </div>

                      <div className="text-left shrink-0">
                        <p className="text-xs font-mono font-bold text-slate-700">{formatFullDateTime(trackingData.lastActionBy.occurredAt)}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{trackingData.lastActionBy.regionName}</p>
                      </div>
                    </div>

                    {trackingData.lastActionBy.notes && (
                      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 italic">
                        ملاحظات العملية: {trackingData.lastActionBy.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 4. Closure Details Card (بطاقة بيانات الإغلاق) */}
              {trackingData.closure?.isClosed && (
                <Card className="bg-gradient-to-br from-emerald-500/10 via-teal-50 to-white border border-emerald-500/30 shadow-lg rounded-3xl overflow-hidden">
                  <CardHeader className="bg-emerald-500/15 border-b border-emerald-500/20 p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-emerald-600" />
                        <span>بيانات وتوثيق الإغلاق النهائي</span>
                      </h3>
                      <Badge className="bg-emerald-600 text-white font-extrabold px-3 py-1 text-xs">
                        عملية مكتملة ومغلقة
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="bg-white p-3.5 rounded-xl border border-emerald-500/20 space-y-1">
                        <p className="text-slate-400 font-bold">تاريخ وساعة الإغلاق</p>
                        <p className="text-slate-900 font-mono font-extrabold">{formatFullDateTime(trackingData.closure.closedAt)}</p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-emerald-500/20 space-y-1">
                        <p className="text-slate-400 font-bold">المسؤول عن الإغلاق</p>
                        <p className="text-slate-900 font-bold">{trackingData.closure.closedByName} (@{trackingData.closure.closedByUsername})</p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-emerald-500/20 space-y-1">
                        <p className="text-slate-400 font-bold">رقم الطلب والعميل</p>
                        <p className="text-emerald-800 font-mono font-extrabold">{trackingData.closure.orderNumber} — {trackingData.closure.clientName}</p>
                      </div>
                    </div>

                    {trackingData.closure.notes && (
                      <div className="p-3 bg-white border border-emerald-500/20 rounded-xl text-xs text-slate-700">
                        <span className="font-bold text-emerald-900">ملاحظات التوثيق: </span>
                        {trackingData.closure.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 5. Linked Identifiers (الأصول المرتبطة) */}
              {trackingData.linkedIdentifiers.length > 0 && (
                <Card className="bg-white/90 backdrop-blur-xl border border-purple-200 shadow-md rounded-3xl overflow-hidden">
                  <CardHeader className="bg-purple-50/80 border-b border-purple-100 p-5">
                    <h3 className="text-base font-extrabold text-purple-950 flex items-center gap-2">
                      <Handshake className="w-5 h-5 text-purple-600" />
                      <span>الأصول وشرائح الاتصالات المرتبطة</span>
                    </h3>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3">
                    {trackingData.linkedIdentifiers.map((link, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-purple-50/40 p-4 rounded-2xl border border-purple-200">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-purple-900">{link.type} ({link.carrierName})</p>
                          <p className="text-sm font-mono font-extrabold text-purple-950">{link.serialNumber}</p>
                        </div>
                        <Button
                          onClick={() => handleQuickScan(link.serialNumber)}
                          variant="outline"
                          className="border-purple-300 text-purple-800 hover:bg-purple-100 text-xs font-bold rounded-xl"
                        >
                          تتبع الشريحة
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 6. Advanced Shipment-Style Audit Timeline (التسلسل الزمني الحديث) */}
              <Card className="bg-white/90 backdrop-blur-xl border border-slate-200 shadow-xl rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-200 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <GitCommit className="w-5 h-5 text-teal-600" />
                        <span>رحلة الأصل والتسلسل الزمني للعمليات</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-1">
                        انقر على أي حدث لعرض التوثيق الفني الكامل والأجهزة ومصدر الأكشن
                      </CardDescription>
                    </div>

                    {/* Filter and Sort Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                        variant="outline"
                        className="h-9 text-xs font-bold border-slate-200 rounded-xl flex items-center gap-1.5"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        <span>{sortOrder === "desc" ? "الأحدث أولاً" : "الأقدم أولاً"}</span>
                      </Button>

                      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                        <button
                          onClick={() => setTimelineFilter("ALL")}
                          className={`px-2.5 py-1 rounded-lg transition-all ${timelineFilter === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"}`}
                        >
                          الكل
                        </button>
                        <button
                          onClick={() => setTimelineFilter("CUSTODY")}
                          className={`px-2.5 py-1 rounded-lg transition-all ${timelineFilter === "CUSTODY" ? "bg-white text-teal-700 shadow-2xs" : "text-slate-500"}`}
                        >
                          العهدة
                        </button>
                        <button
                          onClick={() => setTimelineFilter("CLOSING")}
                          className={`px-2.5 py-1 rounded-lg transition-all ${timelineFilter === "CLOSING" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-500"}`}
                        >
                          الإغلاق
                        </button>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 md:p-8">
                  <div className="relative pr-6 border-r-2 border-teal-500/30 space-y-8">
                    {displayedTimeline.map((item, index) => {
                      const isLatest = index === 0 && sortOrder === "desc";

                      return (
                        <div
                          key={item.eventId}
                          onClick={() => setSelectedEvent(item)}
                          className={`relative group bg-slate-50/80 hover:bg-teal-50/60 p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
                            isLatest ? "border-teal-500/50 ring-2 ring-teal-500/20" : "border-slate-200 hover:border-teal-300"
                          }`}
                        >
                          {/* Circle on line */}
                          <div className={`absolute -right-[31px] top-6 w-4 h-4 rounded-full border-2 border-white ring-4 transition-all ${
                            isLatest ? "bg-teal-600 ring-teal-500/30 animate-pulse" : "bg-slate-400 ring-slate-200 group-hover:bg-teal-500"
                          }`} />

                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <Badge className={`${resolveStatusBadge(item.statusColor)} text-xs font-bold px-2.5 py-0.5`}>
                                  {item.statusToLabel}
                                </Badge>
                                <span className="text-xs font-extrabold text-slate-800">{item.title}</span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                  <Avatar className="h-5 w-5 border border-slate-300">
                                    <AvatarImage src={item.actor.avatarUrl || undefined} />
                                    <AvatarFallback className="bg-slate-700 text-white text-[9px]">
                                      {item.actor.name.slice(0, 1)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{item.actor.name}</span>
                                  <span className="text-[11px] font-mono text-slate-400">(@{item.actor.username})</span>
                                </div>
                                <span>•</span>
                                <span className="text-slate-500">{item.location?.name || "المستودع الرئيسي"}</span>
                              </div>

                              {item.description && (
                                <p className="text-xs text-slate-500 italic">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            <div className="text-left shrink-0 space-y-1">
                              <p className="text-xs font-mono font-bold text-teal-800 flex items-center justify-end gap-1">
                                <Clock className="w-3.5 h-3.5 text-teal-600" />
                                <span>{formatFullDateTime(item.occurredAt)}</span>
                              </p>
                              <span className="text-[11px] font-bold text-teal-600 group-hover:underline flex items-center justify-end gap-1">
                                <span>التفاصيل الكاملة</span>
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Load More Button */}
                  {filteredTimeline.length > visibleTimelineCount && (
                    <div className="pt-6 text-center">
                      <Button
                        onClick={() => setVisibleTimelineCount((prev) => prev + 10)}
                        variant="outline"
                        className="border-slate-300 text-slate-700 font-bold rounded-xl px-8"
                      >
                        عرض باقي الأحداث ({filteredTimeline.length - visibleTimelineCount} متبقية)
                      </Button>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="bg-slate-50 border-t border-slate-200 p-6 flex flex-col sm:flex-row gap-3">
                  {trackingData.asset.status === "RECEIVED_BY_TECHNICIAN" ? (
                    <Button
                      onClick={() => updateStatusMutation.mutate({ status: "DELIVERED" })}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 h-12 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-extrabold text-base rounded-xl shadow-md"
                    >
                      تغيير الحالة إلى: اعتماد تسليم الجهاز للعميل وإغلاق الطلب
                    </Button>
                  ) : trackingData.asset.status === "DELIVERED" ? (
                    <Button
                      onClick={() => updateStatusMutation.mutate({ status: "RECEIVED_BY_TECHNICIAN" })}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-base rounded-xl shadow-md"
                    >
                      تغيير الحالة إلى: إرجاع لعهدة الفني النشطة
                    </Button>
                  ) : null}
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* Event Details Dialog (كل حدث قابل للنقر) */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-xl font-['Cairo'] rounded-3xl" dir="rtl">
          {selectedEvent && (
            <>
              <DialogHeader className="border-b pb-4">
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Info className="w-5 h-5 text-teal-600" />
                  <span>تفاصيل الحركة والأكشن</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  التوثيق الكامل للعملية والجهاز والمنفذ والموقع الجغرافي
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* User info */}
                <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <Avatar className="h-12 w-12 border-2 border-teal-600">
                    <AvatarImage src={selectedEvent.actor.avatarUrl || undefined} />
                    <AvatarFallback className="bg-teal-700 text-white font-bold">
                      {selectedEvent.actor.name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-bold text-slate-400">المنفذ للعملية</p>
                    <p className="text-sm font-extrabold text-slate-900">{selectedEvent.actor.name}</p>
                    <p className="text-xs font-mono text-teal-700">@{selectedEvent.actor.username} ({selectedEvent.actor.role})</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-slate-400 font-bold">الحالة السابقة</p>
                    <p className="text-slate-900 font-bold mt-0.5">{selectedEvent.statusFromLabel}</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-slate-400 font-bold">الحالة الجديدة</p>
                    <p className="text-teal-700 font-extrabold mt-0.5">{selectedEvent.statusToLabel}</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-slate-400 font-bold">توقيت العملية</p>
                    <p className="text-slate-900 font-mono font-bold mt-0.5">{formatFullDateTime(selectedEvent.occurredAt)}</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-slate-400 font-bold">رقم العملية / Reference</p>
                    <p className="text-cyan-800 font-mono font-bold mt-0.5">{selectedEvent.referenceId || selectedEvent.eventId.slice(0, 12)}</p>
                  </div>
                </div>

                {selectedEvent.notes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="font-bold text-amber-900">الملاحظات والوصف:</p>
                    <p className="text-slate-700 mt-0.5">{selectedEvent.notes}</p>
                  </div>
                )}

                {selectedEvent.metadata && (
                  <div className="p-3 bg-slate-900 text-slate-200 rounded-xl space-y-1 font-mono text-[11px]">
                    <p className="text-teal-400 font-bold">معلومات النظام (System Metadata):</p>
                    <p>المصدر: {selectedEvent.metadata.source || "Web Portal"}</p>
                    <p>رقم الدفعة: {selectedEvent.metadata.actionNumber || "N/A"}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={() => setSelectedEvent(null)} className="w-full font-bold rounded-xl">
                  إغلاق Window
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick User Details Modal (عند النقر على الشخص) */}
      <Dialog open={!!selectedUserModal} onOpenChange={() => setSelectedUserModal(null)}>
        <DialogContent className="sm:max-w-md font-['Cairo'] rounded-3xl" dir="rtl">
          {selectedUserModal && (
            <>
              <DialogHeader className="border-b pb-4">
                <DialogTitle className="text-lg font-bold">ملف المستخدم</DialogTitle>
              </DialogHeader>

              <div className="py-4 text-center space-y-3">
                <Avatar className="h-20 w-20 mx-auto border-4 border-teal-600 shadow-md">
                  <AvatarImage src={selectedUserModal.avatar || undefined} />
                  <AvatarFallback className="bg-teal-700 text-white font-bold text-2xl">
                    {selectedUserModal.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>

                <h3 className="text-xl font-extrabold text-slate-900">{selectedUserModal.name}</h3>
                <p className="text-xs font-mono text-teal-700">@{selectedUserModal.username}</p>
                <Badge className="bg-teal-100 text-teal-900">{selectedUserModal.role || "عضو فريق الميدان"}</Badge>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Link href={`/technician-details/${selectedUserModal.id}`} className="w-full">
                  <Button className="w-full font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white">
                    الانتقال لصفحة الفني الكاملة
                  </Button>
                </Link>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
