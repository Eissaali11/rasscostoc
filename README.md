# نظام إدارة المخزون للمندوبين

## 📋 نظرة عامة

نظام شامل لإدارة مخزون المندوبين مبني بتقنيات حديثة، يوفر تتبع مزدوج للمخزون (الثابت والمتحرك) مع واجهة باللغة العربية وتصميم متجاوب بالكامل.

### ✨ المميزات الرئيسية

- **نظام مخزون مزدوج**: تتبع منفصل للمخزون الثابت (Fixed) والمخزون المتحرك (Moving)
- **إدارة المستخدمين**: نظام صلاحيات متقدم (Admin/Employee)
- **تتبع المندوبين**: إدارة مفصلة لمخزون كل مندوب على حدة
- **تنبيهات ذكية**: إشعارات تلقائية عند انخفاض المخزون بألوان مميزة
- **سجل المعاملات**: تتبع كامل لجميع العمليات مع الأسباب
- **تصدير Excel**: إمكانية تصدير التقارير بصيغة Excel احترافية
- **تصميم متجاوب**: يعمل بكفاءة على جميع الأجهزة (جوال، تابلت، كمبيوتر)
- **واجهة عربية**: دعم كامل للغة العربية مع تخطيط RTL

---

## 🚀 البدء السريع

### المتطلبات الأساسية

- Node.js 22 LTS (يُدعم أيضاً 24 و 26+ — راجع `.nvmrc`). الإصدارات الفردية مثل 23 و 25 غير مدعومة من أدوات البناء.
- PostgreSQL Database
- npm أو yarn

### التثبيت

```bash
# استخدم إصدار Node الصحيح (يقرأ .nvmrc)
nvm use

# تثبيت المكتبات
npm install

# إعداد قاعدة البيانات
npm run db:push

# تشغيل المشروع في بيئة التطوير
npm run dev
```

### متغيرات البيئة المطلوبة

```env
DATABASE_URL=postgresql://user:password@host:port/database
SESSION_SECRET=your-secret-key
PORT=5000
NODE_ENV=development
```

---

## 📱 دليل الاستخدام

### 1. تسجيل الدخول

1. افتح التطبيق على المتصفح
2. أدخل اسم المستخدم وكلمة المرور
3. اضغط على "تسجيل الدخول"

**ملاحظة**: يجب على المسؤول إنشاء حساب المستخدم الأول من قاعدة البيانات

### 2. لوحة التحكم (Dashboard)

#### للمسؤول (Admin):
- **نظرة عامة على المخزون**: عرض مخزون جميع المندوبين
- **تنبيهات ملونة**:
  - 🟢 أخضر: المخزون جيد (أكثر من 70%)
  - 🟡 أصفر: تحذير (30-70%)
  - 🔴 أحمر: حرج (أقل من 30%)
- **إحصائيات مباشرة**: عدد المندوبين، إجمالي المخزون، التنبيهات

#### للموظف (Employee):
- عرض المخزون الخاص به فقط
- إمكانية تحديث المخزون المتحرك
- عرض سجل المعاملات الخاصة به

### 3. إدارة المخزون الثابت (Fixed Inventory)

**الوصول**: القائمة الجانبية > المخزون الثابت

#### إضافة/تعديل المخزون الثابت:
1. اختر المندوب من القائمة
2. أدخل الكميات بالصناديق والوحدات:
   - **أجهزة N950**: صناديق ووحدات
   - **أجهزة I900**: صناديق ووحدات
   - **أوراق رول**: صناديق ووحدات
   - **ملصقات**: صناديق ووحدات
   - **شرائح موبايلي**: صناديق ووحدات
   - **شرائح STC**: صناديق ووحدات
3. حدد نسب التنبيه (اختياري)
4. اضغط "حفظ"

**ملاحظة هامة**: المخزون الثابت يُدخل يدوياً ولا يتأثر إلا بالتحديثات المباشرة

### 4. إدارة المخزون المتحرك (Moving Inventory)

