import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const isValidLanguage = (lang: any): lang is Language => {
  return lang === 'ar' || lang === 'en';
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'ar';
    try {
      const saved = localStorage.getItem('language');
      if (saved && isValidLanguage(saved)) {
        return saved;
      }
      return 'ar';
    } catch {
      return 'ar';
    }
  });

  const setLanguage = (lang: Language) => {
    if (!isValidLanguage(lang)) {
      console.warn(`Invalid language: ${lang}, falling back to 'ar'`);
      lang = 'ar';
    }
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('language', lang);
      } catch (error) {
        console.warn('Failed to save language preference:', error);
      }
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    }
  }, [language]);

  const t = (key: string): string => {
    const langTranslations = translations[language];
    if (!langTranslations) {
      console.warn(`Missing translations for language: ${language}`);
      return key;
    }
    return langTranslations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ 
      language, 
      setLanguage, 
      t,
      dir: language === 'ar' ? 'rtl' : 'ltr'
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Common
    'app.name': 'نظام إدارة المخزون',
    'app.subtitle': 'مرحباً بك، عيسى الفخاني',
    'home': 'الصفحة الرئيسية',
    'back': 'العودة',
    'save': 'حفظ',
    'cancel': 'إلغاء',
    'delete': 'حذف',
    'edit': 'تعديل',
    'add': 'إضافة',
    'search': 'بحث',
    'filter': 'تصفية',
    'export': 'تصدير',
    'import': 'استيراد',
    'logout': 'تسجيل الخروج',
    'profile': 'الملف الشخصي',
    'settings': 'الإعدادات',
    'notifications': 'الإشعارات',
    'language': 'اللغة',
    'arabic': 'العربية',
    'english': 'English',
    
    // Dashboard
    'dashboard.title': 'لوحة التحكم',
    'dashboard.stats': 'الإحصائيات',
    'dashboard.fixed_inventory': 'المخزون الثابت',
    'dashboard.moving_inventory': 'المخزون المتحرك',
    'dashboard.warehouses': 'المخازن',
    'dashboard.technicians': 'المندوبين',
    
    // Navigation
    'nav.home': 'الصفحة الرئيسية',
    'nav.admin_operations': 'إدارة العمليات',
    'nav.operations': 'العمليات',
    'nav.technician_inventory': 'لوحة مخزون المندوبين',
    'nav.moving_inventory': 'المخزون المتحرك',
    'nav.fixed_inventory': 'المخزون الثابت',
    'nav.devices': 'الأجهزة',
    'nav.notifications': 'الإشعارات',
    'nav.users': 'المستخدمين',
    'nav.warehouses': 'المستودعات',
    'nav.main_menu': 'القائمة الرئيسية',
    
    // Inventory
    'inventory.title': 'المخزون',
    'inventory.fixed': 'المخزون الثابت',
    'inventory.moving': 'المخزون المتحرك',
    'inventory.add_stock': 'إضافة للمخزون',
    'inventory.withdraw': 'سحب من المخزون',
    'inventory.total': 'الإجمالي',
    'inventory.available': 'متوفر',
    'inventory.low': 'منخفض',
    'inventory.out': 'نفذ',
    
    // Warehouses
    'warehouses.title': 'المخازن',
    'warehouses.add': 'إضافة مخزن',
    'warehouses.transfer': 'نقل من المخزن',
    'warehouses.details': 'تفاصيل المخزن',
    
    // Users
    'users.title': 'المستخدمين',
    'users.add': 'إضافة مستخدم',
    'users.technician': 'مندوب',
    'users.supervisor': 'مشرف',
    'users.admin': 'مدير',
    'users.role': 'الدور',
    'users.region': 'المنطقة',
    'users.active': 'نشط',
    'users.inactive': 'غير نشط',
    
    // Regions
    'regions.title': 'المناطق',
    'regions.add': 'إضافة منطقة',
    'regions.name': 'اسم المنطقة',
    'regions.code': 'كود المنطقة',
    
    // Admin
    'admin.title': 'لوحة الإدارة',
    'admin.control': 'التحكم الكامل في النظام',
    'admin.regions': 'إدارة المناطق',
    'admin.users': 'إدارة المستخدمين',
    'admin.system_logs': 'عمليات النظام',
    
    // Products
    'products.n950': 'جهاز N950',
    'products.i9000s': 'جهاز I9000s',
    'products.i9100': 'جهاز I9100',
    'products.roll_paper': 'ورق حراري',
    'products.stickers': 'ملصقات',
    'products.batteries': 'بطاريات جديدة',
    'products.mobily_sim': 'شريحة موبايلي',
    'products.stc_sim': 'شريحة STC',
    'products.zain_sim': 'شريحة زين',
    'products.lebara': 'شريحة ليبارا',
    
    // Units
    'units.box': 'كرتون',
    'units.boxes': 'كراتين',
    'units.unit': 'وحدة',
    'units.units': 'وحدات',
    
    // Actions
    'actions.quick_withdraw': 'سحب من المخزون',
    'actions.quick_add': 'إضافة للمخزون',
    'actions.generate_report': 'تقرير المخزون',
    'actions.view_transactions': 'سجل المعاملات',
    'actions.view_operations': 'العمليات',
    'actions.request_inventory': 'طلب مخزون',
    'actions.view_details': 'عرض التفاصيل',
    'actions.export_excel': 'تصدير Excel',
    
    // Sidebar
    'sidebar.home': 'الصفحة الرئيسية',
    'sidebar.quick_actions': 'إجراءات سريعة',
    'sidebar.my_inventory': 'مخزوني',
    'sidebar.warehouses': 'المخازن',
    'sidebar.operations': 'العمليات',
    'sidebar.admin': 'لوحة الإدارة',
    
    // Dashboard Page
    'dashboard.app_name': 'STOCKPRO نظام إدارة المخزون',
    'dashboard.welcome': 'مرحباً بك',
    'dashboard.admin_panel': 'لوحة التحكم الإدارية',
    'dashboard.personal_panel': 'لوحة التحكم الشخصية',
    'dashboard.account': 'الحساب',
    'dashboard.all_fixed_products': 'جميع المنتجات المخزنة بشكل دائم',
    'dashboard.all_moving_products': 'المنتجات الجاهزة للعمليات الميدانية',
    'dashboard.no_fixed_inventory': 'لا يوجد مخزون ثابت حالياً',
    'dashboard.no_moving_inventory': 'لا يوجد مخزون متحرك حالياً',
    'dashboard.request_inventory_hint': 'يمكنك طلب مخزون جديد من خلال زر "طلب مخزون" أعلاه',
    'dashboard.moving_inventory_hint': 'سيظهر المخزون المتحرك بعد قبول طلبات النقل من المستودعات',
    'dashboard.search_placeholder': 'بحث بالاسم أو المدينة...',
    'dashboard.warehouse_management': 'إدارة المستودعات',
    'dashboard.no_warehouses_found': 'لا توجد مستودعات مطابقة للبحث',
    'dashboard.try_other_search': 'جرب كلمات بحث أخرى',
    'dashboard.technicians_panel': 'لوحة المندوبين',
    'dashboard.technicians_overview': 'نظرة شاملة على مخزون جميع المندوبين',
    'dashboard.no_technicians_found': 'لا يوجد مندوبين مطابقين للبحث',
    'dashboard.report_date': 'تاريخ التقرير: ',
    'dashboard.report_filename': 'تقرير_المخزون_',
    
    // Messages
    'messages.success': 'تمت العملية بنجاح',
    'messages.error': 'حدث خطأ',
    'messages.loading': 'جاري التحميل...',
    'messages.loading_products': 'جاري تحميل المنتجات...',
    'messages.no_data': 'لا توجد بيانات',
    'messages.confirm_delete': 'هل أنت متأكد من الحذف؟',
    
    // Landing Page
    'landing.hero.title': 'نظام StockPro المتطور',
    'landing.hero.subtitle': 'إدارة المخزون بذكاء وكفاءة',
    'landing.hero.description': 'نظام شامل لإدارة المخزون الثابت والمتحرك مع أدوات متقدمة للتحليل والتقارير',
    'landing.hero.cta_login': 'تسجيل الدخول',
    'landing.hero.cta_demo': 'جرّب النظام',
    
    'landing.features.title': 'منظومة متكاملة من الحلول الذكية',
    'landing.features.subtitle': 'تقنيات متطورة تُعيد تعريف مفهوم إدارة المخزون الحديثة',
    
    'landing.feature.dual_inventory.title': 'إدارة ثنائية متقدمة',
    'landing.feature.dual_inventory.description': 'نظام فريد يجمع بين المخزون الثابت والمتحرك في منصة واحدة، مع آليات تتبع دقيقة لكل عملية وحركة في الوقت الفعلي',
    
    'landing.feature.roles.title': 'تحكم هرمي متطور',
    'landing.feature.roles.description': 'هيكلية صلاحيات ثلاثية المستويات توفر أمان محكم ومرونة كاملة، من المدير إلى المشرف وصولاً للمندوب',
    
    'landing.feature.warehouses.title': 'منظومة مستودعات ذكية',
    'landing.feature.warehouses.description': 'نظام شامل لتتبع وإدارة المستودعات مزود بآلية موافقات ذكية تضمن سلاسة عمليات النقل والتحويل',
    
    'landing.feature.analytics.title': 'رؤى تحليلية بصرية',
    'landing.feature.analytics.description': 'لوحات معلومات تفاعلية غنية بالمخططات البيانية الديناميكية ومؤشرات الأداء الرئيسية لقرارات استراتيجية أذكى',
    
    'landing.feature.excel.title': 'تقارير احترافية متقدمة',
    'landing.feature.excel.description': 'تصدير فوري لتقارير مفصلة بصيغة Excel مع تنسيق احترافي متقن يسهل التحليل والمشاركة',
    
    'landing.feature.bilingual.title': 'تجربة ثنائية اللغة',
    'landing.feature.bilingual.description': 'واجهة متكاملة باللغتين العربية والإنجليزية مع خاصية التبديل الفوري لتجربة استخدام عالمية',
    
    'landing.feature.realtime.title': 'إشعارات ذكية فورية',
    'landing.feature.realtime.description': 'نظام تنبيهات متقدم يوفر إشعارات آنية لكل العمليات الحيوية، لتبقى على اطلاع دائم بكل جديد',
    
    'landing.feature.mobile.title': 'تصميم عصري متجاوب',
    'landing.feature.mobile.description': 'تجربة مستخدم سلسة وأنيقة على جميع الأجهزة والشاشات، من الهاتف الذكي إلى الحاسب المكتبي',
    
    'landing.stats.warehouses': 'مستودعات رئيسية وفرعية',
    'landing.stats.products': 'أصناف المنتجات المعرفة',
    'landing.stats.technicians': 'مناديب نشطين بالعهد',
    'landing.stats.cities': 'مدن مغطاة بالخدمة',
    
    'landing.cta.title': 'ابدأ في إدارة مخزونك اليوم',
    'landing.cta.description': 'انضم إلى مئات الشركات التي تستخدم StockPro',
    'landing.cta.button': 'ابدأ الآن',
    'landing.cta.button_primary': 'ابدأ الآن معنا',
    
    'landing.contact.title': 'تواصل معنا',
    'landing.contact.subtitle': 'نحن هنا للإجابة على استفساراتك ومساعدتك',
    'landing.contact.email': 'البريد الإلكتروني',
    'landing.contact.linkedin': 'لينكد إن',
    'landing.contact.phone': 'رقم الهاتف',
    
    'landing.footer.powered_by': 'مدعوم من RASSCO',
    'landing.footer.rights': 'جميع الحقوق محفوظة',
  },
  en: {
    // Common
    'app.name': 'Inventory Management System',
    'app.subtitle': 'Welcome, Eissa Al-Fakhani',
    'home': 'Home',
    'back': 'Back',
    'save': 'Save',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'edit': 'Edit',
    'add': 'Add',
    'search': 'Search',
    'filter': 'Filter',
    'export': 'Export',
    'import': 'Import',
    'logout': 'Logout',
    'profile': 'Profile',
    'settings': 'Settings',
    'notifications': 'Notifications',
    'language': 'Language',
    'arabic': 'العربية',
    'english': 'English',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.stats': 'Statistics',
    'dashboard.fixed_inventory': 'Fixed Inventory',
    'dashboard.moving_inventory': 'Moving Inventory',
    'dashboard.warehouses': 'Warehouses',
    'dashboard.technicians': 'Technicians',
    
    // Navigation
    'nav.home': 'Home',
    'nav.admin_operations': 'Operations Management',
    'nav.operations': 'Operations',
    'nav.technician_inventory': 'Technician Inventory Dashboard',
    'nav.moving_inventory': 'Moving Inventory',
    'nav.fixed_inventory': 'Fixed Inventory',
    'nav.devices': 'Devices',
    'nav.notifications': 'Notifications',
    'nav.users': 'Users',
    'nav.warehouses': 'Warehouses',
    'nav.main_menu': 'Main Menu',
    
    // Inventory
    'inventory.title': 'Inventory',
    'inventory.fixed': 'Fixed Inventory',
    'inventory.moving': 'Moving Inventory',
    'inventory.add_stock': 'Add Stock',
    'inventory.withdraw': 'Withdraw',
    'inventory.total': 'Total',
    'inventory.available': 'Available',
    'inventory.low': 'Low',
    'inventory.out': 'Out of Stock',
    
    // Warehouses
    'warehouses.title': 'Warehouses',
    'warehouses.add': 'Add Warehouse',
    'warehouses.transfer': 'Transfer from Warehouse',
    'warehouses.details': 'Warehouse Details',
    
    // Users
    'users.title': 'Users',
    'users.add': 'Add User',
    'users.technician': 'Technician',
    'users.supervisor': 'Supervisor',
    'users.admin': 'Administrator',
    'users.role': 'Role',
    'users.region': 'Region',
    'users.active': 'Active',
    'users.inactive': 'Inactive',
    
    // Regions
    'regions.title': 'Regions',
    'regions.add': 'Add Region',
    'regions.name': 'Region Name',
    'regions.code': 'Region Code',
    
    // Admin
    'admin.title': 'Admin Panel',
    'admin.control': 'Full System Control',
    'admin.regions': 'Manage Regions',
    'admin.users': 'Manage Users',
    'admin.system_logs': 'System Operations',
    
    // Products
    'products.n950': 'N950 Device',
    'products.i9000s': 'I9000s Device',
    'products.i9100': 'I9100 Device',
    'products.roll_paper': 'Roll Paper',
    'products.stickers': 'Stickers',
    'products.batteries': 'New Batteries',
    'products.mobily_sim': 'Mobily SIM',
    'products.stc_sim': 'STC SIM',
    'products.zain_sim': 'Zain SIM',
    
    // Units
    'units.box': 'Box',
    'units.boxes': 'Boxes',
    'units.unit': 'Unit',
    'units.units': 'Units',
    
    // Actions
    'actions.quick_withdraw': 'Quick Withdraw',
    'actions.quick_add': 'Quick Add Stock',
    'actions.generate_report': 'Generate Report',
    'actions.view_transactions': 'View Transactions',
    'actions.view_operations': 'Operations',
    'actions.request_inventory': 'Request Inventory',
    'actions.view_details': 'View Details',
    'actions.export_excel': 'Export Excel',
    
    // Sidebar
    'sidebar.home': 'Home',
    'sidebar.quick_actions': 'Quick Actions',
    'sidebar.my_inventory': 'My Inventory',
    'sidebar.warehouses': 'Warehouses',
    'sidebar.operations': 'Operations',
    'sidebar.admin': 'Admin Panel',
    
    // Dashboard Page
    'dashboard.app_name': 'STOCKPRO Inventory Management System',
    'dashboard.welcome': 'Welcome',
    'dashboard.admin_panel': 'Admin Control Panel',
    'dashboard.personal_panel': 'Personal Dashboard',
    'dashboard.account': 'Account',
    'dashboard.all_fixed_products': 'All permanently stored products',
    'dashboard.all_moving_products': 'Products ready for field operations',
    'dashboard.no_fixed_inventory': 'No fixed inventory available',
    'dashboard.no_moving_inventory': 'No moving inventory available',
    'dashboard.request_inventory_hint': 'You can request new inventory using the "Request Inventory" button above',
    'dashboard.moving_inventory_hint': 'Moving inventory will appear after warehouse transfer requests are accepted',
    'dashboard.search_placeholder': 'Search by name or city...',
    'dashboard.warehouse_management': 'Warehouse Management',
    'dashboard.no_warehouses_found': 'No warehouses match your search',
    'dashboard.try_other_search': 'Try different search terms',
    'dashboard.technicians_panel': 'Technicians Panel',
    'dashboard.technicians_overview': 'Comprehensive view of all technicians inventory',
    'dashboard.no_technicians_found': 'No technicians match your search',
    'dashboard.report_date': 'Report Date: ',
    'dashboard.report_filename': 'inventory_report_',
    
    // Messages
    'messages.success': 'Operation successful',
    'messages.error': 'An error occurred',
    'messages.loading': 'Loading...',
    'messages.loading_products': 'Loading products...',
    'messages.no_data': 'No data available',
    'messages.confirm_delete': 'Are you sure you want to delete?',
    
    // Landing Page
    'landing.hero.title': 'Advanced StockPro System',
    'landing.hero.subtitle': 'Smart & Efficient Inventory Management',
    'landing.hero.description': 'Comprehensive system for managing fixed and moving inventory with advanced analytics and reporting tools',
    'landing.hero.cta_login': 'Login',
    'landing.hero.cta_demo': 'Try Demo',
    
    'landing.features.title': 'Integrated Ecosystem of Intelligent Solutions',
    'landing.features.subtitle': 'Advanced technologies redefining modern inventory management',
    
    'landing.feature.dual_inventory.title': 'Advanced Dual Management',
    'landing.feature.dual_inventory.description': 'Unique system combining fixed and moving inventory in one platform, with precise tracking mechanisms for every operation in real-time',
    
    'landing.feature.roles.title': 'Sophisticated Hierarchical Control',
    'landing.feature.roles.description': 'Three-tier permission structure providing robust security and complete flexibility, from Admin to Supervisor down to Technician',
    
    'landing.feature.warehouses.title': 'Intelligent Warehouse Ecosystem',
    'landing.feature.warehouses.description': 'Comprehensive system for warehouse tracking and management equipped with smart approval mechanisms ensuring seamless transfer operations',
    
    'landing.feature.analytics.title': 'Visual Analytical Insights',
    'landing.feature.analytics.description': 'Interactive dashboards rich with dynamic charts and key performance indicators for smarter strategic decisions',
    
    'landing.feature.excel.title': 'Advanced Professional Reports',
    'landing.feature.excel.description': 'Instant export of detailed reports in Excel format with refined professional formatting for easy analysis and sharing',
    
    'landing.feature.bilingual.title': 'Bilingual Experience',
    'landing.feature.bilingual.description': 'Complete interface in Arabic and English with instant switching capability for a truly global user experience',
    
    'landing.feature.realtime.title': 'Smart Instant Notifications',
    'landing.feature.realtime.description': 'Advanced alert system providing instant notifications for all critical operations, keeping you constantly informed',
    
    'landing.feature.mobile.title': 'Modern Responsive Design',
    'landing.feature.mobile.description': 'Smooth and elegant user experience across all devices and screens, from smartphone to desktop computer',
    
    'landing.stats.warehouses': 'Active Warehouses',
    'landing.stats.products': 'Product Categories',
    'landing.stats.technicians': 'Active Technicians',
    'landing.stats.cities': 'Covered Cities',
    
    'landing.cta.title': 'Start Managing Your Inventory Today',
    'landing.cta.description': 'Join hundreds of companies using StockPro',
    'landing.cta.button': 'Get Started',
    'landing.cta.button_primary': 'Start Now With Us',
    
    'landing.contact.title': 'Get In Touch',
    'landing.contact.subtitle': 'We are here to answer your questions and help you',
    'landing.contact.email': 'Email',
    'landing.contact.linkedin': 'LinkedIn',
    'landing.contact.phone': 'Phone Number',
    
    'landing.footer.powered_by': 'Powered by RASSCO',
    'landing.footer.rights': 'All Rights Reserved',
  }
};

