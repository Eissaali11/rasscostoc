import { useTranslation } from "@/lib/language";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, LogOut, ArrowRight, Shield, UserCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel, ROLE_BADGE_VARIANTS, type UserRole } from "@shared/roles";

export default function ProfilePage() {
  const { t, dir } = useTranslation();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (!user) {
    return null;
  }

  const userInfo = [
    { label: t('users.name'), value: user.fullName, icon: UserCircle },
    { label: t('users.name_user'), value: user.username, icon: User },
    { label: t('users.role'), value: getRoleLabel(user.role), icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-50" dir={dir}>
      <div className="relative overflow-hidden bg-gradient-to-r from-[#18B2B0] via-teal-500 to-cyan-500 shadow-2xl">
        <div className="absolute inset-0 bg-grid-white/5"></div>
        
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        <div className="container mx-auto px-6 py-12 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                <UserCircle className="h-12 w-12 text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-black text-white drop-shadow-lg">
                  {t('users.file_3')}
                </h1>
                <p className="text-xl text-white/90 mt-2">
                  {t('users.info_4')}
                </p>
              </div>
            </div>
            <Link href="/home">
              <Button 
                variant="outline" 
                className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 shadow-lg"
                data-testid="button-back-home"
              >
                <ArrowRight className="h-5 w-5 ml-2" />
                {t('users.item_6366')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="shadow-2xl border-0 overflow-hidden bg-white/80 backdrop-blur">
            <CardHeader className="bg-gradient-to-r from-[#18B2B0]/10 to-teal-50/50 border-b">
              <CardTitle className="text-3xl text-gray-900 flex items-center gap-3">
                <User className="h-8 w-8 text-[#18B2B0]" />
                {t('users.info_5')}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-8">
              <div className="space-y-6">
                {userInfo.map((info, index) => {
                  const Icon = info.icon;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-teal-50/20 rounded-xl border border-gray-200/50"
                      data-testid={`profile-info-${index}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-[#18B2B0]/10 rounded-lg">
                          <Icon className="h-6 w-6 text-[#18B2B0]" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">{info.label}</p>
                          <p className="text-xl font-bold text-gray-900">{info.value}</p>
                        </div>
                      </div>
                      {info.label === t('users.role') && (
                        <Badge 
                          className={ROLE_BADGE_VARIANTS[user.role as UserRole] || "bg-gray-100 text-gray-700 border-gray-200"}
                        >
                          {info.value}
                        </Badge>
                      )}
                    </motion.div>
                  );
                })}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                  className="pt-6 border-t border-gray-200"
                >
                  <Button
                    onClick={handleLogout}
                    variant="destructive"
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg text-lg py-6"
                    data-testid="button-logout"
                  >
                    <LogOut className="h-5 w-5 ml-2" />
                    {t('users.item_17525')}
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
