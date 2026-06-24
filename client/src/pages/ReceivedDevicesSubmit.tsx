import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { insertReceivedDeviceSchema, type InsertReceivedDevice, type ItemType } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Smartphone, Package, Battery, Cable, CreditCard, AlertCircle, CheckCircle2, Sparkles, ArrowRight, Home } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

export default function ReceivedDevicesSubmit() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const form = useForm<InsertReceivedDevice>({
    resolver: zodResolver(insertReceivedDeviceSchema),
    defaultValues: {
      itemTypeId: "",
      terminalId: "",
      serialNumber: "",
      battery: false,
      chargerCable: false,
      chargerHead: false,
      hasSim: false,
      simCardType: null,
      damagePart: "",
    },
  });

  const { data: deviceItemTypes = [] } = useQuery<ItemType[]>({
    queryKey: ["/api/item-types/active"],
    select: (types) => types.filter((type) => type.category === "devices"),
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertReceivedDevice) => 
      apiRequest("POST", "/api/received-devices", data),
    onSuccess: () => {
      toast({
        title: "✅ تم إدخال البيانات بنجاح",
        description: "تم إرسال بيانات الجهاز إلى المشرف للمراجعة",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/received-devices"] });
    },
    onError: () => {
      toast({
        title: "❌ خطأ",
        description: "فشل إدخال بيانات الجهاز. يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertReceivedDevice) => {
    if (!data.itemTypeId) {
      toast({
        title: "❌ بيانات ناقصة",
        description: "يرجى اختيار نوع الجهاز أولاً",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(data);
  };

  const hasSim = form.watch("hasSim");

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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl mx-auto space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex items-center justify-center gap-3"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#18B2B0] to-teal-500 rounded-2xl blur-xl opacity-50" />
                <div className="relative p-4 bg-gradient-to-br from-[#18B2B0] to-teal-600 rounded-2xl shadow-2xl">
                  <Smartphone className="w-10 h-10 text-white" />
                </div>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold">
                <span className="bg-gradient-to-r from-[#18B2B0] via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  إدخال بيانات الأجهزة
                </span>
              </h1>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto"
            >
              يرجى إدخال جميع بيانات الجهاز المستلم بدقة ليتم إرسالها للمشرف
            </motion.p>
            
            {/* Back Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
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
          </div>

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#18B2B0]/20 to-cyan-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
            <div className="relative bg-slate-900/60 backdrop-blur-xl border border-[#18B2B0]/30 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-[#18B2B0]/20 to-cyan-500/20 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-[#18B2B0]" />
                </div>
                <div className="flex-1">
                  <p className="text-slate-300 leading-relaxed">
                    <Sparkles className="w-4 h-4 inline-block mr-2 text-[#18B2B0]" />
                    سيتم إرسال البيانات تلقائياً إلى المشرف المسؤول للمراجعة والموافقة
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Main Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#18B2B0]/10 to-teal-500/10 rounded-3xl blur-2xl group-hover:blur-3xl transition-all" />
            <Card className="relative bg-slate-900/70 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
              <CardHeader className="relative overflow-hidden border-b border-slate-700/50">
                <div className="absolute inset-0 bg-gradient-to-r from-[#18B2B0]/10 to-transparent" />
                <div className="relative flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[#18B2B0]/20 to-cyan-500/20 rounded-xl">
                    <Package className="w-6 h-6 text-[#18B2B0]" />
                  </div>
                  <CardTitle className="text-2xl text-slate-100">معلومات الجهاز</CardTitle>
                </div>
              </CardHeader>

              <CardContent className="p-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                    {/* Device Information */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-3 border-b border-slate-700/50">
                        <Smartphone className="w-5 h-5 text-[#18B2B0]" />
                        <h3 className="text-lg font-semibold text-slate-200">
                          معلومات الجهاز الأساسية
                        </h3>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="itemTypeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-300 text-base font-medium">
                                نوع الجهاز <span className="text-red-400">*</span>
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || undefined}
                                data-testid="select-itemTypeId"
                              >
                                <FormControl>
                                  <SelectTrigger className="h-12 bg-slate-800/50 border-slate-600 text-slate-100 focus:border-[#18B2B0] focus:ring-[#18B2B0]/20">
                                    <SelectValue placeholder="اختر نوع الجهاز" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                  {deviceItemTypes.map((itemType) => (
                                    <SelectItem key={itemType.id} value={itemType.id} className="text-slate-100 focus:bg-slate-700">
                                      {itemType.nameAr}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="terminalId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-300 text-base font-medium">
                                رقم التيرمينال <span className="text-red-400">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative group">
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    placeholder="أدخل رقم التيرمينال"
                                    className="h-12 bg-slate-800/50 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-[#18B2B0] focus:ring-[#18B2B0]/20"
                                    data-testid="input-terminalId"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="serialNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-300 text-base font-medium">
                                الرقم التسلسلي <span className="text-red-400">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="أدخل الرقم التسلسلي"
                                  className="h-12 bg-slate-800/50 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-[#18B2B0] focus:ring-[#18B2B0]/20"
                                  data-testid="input-serialNumber"
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Accessories */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-3 border-b border-slate-700/50">
                        <Package className="w-5 h-5 text-[#18B2B0]" />
                        <h3 className="text-lg font-semibold text-slate-200">
                          الملحقات المرفقة
                        </h3>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="battery"
                          render={({ field }) => (
                            <FormItem className="relative group">
                              <div className="absolute inset-0 bg-gradient-to-r from-[#18B2B0]/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="relative flex items-center gap-4 p-5 bg-slate-800/30 rounded-xl border border-slate-700/50 hover:border-[#18B2B0]/50 transition-colors">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-battery"
                                    className="w-6 h-6 border-slate-600 data-[state=checked]:bg-[#18B2B0] data-[state=checked]:border-[#18B2B0]"
                                  />
                                </FormControl>
                                <div className="flex items-center gap-3">
                                  <Battery className="w-5 h-5 text-[#18B2B0]" />
                                  <FormLabel className="text-base text-slate-300 cursor-pointer m-0">
                                    البطارية
                                  </FormLabel>
                                </div>
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="chargerCable"
                          render={({ field }) => (
                            <FormItem className="relative group">
                              <div className="absolute inset-0 bg-gradient-to-r from-[#18B2B0]/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="relative flex items-center gap-4 p-5 bg-slate-800/30 rounded-xl border border-slate-700/50 hover:border-[#18B2B0]/50 transition-colors">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-chargerCable"
                                    className="w-6 h-6 border-slate-600 data-[state=checked]:bg-[#18B2B0] data-[state=checked]:border-[#18B2B0]"
                                  />
                                </FormControl>
                                <div className="flex items-center gap-3">
                                  <Cable className="w-5 h-5 text-[#18B2B0]" />
                                  <FormLabel className="text-base text-slate-300 cursor-pointer m-0">
                                    كابل الشاحن
                                  </FormLabel>
                                </div>
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="chargerHead"
                          render={({ field }) => (
                            <FormItem className="relative group">
                              <div className="absolute inset-0 bg-gradient-to-r from-[#18B2B0]/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="relative flex items-center gap-4 p-5 bg-slate-800/30 rounded-xl border border-slate-700/50 hover:border-[#18B2B0]/50 transition-colors">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-chargerHead"
                                    className="w-6 h-6 border-slate-600 data-[state=checked]:bg-[#18B2B0] data-[state=checked]:border-[#18B2B0]"
                                  />
                                </FormControl>
                                <div className="flex items-center gap-3">
                                  <Cable className="w-5 h-5 text-[#18B2B0]" />
                                  <FormLabel className="text-base text-slate-300 cursor-pointer m-0">
                                    رأس الشاحن
                                  </FormLabel>
                                </div>
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="hasSim"
                          render={({ field }) => (
                            <FormItem className="relative group">
                              <div className="absolute inset-0 bg-gradient-to-r from-[#18B2B0]/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="relative flex items-center gap-4 p-5 bg-slate-800/30 rounded-xl border border-slate-700/50 hover:border-[#18B2B0]/50 transition-colors">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-hasSim"
                                    className="w-6 h-6 border-slate-600 data-[state=checked]:bg-[#18B2B0] data-[state=checked]:border-[#18B2B0]"
                                  />
                                </FormControl>
                                <div className="flex items-center gap-3">
                                  <CreditCard className="w-5 h-5 text-[#18B2B0]" />
                                  <FormLabel className="text-base text-slate-300 cursor-pointer m-0">
                                    يحتوي على شريحة SIM
                                  </FormLabel>
                                </div>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>

                      {hasSim && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <FormField
                            control={form.control}
                            name="simCardType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-300 text-base font-medium">
                                  نوع شريحة SIM
                                </FormLabel>
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value || undefined}
                                  data-testid="select-simCardType"
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-12 bg-slate-800/50 border-slate-600 text-slate-100 focus:border-[#18B2B0] focus:ring-[#18B2B0]/20">
                                      <SelectValue placeholder="اختر نوع الشريحة" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="bg-slate-800 border-slate-700">
                                    <SelectItem value="mobily" className="text-slate-100 focus:bg-slate-700">Mobily</SelectItem>
                                    <SelectItem value="zain" className="text-slate-100 focus:bg-slate-700">Zain</SelectItem>
                                    <SelectItem value="stc" className="text-slate-100 focus:bg-slate-700">STC</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage className="text-red-400" />
                              </FormItem>
                            )}
                          />
                        </motion.div>
                      )}
                    </div>

                    {/* Damage Information */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-3 border-b border-slate-700/50">
                        <AlertCircle className="w-5 h-5 text-orange-400" />
                        <h3 className="text-lg font-semibold text-slate-200">
                          معلومات الأضرار (اختياري)
                        </h3>
                      </div>

                      <FormField
                        control={form.control}
                        name="damagePart"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-300 text-base font-medium">
                              وصف الأضرار أو الملاحظات
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                value={field.value || ""}
                                placeholder="اذكر أي أضرار أو ملاحظات على الجهاز (اختياري)"
                                className="min-h-[120px] bg-slate-800/50 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-[#18B2B0] focus:ring-[#18B2B0]/20 resize-none"
                                data-testid="textarea-damagePart"
                              />
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 pt-6 border-t border-slate-700/50">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
                        disabled={createMutation.isPending}
                        className="px-8 h-12 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                        data-testid="button-reset"
                      >
                        إعادة تعيين
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="px-8 h-12 bg-gradient-to-r from-[#18B2B0] to-teal-600 hover:from-[#18B2B0]/90 hover:to-teal-600/90 text-white shadow-lg shadow-[#18B2B0]/30 transition-all"
                        data-testid="button-submit"
                      >
                        {createMutation.isPending ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            جاري الإرسال...
                          </>
                        ) : (
                          <>
                            إرسال البيانات
                            <ArrowRight className="w-5 h-5 mr-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
