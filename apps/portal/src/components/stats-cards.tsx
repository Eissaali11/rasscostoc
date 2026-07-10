import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardStats } from "@shared/schema";

interface StatsCardsProps {
  stats?: DashboardStats;
  isLoading: boolean;
}

export default function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-12 w-12 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              لا توجد بيانات متاحة
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">إجمالي الأصناف</p>
              <p className="text-3xl font-bold text-foreground" data-testid="text-total-items">
                {stats.totalItems}
              </p>
            </div>
            <div className="bg-primary/10 p-3 rounded-full">
              <div className="text-primary text-xl">📦</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">أصناف منخفضة</p>
              <p className="text-3xl font-bold text-warning" data-testid="text-low-stock-items">
                {stats.lowStockItems}
              </p>
            </div>
            <div className="bg-warning/10 p-3 rounded-full">
              <div className="text-warning text-xl">⚠️</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">أصناف نافدة</p>
              <p className="text-3xl font-bold text-destructive" data-testid="text-out-of-stock-items">
                {stats.outOfStockItems}
              </p>
            </div>
            <div className="bg-destructive/10 p-3 rounded-full">
              <div className="text-destructive text-xl">❌</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">العمليات اليوم</p>
              <p className="text-3xl font-bold text-success" data-testid="text-today-transactions">
                {stats.todayTransactions}
              </p>
            </div>
            <div className="bg-success/10 p-3 rounded-full">
              <div className="text-success text-xl">🔄</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
