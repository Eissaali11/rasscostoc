import { SystemAnalyticsService } from "@modules/inventory/infrastructure/services/analytics.service";
import { DashboardController } from "@modules/inventory/presentation/controllers/dashboard.controller";

class DashboardContainer {
  readonly analyticsService = new SystemAnalyticsService();

  readonly dashboardController = new DashboardController(
    this.analyticsService
  );
}

export const dashboardContainer = new DashboardContainer();
export default dashboardContainer;