**الوصول**: القائمة الجانبية > المخزون المتحرك

#### نقل من الثابت إلى المتحرك:
1. افتح صفحة المخزون المتحرك
2. اختر "تحديث المخزون"
3. أدخل الكميات المراد نقلها
4. أدخل السبب (إجباري)
5. اضغط "تحويل إلى المخزون المتحرك"

**ملاحظة**: عند النقل من الثابت للمتحرك:
- ✅ يتم الخصم تلقائياً من المخزون الثابت
- ✅ يتم الإضافة للمخزون المتحرك
- ✅ يتم تسجيل العملية في السجل

#### تحديث المخزون المتحرك مباشرة:
1. اختر "تحديث المخزون"
2. اختر نوع العملية: "إضافة" أو "خصم"
3. أدخل الكميات
4. أدخل السبب
5. اضغط "حفظ"

**ملاحظة**: التحديثات المباشرة على المخزون المتحرك لا تؤثر على المخزون الثابت

### 5. إدارة المستخدمين

**الوصول**: القائمة الجانبية > المستخدمين (Admin فقط)

#### إضافة مستخدم جديد:
1. اضغط "إضافة مستخدم"
2. املأ البيانات:
   - **الاسم الكامل** (إجباري)
   - **اسم المستخدم** (إجباري، فريد)
   - **البريد الإلكتروني** (إجباري، فريد)
   - **كلمة المرور** (إجباري)
   - **المدينة** (اختياري)
   - **الصلاحية**: Admin أو Employee
   - **المنطقة** (اختياري)
3. اضغط "حفظ"

#### تعديل مستخدم:
1. اضغط على أيقونة التعديل بجانب المستخدم
2. عدّل البيانات المطلوبة
3. اضغط "حفظ"

#### حذف مستخدم:
1. اضغط على أيقونة الحذف
2. أكد عملية الحذف

### 6. إدارة المناطق

**الوصول**: القائمة الجانبية > المناطق (Admin فقط)

#### إضافة منطقة:
1. اضغط "إضافة منطقة"
2. أدخل اسم المنطقة والوصف
3. اضغط "حفظ"

**ملاحظة**: لا يمكن حذف منطقة تحتوي على مستخدمين أو مخزون

### 7. الأجهزة المسحوبة

**الوصول**: القائمة الجانبية > الأجهزة المسحوبة

#### تسجيل جهاز مسحوب:
1. اضغط "إضافة جهاز مسحوب"
2. املأ التفاصيل:
   - المدينة واسم المندوب
   - رقم الجهاز والسيريال
   - حالة البطارية (جيدة/متوسطة/سيئة)
   - كابل وراس الشاحن (موجود/غير موجود)
   - وجود شريحة (نعم/لا)
   - نوع الشريحة (Mobily/STC/غير محدد)
   - وصف العطل
   - ملاحظات
3. اضغط "حفظ"

### 8. سجل المعاملات

**الوصول**: القائمة الجانبية > المعاملات

#### فلترة المعاملات:
- **حسب النوع**: إضافة/سحب/الكل
- **حسب المستخدم**: اختر مستخدم محدد
- **حسب المنطقة**: اختر منطقة محددة
- **حسب التاريخ**: نطاق زمني محدد
- **البحث**: ابحث بالكلمات المفتاحية

#### عرض التفاصيل:
- اسم الصنف
- نوع العملية (إضافة/سحب)
- الكمية
- المستخدم
- المنطقة
- السبب
- التاريخ والوقت

### 9. التقارير والتصدير

#### تصدير المخزون:
1. اذهب إلى صفحة المخزون المتحرك
2. اضغط "تصدير إلى Excel"
3. سيتم تحميل ملف Excel يحتوي على:
   - اسم المندوب
   - المدينة
   - جميع الأصناف والكميات
   - حالة التنبيه
   - التاريخ

