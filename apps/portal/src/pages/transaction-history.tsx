import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Filter, TrendingUp, TrendingDown, Users, MapPin, Search, Download, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/language";

type TransactionRow = {
  id: string;
  itemName?: string;
  type: string;
  quantity: number;
  userName?: string;
  regionName?: string;
  reason?: string | null;
  createdAt: string | Date;
};

type TransactionsResponse = {
  transactions: TransactionRow[];
  total: number;
  page: number;
  totalPages: number;
};

type TransactionStats = {
  totalTransactions: number;
  totalAdditions?: number;
  totalWithdrawals?: number;
  totalAddedQuantity?: number;
  totalWithdrawnQuantity?: number;
  byRegion?: Array<{ regionName: string; count: number }>;
  byUser?: Array<{ userName: string; count: number }>;
  totalInbound?: number;
  totalOutbound?: number;
};

type UserOption = { id: string; fullName: string };
type RegionOption = { id: string; name: string };

export function TransactionHistoryPage() {
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? "en-US" : "ar-SA";
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    type: "all",
    userId: "all-users",
    regionId: "all-regions",
    startDate: "",
    endDate: "",
    search: ""
  });

  // Fetch transactions with filters
  // Build query parameters for transactions
  const transactionParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    // Convert "all" values to empty for API and skip empty values
    if (value && value !== "all" && value !== "all-users" && value !== "all-regions") {
      transactionParams.append(key, value.toString());
    }
  });
  const transactionUrl = `/api/transactions${transactionParams.toString() ? `?${transactionParams}` : ''}`;
  
  const { data: transactionData, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery<TransactionsResponse>({
    queryKey: [transactionUrl],
  });

  // Build query parameters for statistics
  const statisticsParams = new URLSearchParams();
  if (filters.startDate) statisticsParams.append('startDate', filters.startDate);
  if (filters.endDate) statisticsParams.append('endDate', filters.endDate);
  if (filters.regionId && filters.regionId !== "all-regions") statisticsParams.append('regionId', filters.regionId);
  const statisticsUrl = `/api/transactions/statistics${statisticsParams.toString() ? `?${statisticsParams}` : ''}`;
  
  // Fetch transaction statistics
  const { data: statisticsData, isLoading: statisticsLoading, refetch: refetchStatistics } = useQuery<TransactionStats>({
    queryKey: [statisticsUrl],
  });

  const totalAdditions = statisticsData?.totalAdditions ?? statisticsData?.totalInbound ?? 0;
  const totalWithdrawals = statisticsData?.totalWithdrawals ?? statisticsData?.totalOutbound ?? 0;
  const totalAddedQuantity = statisticsData?.totalAddedQuantity ?? 0;
  const totalWithdrawnQuantity = statisticsData?.totalWithdrawnQuantity ?? 0;
  const byRegion = statisticsData?.byRegion ?? [];
  const byUser = statisticsData?.byUser ?? [];

  // Fetch users and regions for filter dropdowns
  const { data: users } = useQuery<UserOption[]>({
    queryKey: ['/api/users']
  });

  const { data: regions } = useQuery<RegionOption[]>({
    queryKey: ['/api/regions']
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 10,
      type: "all",
      userId: "all-users",
      regionId: "all-regions",
      startDate: "",
      endDate: "",
      search: ""
    });
  };

  const exportData = () => {
    const exportRows = transactionData?.transactions || [];

    if (exportRows.length === 0) {
      toast({
        variant: "destructive",
        title: t("reports.no_data"),
        description: t("reports.no_transactions_to_export"),
      });
      return;
    }

    // Convert data to CSV format
    const headers = [
      t("reports.csv_date"),
      t("reports.csv_type"),
      t("reports.csv_quantity"),
      t("reports.csv_reason"),
    ];
    const csvContent = [
      headers.join(','),
      ...exportRows.map((tx) => [
        new Date(tx.createdAt).toLocaleString(dateLocale),
        tx.type === 'add' ? t("reports.add") : t("reports.withdraw"),
        tx.quantity,
        tx.reason || ''
      ].join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: t("reports.export_success_title"),
      description: t("reports.export_success_desc"),
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("reports.transaction_history_title")}</h1>
          <p className="text-muted-foreground">{t("reports.transaction_history_subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              refetchTransactions();
              refetchStatistics();
            }}
            data-testid="button-refresh-transactions"
          >
            <RefreshCw className="h-4 w-4 ml-2" />
            {t("reports.refresh")}
          </Button>
          <Button 
            variant="outline" 
            onClick={exportData}
            data-testid="button-export-transactions"
          >
            <Download className="h-4 w-4 ml-2" />
            {t("reports.export_button")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transactions">{t("reports.transactions_tab")}</TabsTrigger>
          <TabsTrigger value="statistics">{t("reports.statistics_tab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          {/* Filters Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                {t("reports.filter_results")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label>{t("reports.search_field")}</Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("reports.search_placeholder")}
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="pr-9"
                      data-testid="input-search-transactions"
                    />
                  </div>
                </div>

                {/* Transaction Type */}
                <div className="space-y-2">
                  <Label>{t("reports.operation_type")}</Label>
                  <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                    <SelectTrigger data-testid="select-transaction-type">
                      <SelectValue placeholder={t("reports.all_operations")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("reports.all_operations")}</SelectItem>
                      <SelectItem value="add">{t("reports.add")}</SelectItem>
                      <SelectItem value="withdraw">{t("reports.withdraw")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* User Filter */}
                <div className="space-y-2">
                  <Label>{t("reports.employee")}</Label>
                  <Select value={filters.userId} onValueChange={(value) => handleFilterChange('userId', value)}>
                    <SelectTrigger data-testid="select-user-filter">
                      <SelectValue placeholder={t("reports.all_employees")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-users">{t("reports.all_employees")}</SelectItem>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Region Filter */}
                <div className="space-y-2">
                  <Label>{t("reports.region")}</Label>
                  <Select value={filters.regionId} onValueChange={(value) => handleFilterChange('regionId', value)}>
                    <SelectTrigger data-testid="select-region-filter">
                      <SelectValue placeholder={t("reports.all_regions")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-regions">{t("reports.all_regions")}</SelectItem>
                      {regions?.map((region) => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <Label>{t("reports.from_date")}</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    data-testid="input-start-date"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <Label>{t("reports.to_date")}</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    data-testid="input-end-date"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center mt-4">
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  data-testid="button-clear-filters"
                >
                  {t("reports.clear_filters")}
                </Button>
                <div className="text-sm text-muted-foreground">
                  {transactionData?.total ? t("reports.transactions_count", { count: transactionData.total }) : ''}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t("reports.search_results")}</CardTitle>
              <CardDescription>
                {t("reports.search_results_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !transactionData?.transactions || transactionData.transactions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">{t("reports.no_matching_transactions")}</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">{t("reports.item")}</TableHead>
                        <TableHead className="text-right">{t("reports.operation_type")}</TableHead>
                        <TableHead className="text-right">{t("reports.quantity")}</TableHead>
                        <TableHead className="text-right">{t("reports.employee")}</TableHead>
                        <TableHead className="text-right">{t("reports.region")}</TableHead>
                        <TableHead className="text-right">{t("reports.reason")}</TableHead>
                        <TableHead className="text-right">{t("reports.date")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionData.transactions.map((transaction: any) => (
                        <TableRow key={transaction.id} data-testid={`row-transaction-${transaction.id}`}>
                          <TableCell className="text-right font-medium">
                            {transaction.itemName}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={transaction.type === "add" ? "default" : "destructive"}>
                              {transaction.type === "add" ? (
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  {t("reports.add")}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <TrendingDown className="h-3 w-3" />
                                  {t("reports.withdraw")}
                                </div>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-medium ${
                              transaction.type === 'add' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'add' ? '+' : '-'}{transaction.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{transaction.userName}</TableCell>
                          <TableCell className="text-right">{transaction.regionName}</TableCell>
                          <TableCell className="text-right">{transaction.reason || t("reports.not_specified")}</TableCell>
                          <TableCell className="text-right">
                            {new Date(transaction.createdAt).toLocaleDateString(dateLocale, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {transactionData.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        {t("reports.page_of", {
                          page: transactionData.page,
                          totalPages: transactionData.totalPages,
                        })}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(transactionData.page - 1)}
                          disabled={transactionData.page <= 1}
                          data-testid="button-previous-page"
                        >
                          {t("reports.previous")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(transactionData.page + 1)}
                          disabled={transactionData.page >= transactionData.totalPages}
                          data-testid="button-next-page"
                        >
                          {t("reports.next")}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          {statisticsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : statisticsData ? (
            <>
              {/* Statistics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="text-2xl font-bold">{statisticsData.totalTransactions}</p>
                        <p className="text-sm text-muted-foreground">{t("reports.total_transactions")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="text-2xl font-bold text-green-600">{totalAdditions}</p>
                        <p className="text-sm text-muted-foreground">{t("reports.add_operations")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-8 w-8 text-red-600" />
                      <div>
                        <p className="text-2xl font-bold text-red-600">{totalWithdrawals}</p>
                        <p className="text-sm text-muted-foreground">{t("reports.withdraw_operations")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 font-bold text-sm">{t("reports.net_short")}</span>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {totalAddedQuantity - totalWithdrawnQuantity}
                        </p>
                        <p className="text-sm text-muted-foreground">{t("reports.net_movement")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Region and User Statistics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      {t("reports.transactions_by_region")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {byRegion.slice(0, 5).map((region: any, index: number) => (
                        <div key={region.regionName} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <span>{region.regionName}</span>
                          </div>
                          <Badge variant="secondary">{region.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {t("reports.most_active_employees")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {byUser.slice(0, 5).map((user, index) => (
                        <div key={user.userName} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <span>{user.userName}</span>
                          </div>
                          <Badge variant="secondary">{user.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t("reports.stats_load_failed")}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
