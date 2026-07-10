import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Battery, 
  Cable, 
  CreditCard,
  AlertCircle,
  User,
  Calendar,
  Package,
  Sparkles,
  TrendingUp,
  Filter,
  Home,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

interface ReceivedDevice {
  id: string;
  terminalId: string | null;
  serialNumber: string;
  itemTypeId: string | null;
  inventoryType: 'fixed' | 'moving';
  battery: boolean;
  chargerCable: boolean;
  chargerHead: boolean;
  hasSim: boolean;
  simCardType: string | null;
  damagePart: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'delivered';
  technicianId: string;
  supervisorId: string | null;
  regionId: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

interface User {
  id: string;
  username: string;
  fullName: string;
}

export default function ReceivedDevicesReview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedDevice, setSelectedDevice] = useState<ReceivedDevice | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const { data: devices = [], isLoading } = useQuery<ReceivedDevice[]>({
    queryKey: ["/api/received-devices"],
  });

  const { data: itemTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/item-types"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: false, // Disable for now, will use device data instead
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes: string }) =>
      apiRequest("PATCH", `/api/received-devices/${id}/status`, { status, adminNotes: notes }),
    onSuccess: () => {
      toast({
        title: actionType === 'approve' ? "✅ تمت الموافقة" : "❌ تم الرفض",
        description: actionType === 'approve' 
          ? "تم قبول الجهاز بنجاح" 
          : "تم رفض الجهاز",
      });
      setSelectedDevice(null);
      setActionType(null);
      setAdminNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/received-devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/received-devices/pending/count"] });
    },
    onError: () => {
      toast({
        title: "❌ خطأ",
        description: "فشل تحديث حالة الجهاز",
        variant: "destructive",
      });
    },
  });

  const handleAction = (device: ReceivedDevice, action: 'approve' | 'reject') => {
    setSelectedDevice(device);
    setActionType(action);
    setAdminNotes("");
  };

  const confirmAction = () => {
    if (!selectedDevice || !actionType) return;
    
    updateStatusMutation.mutate({
      id: selectedDevice.id,
      status: actionType === 'approve' ? 'approved' : 'rejected',
      notes: adminNotes,
    });
  };

  const getUserName = (userId: string) => {
    const foundUser = users.find(u => u.id === userId);
    return foundUser?.fullName || foundUser?.username || `مندوب #${userId.slice(0, 8)}`;
  };

  const getItemName = (itemTypeId: string | null, terminalId: string | null) => {
    if (itemTypeId) {
      const it = itemTypes.find(t => t.id === itemTypeId);
      if (it) return it.nameAr;
    }
    return terminalId || "منتج غير معروف";
  };

  const getCategoryIcon = (itemTypeId: string | null) => {
    if (itemTypeId) {
      const it = itemTypes.find(t => t.id === itemTypeId);
      if (it) {
        if (it.category === 'papers') return <FileText className="w-5 h-5 text-[#18B2B0]" />;
        if (it.category === 'sim') return <CreditCard className="w-5 h-5 text-[#18B2B0]" />;
        if (it.category === 'accessories') return <Package className="w-5 h-5 text-[#18B2B0]" />;
      }
    }
    return <Smartphone className="w-5 h-5 text-[#18B2B0]" />;
  };

  const pendingDevices = devices.filter(d => d.status === 'pending');
  const approvedDevices = devices.filter(d => d.status === 'approved');
  const rejectedDevices = devices.filter(d => d.status === 'rejected');
  const deliveredDevices = devices.filter(d => d.status === 'delivered');

  const renderDeviceCard = (device: ReceivedDevice) => {
    const statusConfig = {
      pending: { 
        color: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30", 
        icon: Clock, 
        text: "قيد المراجعة",
        badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      },
      approved: { 
        color: "from-green-500/20 to-emerald-500/20 border-green-500/30", 
        icon: CheckCircle2, 
        text: "موافق عليه",
        badgeClass: "bg-green-500/20 text-green-300 border-green-500/30"
      },
      rejected: { 
        color: "from-red-500/20 to-rose-500/20 border-red-500/30", 
        icon: XCircle, 
        text: "مرفوض",
        badgeClass: "bg-red-500/20 text-red-300 border-red-500/30"
      },
      delivered: { 
        color: "from-teal-500/20 to-cyan-500/20 border-teal-500/30", 
        icon: Sparkles, 
        text: "تم التسليم",
        badgeClass: "bg-teal-500/20 text-teal-300 border-teal-500/30"
      },
    };

    const status = statusConfig[device.status] || statusConfig.pending;
    const StatusIcon = status.icon;
    const isDevice = !device.itemTypeId || itemTypes.find(t => t.id === device.itemTypeId)?.category === 'devices';

    return (
      <motion.div
        key={device.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        layout
        className="relative group cursor-pointer"
        onClick={() => setLocation(`/received-devices/${device.id}`)}
      >
        <div className={`absolute inset-0 bg-gradient-to-r ${status.color} rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity`} />
        <Card 
          className="relative bg-slate-900/70 backdrop-blur-xl border-slate-700/50 hover:border-[#18B2B0]/50 transition-all duration-300"
          data-testid={`card-device-${device.id}`}
        >
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-100">
                  <div className="p-2 bg-gradient-to-br from-[#18B2B0]/20 to-cyan-500/20 rounded-lg">
                    {getCategoryIcon(device.itemTypeId)}
                  </div>
                  {getItemName(device.itemTypeId, device.terminalId)}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <span className="font-mono px-2 py-0.5 bg-slate-800/50 rounded">
                    {device.serialNumber}
                  </span>
                  {device.terminalId && (
                    <span className="text-xs px-2 py-0.5 bg-slate-800/50 rounded text-slate-400">
                      Terminal: {device.terminalId}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${device.inventoryType === 'moving' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20' : 'bg-blue-500/15 text-blue-300 border border-blue-500/20'}`}>
                    {device.inventoryType === 'moving' ? 'مخزون متحرك' : 'مخزون ثابت'}
                  </span>
                </div>
              </div>
              <Badge className={`${status.badgeClass} flex items-center gap-1.5 px-3 py-1.5 border`}>
                <StatusIcon className="w-4 h-4" />
                {status.text}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Technician & Date */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-4 h-4 text-[#18B2B0]" />
                <span className="font-medium text-slate-300">{getUserName(device.technicianId)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(device.createdAt), "dd MMM yyyy", { locale: ar })}</span>
              </div>
            </div>

            {/* Accessories (Only for devices) */}
            {isDevice && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Package className="w-4 h-4 text-[#18B2B0]" />
                  الملحقات:
                </div>
                <div className="flex flex-wrap gap-2">
                  {device.battery && (
                    <Badge variant="outline" className="bg-slate-800/50 border-slate-600 text-slate-300">
                      <Battery className="w-3 h-3 ml-1" />
                      بطارية
                    </Badge>
                  )}
                  {device.chargerCable && (
                    <Badge variant="outline" className="bg-slate-800/50 border-slate-600 text-slate-300">
                      <Cable className="w-3 h-3 ml-1" />
                      كابل
                    </Badge>
                  )}
                  {device.chargerHead && (
                    <Badge variant="outline" className="bg-slate-800/50 border-slate-600 text-slate-300">
                      <Cable className="w-3 h-3 ml-1" />
                      رأس
                    </Badge>
                  )}
                  {device.hasSim && (
                    <Badge variant="outline" className="bg-slate-800/50 border-slate-600 text-slate-300">
                      <CreditCard className="w-3 h-3 ml-1" />
                      {device.simCardType || 'SIM'}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Damage Info */}
            {device.damagePart && (
              <div className="p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl border border-orange-500/30">
                <div className="flex items-start gap-3 text-sm">
                  <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-orange-300 block mb-1">ملاحظات الأضرار:</span>
                    <p className="text-orange-200/80">{device.damagePart}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Notes */}
            {device.adminNotes && (
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="text-sm">
                  <span className="font-medium text-slate-300 block mb-1">ملاحظات المشرف:</span>
                  <p className="text-slate-400">{device.adminNotes}</p>
                </div>
              </div>
            )}

            {/* Approval Info */}
            {device.approvedBy && device.approvedAt && (
              <div className="text-xs text-slate-500 flex items-center gap-2 pt-2 border-t border-slate-700/50">
                <span>تمت المراجعة: {getUserName(device.approvedBy)}</span>
                <span>•</span>
                <span>{format(new Date(device.approvedAt), "dd MMM yyyy", { locale: ar })}</span>
              </div>
            )}

            {/* Action Buttons */}
            {device.status === 'pending' && (user?.role === 'supervisor' || user?.role === 'admin') && (
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(device, 'approve');
                  }}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/30"
                  data-testid={`button-approve-${device.id}`}
                >
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                  موافقة
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(device, 'reject');
                  }}
                  variant="destructive"
                  className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-500/30"
                  data-testid={`button-reject-${device.id}`}
                >
                  <XCircle className="w-4 h-4 ml-2" />
                  رفض
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#18B2B0]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-20 right-1/3 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-7xl mx-auto space-y-8"
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="flex items-center justify-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#18B2B0] to-teal-500 rounded-2xl blur-xl opacity-50" />
                <div className="relative p-4 bg-gradient-to-br from-[#18B2B0] to-teal-600 rounded-2xl">
                  <Filter className="w-10 h-10 text-white" />
                </div>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold">
                <span className="bg-gradient-to-r from-[#18B2B0] via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  مراجعة الأجهزة والمواد
                </span>
              </h1>
            </div>
            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
              راجع الأجهزة والمواد المستلمة في المستودعات واتخذ القرار المناسب
            </p>
            
            {/* Back Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                data-testid="button-back-home"
              >
                <Home className="w-4 h-4 ml-2" />
                العودة للصفحة الرئيسية
              </Button>
            </motion.div>
          </motion.div>

          {/* Statistics Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
              <Card className="relative bg-slate-900/70 backdrop-blur-xl border-yellow-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-300 mb-1">قيد المراجعة</p>
                      <p className="text-4xl font-bold text-yellow-100">{pendingDevices.length}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-xl">
                      <Clock className="w-10 h-10 text-yellow-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
              <Card className="relative bg-slate-900/70 backdrop-blur-xl border-green-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-300 mb-1">موافق عليها</p>
                      <p className="text-4xl font-bold text-green-100">{approvedDevices.length}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl">
                      <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
              <Card className="relative bg-slate-900/70 backdrop-blur-xl border-teal-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-teal-300 mb-1">تم تسليمها</p>
                      <p className="text-4xl font-bold text-teal-100">{deliveredDevices.length}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-xl">
                      <Sparkles className="w-10 h-10 text-teal-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
              <Card className="relative bg-slate-900/70 backdrop-blur-xl border-red-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-300 mb-1">مرفوضة</p>
                      <p className="text-4xl font-bold text-red-100">{rejectedDevices.length}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-xl">
                      <XCircle className="w-10 h-10 text-red-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-14 bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 p-1">
                <TabsTrigger 
                  value="pending" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#18B2B0] data-[state=active]:to-teal-600 data-[state=active]:text-white text-slate-400"
                  data-testid="tab-pending"
                >
                  <Clock className="w-4 h-4 ml-2" />
                  قيد المراجعة ({pendingDevices.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="approved" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white text-slate-400"
                  data-testid="tab-approved"
                >
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                  موافق ({approvedDevices.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="delivered" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white text-slate-400"
                  data-testid="tab-delivered"
                >
                  <Sparkles className="w-4 h-4 ml-2" />
                  تم التسليم ({deliveredDevices.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="rejected" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-rose-600 data-[state=active]:text-white text-slate-400"
                  data-testid="tab-rejected"
                >
                  <XCircle className="w-4 h-4 ml-2" />
                  مرفوضة ({rejectedDevices.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-8">
                {isLoading ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 border-4 border-[#18B2B0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 text-lg">جاري التحميل...</p>
                  </div>
                ) : pendingDevices.length === 0 ? (
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#18B2B0]/10 to-transparent rounded-2xl blur-xl" />
                    <Card className="relative bg-slate-900/70 backdrop-blur-xl border-slate-700/50 p-16 text-center">
                      <Clock className="w-20 h-20 mx-auto text-slate-600 mb-4" />
                      <p className="text-2xl text-slate-400">لا توجد أجهزة قيد المراجعة</p>
                    </Card>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    <AnimatePresence>
                      {pendingDevices.map(renderDeviceCard)}
                    </AnimatePresence>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="approved" className="mt-8">
                {approvedDevices.length === 0 ? (
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent rounded-2xl blur-xl" />
                    <Card className="relative bg-slate-900/70 backdrop-blur-xl border-slate-700/50 p-16 text-center">
                      <CheckCircle2 className="w-20 h-20 mx-auto text-slate-600 mb-4" />
                      <p className="text-2xl text-slate-400">لا توجد أجهزة موافق عليها</p>
                    </Card>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    <AnimatePresence>
                      {approvedDevices.map(renderDeviceCard)}
                    </AnimatePresence>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="delivered" className="mt-8">
                {deliveredDevices.length === 0 ? (
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-transparent rounded-2xl blur-xl" />
                    <Card className="relative bg-slate-900/70 backdrop-blur-xl border-slate-700/50 p-16 text-center">
                      <Sparkles className="w-20 h-20 mx-auto text-slate-600 mb-4" />
                      <p className="text-2xl text-slate-400">لا توجد أجهزة مسلّمة بعد</p>
                    </Card>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    <AnimatePresence>
                      {deliveredDevices.map(renderDeviceCard)}
                    </AnimatePresence>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rejected" className="mt-8">
                {rejectedDevices.length === 0 ? (
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent rounded-2xl blur-xl" />
                    <Card className="relative bg-slate-900/70 backdrop-blur-xl border-slate-700/50 p-16 text-center">
                      <XCircle className="w-20 h-20 mx-auto text-slate-600 mb-4" />
                      <p className="text-2xl text-slate-400">لا توجد أجهزة مرفوضة</p>
                    </Card>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    <AnimatePresence>
                      {rejectedDevices.map(renderDeviceCard)}
                    </AnimatePresence>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!selectedDevice && !!actionType} onOpenChange={() => { setSelectedDevice(null); setActionType(null); }}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700" data-testid="dialog-action">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-slate-100">
              {actionType === 'approve' ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  تأكيد الموافقة
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-red-400" />
                  تأكيد الرفض
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedDevice && (
                <>مادة: {getItemName(selectedDevice.itemTypeId, selectedDevice.terminalId)} - {selectedDevice.serialNumber}</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="notes" className="text-base text-slate-300">
                ملاحظات {actionType === 'reject' ? '(مطلوبة)' : '(اختيارية)'}
              </Label>
              <Textarea
                id="notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="أضف ملاحظات حول قرارك..."
                className="mt-2 min-h-[120px] bg-slate-800/50 border-slate-600 text-slate-100 placeholder:text-slate-500"
                data-testid="textarea-adminNotes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setSelectedDevice(null); setActionType(null); }}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
              data-testid="button-cancel"
            >
              إلغاء
            </Button>
            <Button
              onClick={confirmAction}
              disabled={updateStatusMutation.isPending || (actionType === 'reject' && !adminNotes.trim())}
              className={actionType === 'approve' 
                ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500" 
                : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500"}
              data-testid="button-confirm"
            >
              {updateStatusMutation.isPending ? "جاري الحفظ..." : "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