#### تصدير المعاملات:
1. اذهب إلى صفحة المعاملات
2. اختر الفلاتر المطلوبة
3. اضغط "تصدير إلى Excel"
4. سيتم تحميل ملف يحتوي على:
   - جميع المعاملات المفلترة
   - التفاصيل الكاملة
   - الإحصائيات

---

## 🏗️ البنية التقنية

### التقنيات المستخدمة

#### Frontend:
- **React 18**: مكتبة بناء واجهات المستخدم
- **TypeScript**: لغة البرمجة مع دعم الأنواع
- **Tailwind CSS**: إطار عمل CSS
- **shadcn/ui + Radix UI**: مكتبة مكونات UI
- **TanStack React Query**: إدارة حالة الخادم
- **Wouter**: نظام التوجيه
- **React Hook Form + Zod**: إدارة النماذج والتحقق
- **ExcelJS**: تصدير ملفات Excel
- **Lucide React**: الأيقونات

#### Backend:
- **Node.js**: بيئة تشغيل JavaScript
- **Express.js**: إطار عمل الخادم
- **PostgreSQL**: قاعدة البيانات
- **Drizzle ORM**: أداة ORM للتعامل مع قاعدة البيانات
- **Passport.js**: نظام المصادقة
- **Express Session**: إدارة الجلسات

#### Build Tools:
- **Vite**: أداة بناء سريعة
- **ESBuild**: مترجم JavaScript سريع
- **TypeScript Compiler**: فحص الأنواع

### هيكل المشروع

```
├── client/                 # Frontend Application
│   ├── src/
│   │   ├── components/    # React Components
│   │   │   └── ui/       # shadcn UI Components
│   │   ├── pages/        # Page Components
│   │   ├── lib/          # Utilities & Config
│   │   ├── hooks/        # Custom React Hooks
│   │   └── App.tsx       # Main App Component
│   └── index.html
│
├── server/                # Backend Application
│   ├── index.ts          # Server Entry Point
│   ├── routes.ts         # API Routes
│   ├── storage.ts        # Storage Interface
│   ├── database-storage.ts  # Database Implementation
│   ├── auth.ts           # Authentication Logic
│   └── vite.ts           # Vite Integration
│
├── shared/               # Shared Code
│   └── schema.ts         # Database Schema & Types
│
└── package.json          # Dependencies
```

---

## 💾 قاعدة البيانات

### الجداول (Tables)

#### 1. users (المستخدمون)
```sql
- id: UUID (Primary Key)
- username: TEXT (Unique)
- email: TEXT (Unique)
- password: TEXT (Hashed)
- fullName: TEXT
- city: TEXT
- role: TEXT (admin/employee)
- regionId: UUID (Foreign Key)
- isActive: BOOLEAN
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

#### 2. regions (المناطق)
```sql
- id: UUID (Primary Key)
- name: TEXT
- description: TEXT
- isActive: BOOLEAN
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

#### 3. technician_fixed_inventories (المخزون الثابت)
```sql
- id: UUID (Primary Key)
- technicianId: UUID (Foreign Key → users)
- n950Boxes: INTEGER
- n950Units: INTEGER
- i900Boxes: INTEGER
- i900Units: INTEGER
- rollPaperBoxes: INTEGER
- rollPaperUnits: INTEGER
- stickersBoxes: INTEGER
- stickersUnits: INTEGER
- mobilySimBoxes: INTEGER
- mobilySimUnits: INTEGER
- stcSimBoxes: INTEGER
- stcSimUnits: INTEGER
- lowStockThreshold: INTEGER (%)
- criticalStockThreshold: INTEGER (%)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

#### 4. technicians_inventory (المخزون المتحرك)
```sql
- id: UUID (Primary Key)
- technicianName: TEXT
- city: TEXT
- n950Devices: INTEGER
- i900Devices: INTEGER
- rollPaper: INTEGER
- stickers: INTEGER
- mobilySim: INTEGER
- stcSim: INTEGER
- notes: TEXT
- createdBy: UUID (Foreign Key)
- regionId: UUID (Foreign Key)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

