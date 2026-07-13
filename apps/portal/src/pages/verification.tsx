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
  ArrowLeft 
} from "lucide-react";
import { Link } from "wouter";

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
};

export default function VerificationPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scanValue, setScanValue] = useState("");
  const [serialQuery, setSerialQuery] = useState("");
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanValue.trim()) return;
    setSerialQuery(scanValue.trim());
  };

  const handleClear = () => {
    setScanValue("");
    setSerialQuery("");
    inputRef.current?.focus();
  };

  // Helper to resolve category badge & colors
  const getCategoryDetails = (category?: string | null) => {
    switch (category) {
      case "devices":
        return { label: t('verification.pos_devices'), icon: Smartphone, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
      case "sim":
        return { label: t('verification.sim_1'), icon: Handshake, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" };
      case "papers":
        return { label: t('verification.paper_print'), icon: FileText, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
      case "accessories":
        return { label: t('verification.accessories_chargers'), icon: Cable, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
      default:
        return { label: t('verification.item_9565'), icon: Boxes, color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
    }
  };

  // Helper to translate and style status
  const getStatusDetails = (status?: string | null) => {
    switch (status) {
      case "RECEIVED_BY_TECHNICIAN":
        return { label: t('verification.technician_1'), color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      case "DELIVERED":
        return { label: t('verification.completed_2'), color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
      case "PENDING_RECEIPT":
        return { label: t('verification.pending_technician'), color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "RETURNED":
        return { label: t('verification.returned'), color: "bg-red-500/10 text-red-400 border-red-500/30" };
      default:
        return { label: status || t('verification.item_11173'), color: "bg-slate-500/10 text-slate-400 border-slate-500/30" };
    }
  };

  const cat = getCategoryDetails(itemData?.itemTypeCategory);
  const IconComponent = cat.icon;
  const statusDetails = getStatusDetails(itemData?.status);

  return (
    <div className="space-y-8" dir="rtl">
      <header className="rounded-2xl border border-slate-700/60 bg-slate-900/35 backdrop-blur-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <QrCode className="w-7 h-7 text-cyan-400" />
            {t('verification.verification_number_serial')}
          </h1>
          <p className="text-slate-400 mt-1">
            {t('verification.search_status_devices')}
          </p>
        </div>

        <Link href="/home">
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
            <ArrowLeft className="ml-2 h-4 w-4" />
            {t('verification.control')}
          </Button>
        </Link>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Search / Scan Card */}
        <Card className="bg-slate-900/40 border-slate-700/50 backdrop-blur-xl lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-cyan-400" />
              {t('verification.scan')}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {t('verification.sim_number_serial')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  ref={inputRef}
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  placeholder={t('verification.number_serial_3')}
                  className="pr-10 bg-slate-950/40 border-slate-700 text-slate-200 focus-visible:ring-cyan-500/35 text-center font-mono placeholder:text-slate-600"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold">
                  {t('verification.search')}
                </Button>
                {(scanValue || serialQuery) && (
                  <Button type="button" onClick={handleClear} variant="outline" className="border-slate-700 text-slate-300">
                    {t('verification.scan_1')}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
          <CardFooter className="border-t border-slate-800/60 pt-4 text-xs text-slate-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-cyan-500 shrink-0" />
            <span>{t('verification.scan_stickers_devices_mobily_z')}</span>
          </CardFooter>
        </Card>

        {/* Right Details Display */}
        <div className="lg:col-span-2">
          {isLoading && (
            <Card className="bg-slate-900/40 border-slate-700/50 backdrop-blur-xl h-full flex items-center justify-center p-12">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-400 text-sm">{t('verification.search_data')}</p>
              </div>
            </Card>
          )}

          {!serialQuery && !isLoading && (
            <Card className="bg-slate-900/20 border-dashed border-slate-800 h-full flex items-center justify-center p-12 text-center">
              <div className="max-w-md">
                <QrCode className="w-16 h-16 text-slate-700 mx-auto mb-4 stroke-1 animate-pulse" />
                <h3 className="text-lg font-bold text-slate-300">{t('verification.scan_number_serial')}</h3>
                <p className="text-slate-500 text-sm mt-1">
                  {t('verification.submit_number_search_details')}
                </p>
              </div>
            </Card>
          )}

          {error && !isLoading && (
            <Card className="bg-slate-900/40 border-red-500/20 backdrop-blur-xl h-full flex items-center justify-center p-12 text-center">
              <div className="max-w-md">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-100">{t('verification.fail_data')}</h3>
                <p className="text-slate-400 text-sm mt-1">{(error as any)?.message || t('verification.error')}</p>
              </div>
            </Card>
          )}

          {itemData && !isLoading && (
            <Card className="bg-slate-900/40 border-slate-700/60 backdrop-blur-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-950/80 to-slate-900/20 border-b border-slate-800/80 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl border ${cat.color} flex items-center justify-center`}>
                    <IconComponent className="w-7 h-7" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-100 text-xl font-bold">{itemData.itemTypeName || t('verification.item_17641')}</CardTitle>
                    <CardDescription className="text-slate-400 mt-0.5">
                      S/N: <span className="font-mono text-cyan-300 font-bold">{itemData.serialNumber}</span>
                    </CardDescription>
                  </div>
                </div>

                <Badge className={`${statusDetails.color} text-xs font-bold px-3 py-1`}>
                  {statusDetails.label}
                </Badge>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-800/60 flex items-center gap-3">
                    <User className="w-5 h-5 text-cyan-400 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">{t('verification.item_25468')}</p>
                      <p className="text-sm font-bold text-slate-200 mt-0.5">
                        {itemData.ownerName ? (
                          <Link href={`/technician-details/${itemData.ownerId}`} className="hover:underline text-cyan-300">
                            {itemData.ownerName}
                          </Link>
                        ) : t('verification.warehouse_primary_1')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-800/60 flex items-center gap-3">
                    <Tag className="w-5 h-5 text-cyan-400 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">{t('verification.category')}</p>
                      <p className="text-sm font-bold text-slate-200 mt-0.5">{cat.label}</p>
                    </div>
                  </div>

                  <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-800/60 flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-cyan-400 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">{t('verification.date')}</p>
                      <p className="text-sm font-bold text-slate-200 mt-0.5">
                        {new Date(itemData.createdAt).toLocaleDateString("ar-SA", {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-800/60 flex items-center gap-3">
                    <History className="w-5 h-5 text-cyan-400 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">{t('verification.update')}</p>
                      <p className="text-sm font-bold text-slate-200 mt-0.5">
                        {itemData.updatedAt ? new Date(itemData.updatedAt).toLocaleDateString("ar-SA", {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {itemData.itemTypeCategory === "sim" && itemData.carrierName && (
                  <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-between">
                    <span className="text-slate-400 text-sm">{t('verification.item_28346')}</span>
                    <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold px-3">
                      {itemData.carrierName}
                    </Badge>
                  </div>
                )}
              </CardContent>

              <CardFooter className="bg-slate-950/40 border-t border-slate-800 p-6 flex flex-col sm:flex-row gap-3">
                {itemData.status === "RECEIVED_BY_TECHNICIAN" ? (
                  <Button
                    onClick={() => updateStatusMutation.mutate({ status: "DELIVERED" })}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black"
                  >
                    {updateStatusMutation.isPending ? t('verification.save') : t('verification.device_close_request')}
                  </Button>
                ) : itemData.status === "DELIVERED" ? (
                  <Button
                    onClick={() => updateStatusMutation.mutate({ status: "RECEIVED_BY_TECHNICIAN" })}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black"
                  >
                    {updateStatusMutation.isPending ? t('verification.save') : t('verification.item_28690')}
                  </Button>
                ) : null}

                {itemData.status !== "RETURNED" && (
                  <Button
                    onClick={() => updateStatusMutation.mutate({ status: "RETURNED" })}
                    disabled={updateStatusMutation.isPending}
                    variant="outline"
                    className="border-red-500/30 hover:bg-red-500/10 text-red-400 font-bold"
                  >
                    {t('verification.primary')}
                  </Button>
                )}
              </CardFooter>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
