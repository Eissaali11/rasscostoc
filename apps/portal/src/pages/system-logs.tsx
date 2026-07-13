import { useTranslation } from "@/lib/language";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  FileText,
  Download,
  Filter,
  Search,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { SystemLog } from "@shared/schema";
import { exportSystemLogsToExcel } from "@/lib/exportToExcel";
import { useToast } from "@/hooks/use-toast";

export default function SystemLogsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntityType, setFilterEntityType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const { data: logs, isLoading } = useQuery<SystemLog[]>({
    queryKey: ["/api/system-logs"],
  });

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      searchTerm === "" ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityName && log.entityName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction = filterAction === "all" || log.action === filterAction;
    const matchesEntityType = filterEntityType === "all" || log.entityType === filterEntityType;
    const matchesSeverity = filterSeverity === "all" || log.severity === filterSeverity;

    return matchesSearch && matchesAction && matchesEntityType && matchesSeverity;
  });

  const handleExportExcel = async () => {
    const rows = filteredLogs || [];

    if (rows.length === 0) {
      toast({
        variant: "destructive",
        title: t('reports.no_data'),
        description: t('reports.no_logs_1'),
      });
      return;
    }

    await exportSystemLogsToExcel({ logs: rows });
    toast({
      title: t('reports.completed_export_successfully'),
      description: t('reports.completed_export_log_system_fi'),
    });
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive" className="flex items-center gap-1" data-testid="badge-severity-error"><AlertCircle className="h-3 w-3" />{t('reports.error_2')}</Badge>;
      case "warn":
        return <Badge variant="outline" className="flex items-center gap-1 border-yellow-500/50 text-yellow-400 bg-yellow-500/10" data-testid="badge-severity-warn"><AlertTriangle className="h-3 w-3" />{t('reports.warning')}</Badge>;
      default:
        return <Badge variant="outline" className="flex items-center gap-1 border-[#18B2B0]/50 text-[#18B2B0] bg-[#18B2B0]/10" data-testid="badge-severity-info"><Info className="h-3 w-3" />{t('reports.item_9592')}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      create: { label: t('reports.item_7911'), color: "bg-green-500/10 text-green-400 border-green-500/30" },
      update: { label: t('reports.update'), color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
      delete: { label: t('reports.delete'), color: "bg-red-500/10 text-red-400 border-red-500/30" },
      approve: { label: t('reports.item_9568'), color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
      reject: { label: t('reports.reject'), color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
      transfer: { label: t('reports.item_4812'), color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
      login: { label: t('reports.item_14368'), color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
      logout: { label: t('reports.item_14346'), color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
    };

    const badge = badges[action] || { label: action, color: "bg-gray-500/10 text-gray-400 border-gray-500/30" };
    return <Badge variant="outline" className={badge.color} data-testid={`badge-action-${action}`}>{badge.label}</Badge>;
  };

  const getEntityTypeBadge = (entityType: string) => {
    const types: Record<string, string> = {
      region: t('reports.region'),
      user: t('reports.item_9540_1'),
      inventory: t('reports.item_7987'),
      warehouse: t('reports.warehouse'),
      request: t('reports.request'),
      transfer: t('reports.item_4812'),
      auth: t('reports.item_9531'),
      device: t('reports.device_1'),
    };

    return types[entityType] || entityType;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <Link href="/home">
              <Button
                variant="outline"
                className="border-[#18B2B0]/30 text-[#18B2B0] hover:bg-[#18B2B0]/10"
                data-testid="button-back"
              >
                <ArrowLeft className="ml-2 h-4 w-4" />
                {t('reports.item_9540')}
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Activity className="h-8 w-8 text-[#18B2B0]" />
                {t('reports.log_system')}
              </h1>
              <p className="text-gray-400 text-sm">{t('reports.followup_operations_system')}</p>
            </div>
          </div>

          <Button
            variant="outline"
            className="border-[#18B2B0]/30 text-[#18B2B0] hover:bg-[#18B2B0]/10"
            onClick={handleExportExcel}
            data-testid="button-export-system-logs-excel"
          >
            <Download className="ml-2 h-4 w-4" />
            {t('reports.export_excel')}
          </Button>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-[#1a1a1f]/80 to-[#25252b]/80 border-[#18B2B0]/30 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Filter className="h-5 w-5 text-[#18B2B0]" />
                {t('reports.search')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder={t('reports.logs_1')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-500"
                    data-testid="input-search"
                  />
                </div>

                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white" data-testid="select-action">
                    <SelectValue placeholder={t('reports.type_operation')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('reports.operations')}</SelectItem>
                    <SelectItem value="create">{t('reports.item_7911')}</SelectItem>
                    <SelectItem value="update">{t('reports.update')}</SelectItem>
                    <SelectItem value="delete">{t('reports.delete')}</SelectItem>
                    <SelectItem value="approve">{t('reports.item_9568')}</SelectItem>
                    <SelectItem value="reject">{t('reports.reject')}</SelectItem>
                    <SelectItem value="transfer">{t('reports.item_4812')}</SelectItem>
                    <SelectItem value="login">{t('reports.item_14368')}</SelectItem>
                    <SelectItem value="logout">{t('reports.item_14346')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white" data-testid="select-entity">
                    <SelectValue placeholder={t('reports.type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('reports.item_19146')}</SelectItem>
                    <SelectItem value="region">{t('reports.region')}</SelectItem>
                    <SelectItem value="user">{t('reports.item_9540_1')}</SelectItem>
                    <SelectItem value="inventory">{t('reports.item_7987')}</SelectItem>
                    <SelectItem value="warehouse">{t('reports.warehouse')}</SelectItem>
                    <SelectItem value="request">{t('reports.request')}</SelectItem>
                    <SelectItem value="transfer">{t('reports.item_4812')}</SelectItem>
                    <SelectItem value="auth">{t('reports.item_9531')}</SelectItem>
                    <SelectItem value="device">{t('reports.device_1')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white" data-testid="select-severity">
                    <SelectValue placeholder={t('reports.level')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('reports.item_20740')}</SelectItem>
                    <SelectItem value="info">{t('reports.item_9592')}</SelectItem>
                    <SelectItem value="warn">{t('reports.warning')}</SelectItem>
                    <SelectItem value="error">{t('reports.error_2')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Logs Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-[#1a1a1f]/80 to-[#25252b]/80 border-[#18B2B0]/30 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#18B2B0]" />
                {t('reports.count', { count: filteredLogs?.length || 0 })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full bg-gray-800/50" />
                  ))}
                </div>
              ) : filteredLogs && filteredLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700 hover:bg-gray-800/50">
                        <TableHead className="text-gray-300 text-right">{t('reports.date')}</TableHead>
                        <TableHead className="text-gray-300 text-right">{t('reports.user')}</TableHead>
                        <TableHead className="text-gray-300 text-right">{t('reports.operation')}</TableHead>
                        <TableHead className="text-gray-300 text-right">{t('reports.item_9573')}</TableHead>
                        <TableHead className="text-gray-300 text-right">{t('reports.item_7977')}</TableHead>
                        <TableHead className="text-gray-300 text-right">{t('reports.level')}</TableHead>
                        <TableHead className="text-gray-300 text-right">{t('reports.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow
                          key={log.id}
                          className="border-gray-700 hover:bg-gray-800/50 text-white"
                          data-testid={`row-log-${log.id}`}
                        >
                          <TableCell className="font-mono text-sm text-gray-300">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-[#18B2B0]" />
                              {log.createdAt ? format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: ar }) : "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.userName}</div>
                              <div className="text-xs text-gray-400">{log.userRole}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getActionBadge(log.action)}</TableCell>
                          <TableCell>
                            <div className="text-gray-300">{getEntityTypeBadge(log.entityType)}</div>
                            {log.entityName && <div className="text-xs text-gray-500">{log.entityName}</div>}
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="text-gray-300">{log.description}</div>
                          </TableCell>
                          <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                          <TableCell>
                            {log.success ? (
                              <CheckCircle2 className="h-5 w-5 text-green-400" data-testid="icon-success" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-red-400" data-testid="icon-failure" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-400">{t('reports.no_logs')}</h3>
                  <p className="text-gray-500 mt-2">{t('reports.logs')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