#### 5. stock_movements (حركات المخزون)
```sql
- id: UUID (Primary Key)
- technicianId: UUID (Foreign Key)
- movementType: TEXT (transfer/direct_update)
- itemType: TEXT (n950/i900/...)
- quantityChanged: INTEGER
- fromInventory: TEXT (fixed/moving)
- toInventory: TEXT (fixed/moving)
- reason: TEXT
- createdBy: UUID (Foreign Key)
- createdAt: TIMESTAMP
```

#### 6. withdrawn_devices (الأجهزة المسحوبة)
```sql
- id: UUID (Primary Key)
- city: TEXT
- technicianName: TEXT
- terminalId: TEXT
- serialNumber: TEXT
- battery: TEXT
- chargerCable: TEXT
- chargerHead: TEXT
- hasSim: TEXT
- simCardType: TEXT
- damagePart: TEXT
- notes: TEXT
- createdBy: UUID (Foreign Key)
- regionId: UUID (Foreign Key)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

#### 7. inventory_items (المخزون العام)
```sql
- id: UUID (Primary Key)
- name: TEXT
- type: TEXT (devices/sim/papers)
- unit: TEXT
- quantity: INTEGER
- minThreshold: INTEGER
- technicianName: TEXT
- city: TEXT
- regionId: UUID (Foreign Key)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

#### 8. transactions (المعاملات)
```sql
- id: UUID (Primary Key)
- itemId: UUID (Foreign Key)
- userId: UUID (Foreign Key)
- type: TEXT (add/withdraw)
- quantity: INTEGER
- reason: TEXT
- createdAt: TIMESTAMP
```

### العلاقات (Relationships)

```
users ←→ regions (Many to One)
users ←→ technician_fixed_inventories (One to One)
users ←→ stock_movements (One to Many)
users ←→ withdrawn_devices (One to Many)
users ←→ transactions (One to Many)
regions ←→ inventory_items (One to Many)
inventory_items ←→ transactions (One to Many)
```

---

## 🔌 API Documentation

### Base URL
```
Development: http://localhost:5000/api
Production: https://your-domain/api
```

### Authentication Endpoints

#### POST /api/auth/login
تسجيل الدخول
```json
Request:
{
  "username": "admin",
  "password": "password123"
}

Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "admin",
    "role": "admin",
    ...
  }
}
```

#### POST /api/auth/logout
تسجيل الخروج

#### GET /api/auth/me
الحصول على بيانات المستخدم الحالي

### Users Endpoints

#### GET /api/users
الحصول على جميع المستخدمين (Admin فقط)

