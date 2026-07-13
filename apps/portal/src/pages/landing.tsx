import { motion } from "framer-motion";
import { useLanguage } from "@/lib/language";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import stockProLogo from "@assets/image_1763138350041.png";
import stockproDashboardShowcase from "@assets/stockpro_dashboard_showcase.png";
import { 
  Package, 
  Users, 
  Warehouse, 
  BarChart3, 
  FileSpreadsheet, 
  Globe, 
  Bell, 
  Smartphone,
  Mail,
  Linkedin,
  Phone,
  LogIn,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./landing.css";

export default function LandingPage() {
  const { t, language, changeLanguage } = useLanguage();
  const [, setLocation] = useLocation();
  const statsRef = useRef<HTMLDivElement>(null);
  const [isStatsInView, setIsStatsInView] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  
  // Dynamic data states
  const [liveStats, setLiveStats] = useState({
    warehouses: 9,
    products: 14,
    technicians: 65,
    cities: 29
  });
  const [liveProducts, setLiveProducts] = useState<any[]>([]);

  // Fetch live stats and product catalog from database
  useEffect(() => {
    fetch("/api/public/stock")
      .then(res => res.json())
      .then(data => {
        if (data.stats) {
          setLiveStats(data.stats);
        }
        if (data.products) {
          setLiveProducts(data.products);
        }
      })
      .catch(err => console.error("Error fetching live stock stats:", err));
  }, []);

  const features = [
    {
      icon: Package,
      titleKey: 'landing.feature.dual_inventory.title',
      descKey: 'landing.feature.dual_inventory.description',
      color: 'from-cyan-400 to-blue-500'
    },
    {
      icon: Users,
      titleKey: 'landing.feature.roles.title',
      descKey: 'landing.feature.roles.description',
      color: 'from-purple-400 to-pink-500'
    },
    {
      icon: Warehouse,
      titleKey: 'landing.feature.warehouses.title',
      descKey: 'landing.feature.warehouses.description',
      color: 'from-orange-400 to-red-500'
    },
    {
      icon: BarChart3,
      titleKey: 'landing.feature.analytics.title',
      descKey: 'landing.feature.analytics.description',
      color: 'from-green-400 to-emerald-500'
    },
    {
      icon: FileSpreadsheet,
      titleKey: 'landing.feature.excel.title',
      descKey: 'landing.feature.excel.description',
      color: 'from-blue-400 to-indigo-500'
    },
    {
      icon: Globe,
      titleKey: 'landing.feature.bilingual.title',
      descKey: 'landing.feature.bilingual.description',
      color: 'from-teal-400 to-cyan-500'
    },
    {
      icon: Bell,
      titleKey: 'landing.feature.realtime.title',
      descKey: 'landing.feature.realtime.description',
      color: 'from-yellow-400 to-orange-500'
    },
    {
      icon: Smartphone,
      titleKey: 'landing.feature.mobile.title',
      descKey: 'landing.feature.mobile.description',
      color: 'from-pink-400 to-rose-500'
    }
  ];

  const stats = [
    { labelKey: 'landing.stats.warehouses' },
    { labelKey: 'landing.stats.products' },
    { labelKey: 'landing.stats.technicians' },
    { labelKey: 'landing.stats.cities' }
  ];

  const [animatedStats, setAnimatedStats] = useState([0, 0, 0, 0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsStatsInView(true);
          setHasAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasAnimated]);

  useEffect(() => {
    if (!isStatsInView) return;
    
    // Animate up to the live stats values loaded from database
    const targets = [
      liveStats.warehouses,
      liveStats.products,
      liveStats.technicians,
      liveStats.cities
    ];
    const durations = [1000, 1200, 1500, 1100];
    const timers: ReturnType<typeof setInterval>[] = [];
    
    targets.forEach((target, index) => {
      let current = 0;
      const increment = Math.max(1, target / (durations[index] / 16));
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        setAnimatedStats(prev => {
          const newStats = [...prev];
          newStats[index] = Math.floor(current);
          return newStats;
        });
      }, 16);
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearInterval(timer));
    };
  }, [isStatsInView, liveStats]);

  return (
    <div className="landing-body">
      <div className="glow-overlay" />
      <div className="grid-background" />
      
      <div className="relative z-10">
        {/* Navbar */}
        <header className="container mx-auto px-4 py-6">
          <nav className="landing-nav">
            <div className="flex items-center gap-3">
              <img src={stockProLogo} alt="Stock Pro" className="h-12 w-12 rounded-full object-contain bg-gray-950 p-1 border border-[#18B2B0]/30" />
              <span className="brand-text">StockPro</span>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => changeLanguage(language === 'ar' ? 'en' : 'ar')}
                variant="ghost"
                size="sm"
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl"
                data-testid="landing-language-toggle"
              >
                <Globe className="w-4 h-4 mr-2" />
                {language === 'ar' ? 'EN' : 'AR'}
              </Button>
              <Button 
                onClick={() => setLocation("/login")}
                size="sm"
                className="bg-gradient-to-r from-[#18B2B0] to-cyan-500 hover:from-[#0ea5a3] hover:to-cyan-400 text-white font-bold rounded-xl px-4 py-2 flex items-center gap-1.5 shadow-lg shadow-[#18B2B0]/20"
              >
                <LogIn size={16} />
                <span>{language === 'ar' ? t('common.item_6377') : 'Login'}</span>
              </Button>
            </div>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 lg:py-24">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
            
            {/* Left Content (Text) */}
            <div className={language === 'ar' ? 'text-right lg:pl-8' : 'text-left lg:pr-8'}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#18B2B0]/10 border border-[#18B2B0]/30 text-[#18B2B0] text-sm font-semibold mb-6"
              >
                <Sparkles size={14} className="animate-pulse" />
                <span>{language === 'ar' ? t('common.item_20903') : 'Enterprise Smart Version 2.0'}</span>
              </motion.div>

              <motion.h1 
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl lg:text-6xl font-black mb-6 leading-tight"
              >
                <span className="gradient-title">
                  {t('landing.hero.title')}
                </span>
              </motion.h1>

              <motion.p 
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-2xl text-[#18B2B0] font-bold mb-4"
              >
                {t('landing.hero.subtitle')}
              </motion.p>

              <motion.p 
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-lg text-gray-300 leading-relaxed mb-8 max-w-xl"
              >
                {language === 'ar' 
                  ? t('common.system_completed_time')
                  : 'A comprehensive system and integrated solution specially built to track serialized technical assets, smart devices, and technician custodies in real-time with direct AI integrations.'}
              </motion.p>

              <motion.div 
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-wrap gap-4"
              >
                <Button 
                  onClick={() => setLocation("/login")}
                  size="lg"
                  className="btn-premium flex items-center gap-2 text-base px-8 py-6"
                >
                  <span>{language === 'ar' ? t('common.item_27165') : 'Login to System'}</span>
                  <ArrowRight size={18} className={language === 'ar' ? 'rotate-180' : ''} />
                </Button>
                <a href="#features">
                  <Button 
                    variant="outline"
                    size="lg"
                    className="border-white/10 hover:border-[#18B2B0]/40 text-white bg-white/5 hover:bg-white/10 rounded-xl px-8 py-6 text-base"
                  >
                    {language === 'ar' ? t('common.item_22248') : 'Explore Features'}
                  </Button>
                </a>
              </motion.div>
            </div>

            {/* Right Content (Showcase Image) */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#18B2B0]/30 via-cyan-500/10 to-transparent rounded-[32px] blur-2xl pointer-events-none" />
              
              {/* Floating Decorative Elements */}
              <motion.div 
                className="absolute top-10 left-6 z-20"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="bg-gray-950/90 backdrop-blur-md border border-[#18B2B0]/30 rounded-2xl p-3 flex items-center gap-2 text-white">
                  <Warehouse className="text-[#18B2B0]" size={20} />
                  <span className="text-xs font-bold">{language === 'ar' ? t('common.warehouses') : 'Warehouses'}</span>
                </div>
              </motion.div>

              <motion.div 
                className="absolute bottom-10 right-6 z-20"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                <div className="bg-gray-950/90 backdrop-blur-md border border-[#18B2B0]/30 rounded-2xl p-3 flex items-center gap-2 text-white">
                  <Users className="text-cyan-400" size={20} />
                  <span className="text-xs font-bold">{language === 'ar' ? t('common.item_17567') : 'Custody'}</span>
                </div>
              </motion.div>

              {/* Showcase Image Frame */}
              <div className="showcase-wrapper floating-element">
                <img 
                  src={stockproDashboardShowcase} 
                  alt="StockPro Dashboard Showcase" 
                  className="w-full h-auto object-cover transform hover:scale-105 transition-transform duration-700 max-w-[540px] rounded-[32px]"
                />
                <div className="showcase-glow" />
              </div>
            </motion.div>

          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-4 py-20">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-black mb-4 bg-gradient-to-r from-[#18B2B0] via-cyan-400 to-[#18B2B0] bg-clip-text text-transparent">
              {t('landing.features.title')}
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="glass-card p-6 h-full border-white/5 hover:border-[#18B2B0]/30 transition-all duration-300">
                  <div className="feature-icon-wrapper">
                    <feature.icon size={26} />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-gray-300 leading-relaxed text-sm">
                    {t(feature.descKey)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Statistics Section (Count-up numbers matching production data) */}
        <section ref={statsRef} className="container mx-auto px-4 py-20">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="stats-container"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="stat-num mb-2">
                    {animatedStats[index]}+
                  </div>
                  <div className="text-gray-300 text-base font-semibold">
                    {t(stat.labelKey)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Live Product Catalog Section */}
        {liveProducts.length > 0 && (
          <section className="container mx-auto px-4 py-20 border-t border-white/5">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl lg:text-5xl font-black mb-4 bg-gradient-to-r from-[#18B2B0] to-cyan-400 bg-clip-text text-transparent">
                {language === 'ar' ? t('common.item_31900') : 'Live Product Catalog'}
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                {language === 'ar' 
                  ? t('common.data_system') 
                  : 'Active product models and categories configured and tracked in the platform database'}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {liveProducts.map((prod, idx) => (
                <motion.div
                  key={prod.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                >
                  <div className="glass-card p-6 border-white/5 flex items-center justify-between hover:border-[#18B2B0]/40 hover:scale-[1.03] transition-all">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl p-3 bg-white/5 rounded-2xl border border-white/10 block">{prod.icon || '📦'}</span>
                      <div>
                        <h4 className="font-bold text-white text-lg">
                          {language === 'ar' ? prod.nameAr : prod.nameEn}
                        </h4>
                        <span className="text-xs text-[#18B2B0] uppercase tracking-wider font-semibold">
                          {prod.category}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {language === 'ar' ? t('common.active_1') : 'Active'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* CTA Banner */}
        <section className="container mx-auto px-4 py-20">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative glass-card p-8 lg:p-16 border-white/10 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-br from-[#18B2B0]/10 to-cyan-500/10 rounded-full blur-3xl" />
            
            <div className="relative grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-12 items-center">
              <div className={language === 'ar' ? 'text-right' : 'text-left'}>
                <h2 className="text-3xl lg:text-5xl font-black mb-4 text-white leading-tight">
                  {t('landing.cta.title')}
                </h2>
                <p className="text-lg text-gray-300 mb-8 max-w-xl">
                  {t('landing.cta.description')}
                </p>
                <Button 
                  onClick={() => setLocation("/login")}
                  size="lg"
                  className="btn-premium text-base lg:text-lg px-8 py-6 shadow-lg shadow-[#18B2B0]/30"
                  data-testid="button-start-now"
                >
                  {t('landing.cta.button_primary')}
                </Button>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-600/10 to-transparent rounded-full blur-2xl" />
                
                <motion.div 
                  className="absolute top-8 left-0"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-full p-3">
                    <Warehouse className="text-[#18B2B0]" size={24} />
                  </div>
                </motion.div>

                <motion.div 
                  className="absolute top-4 right-0"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                >
                  <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-full p-3">
                    <Users className="text-cyan-400" size={24} />
                  </div>
                </motion.div>

                <motion.div
                  className="relative h-48 w-48 lg:h-64 lg:w-64 rounded-full bg-gradient-to-br from-[#18B2B0]/20 via-cyan-500/10 to-transparent border border-[#18B2B0]/20 flex items-center justify-center p-4"
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <img 
                    src={stockProLogo} 
                    alt="Stock Pro Logo" 
                    className="h-32 w-32 lg:h-44 lg:w-44 object-contain rounded-full bg-gray-950 p-2 border border-[#18B2B0]/25"
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="container mx-auto px-4 py-20">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl lg:text-5xl font-black mb-4 bg-gradient-to-r from-[#18B2B0] via-cyan-400 to-[#18B2B0] bg-clip-text text-transparent">
              {t('landing.contact.title')}
            </h2>
            <p className="text-xl text-gray-400">
              {t('landing.contact.subtitle')}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <motion.a
              href="mailto:skrkhtan@gmail.com"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="group block"
            >
              <div className="glass-card p-6 h-full text-center border-white/5 hover:border-[#18B2B0]/30 transition-all duration-300 cursor-pointer">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 p-0.5 mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <div className="w-full h-full rounded-2xl bg-gray-950 flex items-center justify-center">
                    <Mail className="text-white" size={24} />
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2 text-[#18B2B0]">
                  {t('landing.contact.email')}
                </h3>
                <p className="text-gray-300 text-sm break-all">
                  skrkhtan@gmail.com
                </p>
              </div>
            </motion.a>

            <motion.a
              href="https://www.linkedin.com/in/eissa-ail-816947257/"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="group block"
            >
              <div className="glass-card p-6 h-full text-center border-white/5 hover:border-[#18B2B0]/30 transition-all duration-300 cursor-pointer">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-0.5 mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <div className="w-full h-full rounded-2xl bg-gray-950 flex items-center justify-center">
                    <Linkedin className="text-white" size={24} />
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2 text-[#18B2B0]">
                  {t('landing.contact.linkedin')}
                </h3>
                <p className="text-gray-300 text-sm">
                  Eissa Ail
                </p>
              </div>
            </motion.a>

            <motion.a
              href="tel:+966558619232"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="group block"
            >
              <div className="glass-card p-6 h-full text-center border-white/5 hover:border-[#18B2B0]/30 transition-all duration-300 cursor-pointer">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 p-0.5 mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <div className="w-full h-full rounded-2xl bg-gray-950 flex items-center justify-center">
                    <Phone className="text-white" size={24} />
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2 text-[#18B2B0]">
                  {t('landing.contact.phone')}
                </h3>
                <p className="text-gray-300 text-sm" dir="ltr">
                  +966 558 619 232
                </p>
              </div>
            </motion.a>
          </div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-12 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={stockProLogo} alt="Stock Pro" className="h-14 w-14 rounded-full object-contain bg-gray-950 p-1 border border-white/10" />
              <span className="text-lg font-bold text-white">StockPro</span>
            </div>
            <div className="text-sm text-gray-500">
              StockPro v2.0 &bull; {language === 'ar' ? t('common.item_25588') : 'All Rights Reserved'}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
