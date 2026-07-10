import { NAVIGATION_ITEMS } from "./navigation.registry";
import { NavigationItem } from "./navigation.types";

export class NavigationService {
  static getAuthorizedNavigation(role: string): NavigationItem[] {
    return NAVIGATION_ITEMS.filter((item) => item.roles.includes(role));
  }
}