#### POST /api/users
إنشاء مستخدم جديد (Admin فقط)
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "role": "employee",
  "city": "Riyadh",
  "regionId": "uuid"
}
```

#### PATCH /api/users/:id
تحديث مستخدم

#### DELETE /api/users/:id
حذف مستخدم

### Fixed Inventory Endpoints

#### GET /api/technician-fixed-inventory/:technicianId
الحصول على المخزون الثابت لمندوب

#### POST /api/technician-fixed-inventory
إنشاء/تحديث المخزون الثابت

### Moving Inventory Endpoints

#### GET /api/technicians-inventory
الحصول على جميع المخزون المتحرك

#### GET /api/technicians-inventory/:id
الحصول على مخزون مندوب محدد

#### POST /api/technicians-inventory
إنشاء مخزون متحرك

#### PATCH /api/technicians-inventory/:id
تحديث المخزون المتحرك

### Stock Movement Endpoints

#### POST /api/stock-movements/transfer
نقل من الثابت للمتحرك
```json
{
  "technicianId": "uuid",
  "quantities": {
    "n950": 5,
    "i900": 3,
    ...
  },
  "reason": "نقل مخزون للعمل الميداني"
}
```

#### POST /api/stock-movements/direct-update
تحديث مباشر للمخزون المتحرك

### Regions Endpoints

#### GET /api/regions
الحصول على جميع المناطق

#### POST /api/regions
إنشاء منطقة جديدة

#### PATCH /api/regions/:id
تحديث منطقة

#### DELETE /api/regions/:id
حذف منطقة

### Withdrawn Devices Endpoints

#### GET /api/withdrawn-devices
الحصول على جميع الأجهزة المسحوبة

#### POST /api/withdrawn-devices
تسجيل جهاز مسحوب

#### PATCH /api/withdrawn-devices/:id
تحديث جهاز مسحوب

#### DELETE /api/withdrawn-devices/:id
حذف جهاز مسحوب

### Transactions Endpoints

#### GET /api/transactions
الحصول على المعاملات (مع فلاتر)

Query Parameters:
- `type`: نوع المعاملة (add/withdraw)
- `userId`: معرف المستخدم
- `regionId`: معرف المنطقة
- `startDate`: تاريخ البداية
- `endDate`: تاريخ النهاية
- `search`: كلمة البحث

---

## 🔐 الأمان والصلاحيات

### نظام الصلاحيات

#### Admin (المسؤول):
✅ الوصول الكامل لجميع الصفحات
✅ إدارة المستخدمين
✅ إدارة المناطق
✅ عرض مخزون جميع المندوبين
✅ عرض جميع المعاملات
✅ تصدير التقارير

#### Employee (الموظف):
✅ عرض المخزون الخاص به فقط
✅ تحديث المخزون المتحرك الخاص به
✅ عرض المعاملات الخاصة به
❌ لا يمكنه إدارة المستخدمين
❌ لا يمكنه رؤية مخزون الآخرين

### أمان البيانات

- **كلمات المرور**: يتم تشفيرها باستخدام bcrypt
- **الجلسات**: محمية بـ express-session
- **CSRF Protection**: محمي من هجمات CSRF
- **SQL Injection**: محمي باستخدام Prepared Statements
- **XSS Protection**: React يحمي تلقائياً من XSS

---

## 🛠️ التطوير والصيانة

### أوامر مفيدة

```bash
# تشغيل بيئة التطوير
npm run dev

# بناء المشروع للإنتاج
npm run build

# تشغيل النسخة الإنتاجية
npm start

# فحص الأخطاء البرمجية
npm run check

