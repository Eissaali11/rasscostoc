import { Bell, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Header() {
  const { logout, user } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "تم تسجيل الخروج بنجاح",
        description: "شكراً لك على استخدام النظام",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ في تسجيل الخروج",
        description: "حدث خطأ غير متوقع",
      });
    }
  };

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-3 space-x-reverse min-w-0">
            <img 
              src="/attached_assets/neoleap-logo.jpg" 
              alt="Neoleap" 
              className="h-8 sm:h-10 md:h-12 w-auto object-contain flex-shrink-0"
            />
            <h1 className="text-sm sm:text-lg md:text-xl font-bold text-foreground truncate">
              <span className="hidden sm:inline">نظام </span>إدارة المخزون
            </h1>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4 space-x-reverse flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 sm:h-10 sm:w-10"
              data-testid="button-notifications"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center text-[10px] sm:text-xs">
                3
              </span>
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-1 sm:space-x-2 space-x-reverse px-2 sm:px-3" data-testid="button-user-menu">
                  <img 
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=40&h=40" 
                    alt="صورة المستخدم" 
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0" 
                  />
                  <span className="text-xs sm:text-sm font-medium hidden xs:inline">{user?.fullName || 'المستخدم'}</span>
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 hidden xs:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem data-testid="link-profile">الملف الشخصي</DropdownMenuItem>
                <DropdownMenuItem data-testid="link-settings">الإعدادات</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive cursor-pointer" 
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