# تحديث قاعدة البيانات
npm run db:push
```

### إضافة ميزة جديدة

1. **تحديث Schema**: عدّل `shared/schema.ts`
2. **تحديث Storage Interface**: عدّل `server/storage.ts`
3. **تحديث Database Storage**: عدّل `server/database-storage.ts`
4. **إضافة API Routes**: عدّل `server/routes.ts`
5. **إنشاء Components**: أضف في `client/src/components/`
6. **إنشاء Pages**: أضف في `client/src/pages/`
7. **تحديث Router**: عدّل `client/src/App.tsx`

### Best Practices

#### Frontend:
- استخدم TypeScript للأنواع القوية
- استخدم React Query للـ caching
- استخدم shadcn/ui components
- تجنب التكرار - أنشئ مكونات قابلة لإعادة الاستخدام
- استخدم `data-testid` لسهولة الاختبار

#### Backend:
- استخدم Zod للتحقق من البيانات
- أبقِ Routes بسيطة - المنطق في Storage
- استخدم TypeScript Types من Schema
- سجّل الأخطاء بشكل واضح
- استخدم Transactions للعمليات المعقدة

#### Database:
- استخدم Indexes للأعمدة المستخدمة في البحث
- استخدم Foreign Keys للحفاظ على سلامة البيانات
- لا تغير نوع ID columns
- استخدم `npm run db:push` لتحديث Schema

---

## 🐛 حل المشاكل الشائعة

### المشكلة: لا يمكن تسجيل الدخول
**الحل**:
1. تأكد من وجود مستخدم في قاعدة البيانات
2. تحقق من صحة كلمة المرور
3. تأكد من أن `SESSION_SECRET` موجود

### المشكلة: خطأ عند إنشاء مستخدم
**الحل**:
1. تأكد أن username و email فريدان
2. تأكد من ملء جميع الحقول الإجبارية
3. افحص الـ logs للأخطاء التفصيلية

### المشكلة: المخزون الثابت لا يُخصم عند النقل
**الحل**:
1. استخدم endpoint `/api/stock-movements/transfer`
2. لا تستخدم التحديث المباشر للنقل
3. تأكد من وجود مخزون كافٍ

### المشكلة: التطبيق لا يعمل على الدومين المنشور
**الحل**:
1. انشر التطبيق من خلال زر "Publish" في Replit
2. انتظر حتى يكتمل النشر
3. تأكد من تحديث قاعدة البيانات

### المشكلة: Port مستخدم (EADDRINUSE)
**الحل**:
```bash
pkill -f "tsx server/index.ts"
npm run dev
```

---

## 📊 الإحصائيات والتقارير

### أنواع التقارير المتاحة:

1. **تقرير المخزون الشامل**
   - جميع المندوبين ومخزونهم
   - حالة التنبيهات
   - الإجماليات

2. **تقرير المعاملات**
   - جميع العمليات المسجلة
   - مفلتر حسب التاريخ/المستخدم/النوع
   - الإحصائيات التفصيلية

3. **تقرير الأجهزة المسحوبة**
   - جميع الأجهزة المسحوبة
   - تفاصيل الحالة والعطل
   - مصنفة حسب المندوب/المدينة

4. **تقرير المناطق**
   - إحصائيات كل منطقة
   - عدد الأصناف والكميات
   - عدد التنبيهات

---

## 🚀 النشر (Deployment)

### النشر على Replit

1. اضغط على زر **"Publish"**
2. انتظر حتى يكتمل البناء
3. سيكون التطبيق متاح على `your-app.replit.app`

### متطلبات النشر

- ✅ قاعدة بيانات PostgreSQL (Neon)
- ✅ متغيرات البيئة محفوظة في Replit Secrets
- ✅ جميع الـ dependencies مثبتة
- ✅ Schema محدث في قاعدة البيانات

### البيئات

**Development** (`.replit.dev`):
- يحتوي على آخر التحديثات
- للتطوير والاختبار
- Hot reload مفعّل

**Production** (`.replit.app`):
- النسخة المنشورة
- للاستخدام الفعلي
- مُحسّن للأداء

---

## 📝 ملاحظات مهمة

### المخزون الثابت vs المتحرك

**المخزون الثابت (Fixed)**:
- يُدخل يدوياً من قبل المسؤول
- لا يتأثر إلا بالتحديثات المباشرة أو النقل
- يمثل القاعدة الأساسية للمخزون

**المخزون المتحرك (Moving)**:
- يستقبل التحويلات من الثابت
- يمكن تحديثه مباشرة
- يمثل المخزون الفعلي للعمل

**عمليات النقل**:
- ✅ النقل من الثابت → المتحرك: يخصم من الثابت
- ❌ التحديث المباشر للمتحرك: لا يؤثر على الثابت

### الصناديق والوحدات

- **صندوق**: عبوة كاملة من الصنف
- **وحدة**: قطعة واحدة من الصنف
- يتم تتبع كليهما بشكل منفصل

---

## 🤝 الدعم والمساعدة

للحصول على المساعدة:
1. راجع هذا الملف أولاً
2. تحقق من الـ logs للأخطاء
3. تأكد من تحديث قاعدة البيانات
4. تحقق من صلاحيات المستخدم

---

## 📜 الترخيص

MIT License - يمكن استخدامه بحرية للأغراض التجارية والشخصية

---

## 🔄 آخر التحديثات

**النسخة الحالية**: 1.0.0

### التحديثات الأخيرة:
- ✅ إصلاح مشكلة إنشاء المستخدمين
- ✅ تحسين نظام التنبيهات
- ✅ إضافة تصدير Excel
- ✅ تحسين واجهة المستخدم العربية
- ✅ إضافة توثيق شامل

---

**تم بناء هذا النظام بـ ❤️ باستخدام أحدث التقنيات**

