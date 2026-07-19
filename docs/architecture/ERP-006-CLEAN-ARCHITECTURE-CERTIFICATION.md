# ERP-006 — شهادة اعتماد Clean Architecture ونظام إدارة الحالة الشامل

**التاريخ:** 2026-07-17
**الفرع:** `erp-005a-4/data-ownership` (HEAD: `f6c640a`، آخر مرحلة معتمدة: `ERP-005A-4/phase-6/post`)
**نوع العمل:** **تدقيق فقط (Audit-Only)** — لم يُعدَّل أو يُنقل أو يُحذف أي ملف كود خلال هذه المرحلة
**المنهجية:** 5 عمليات استكشاف مستقلة ومتوازية غطّت الواجهة الخلفية (`apps/api/src`) والواجهة الأمامية (`apps/portal/src`) والحزم المشتركة (`packages/*`)، مع تدقيق شامل (100%) لبعض الطبقات محدودة العدد (Controllers، Composition Root) وتدقيق بالعيّنة الموثّقة لطبقات أكبر (استخدامات، صفحات الواجهة)

---

## ملاحظة منهجية مهمة

هذا تقرير **أدلة (evidence-based)**، وليس انطباعاً. كل نتيجة أدناه مرفقة بمسار ملف ورقم سطر يمكن التحقق منه مباشرة. حيثما كانت التغطية عيّنة (Sample) وليست شاملة (خصوصاً في `apps/portal/src` الذي يحتوي ~163 ملف .tsx)، تم توضيح ذلك صراحة تحت كل قسم. لا تُعتبر النتائج "غير موجودة" في الملفات غير المُدقَّقة — هي فقط لم تُفحص.

---

## 1. خريطة طبقات النظام (Architecture Layer Map)

### `core/` — الطبقة العابرة للوحدات

| المجلد | عدد الملفات | الغرض الفعلي |
|---|---|---|
| `core/bootstrap` | 5 | تسلسل بدء التشغيل / بذر البيانات الافتراضية |
| `core/config` | 4 | تحميل بيئة التشغيل، إعداد اتصال قاعدة البيانات، JWT، الجلسات |
| `core/database` | 5 | اتصال Postgres/Drizzle، سكربتات seed/migration، وملف `storage.ts` قديم |
| `core/errors` | 2 | تسلسل هرمي مركزي لـ `AppError` + `errorHandler`/`asyncHandler` |
| `core/events` | 3 | ناقل أحداث داخل العملية (Event Bus) — العمود الفقري للتواصل غير المباشر بين الوحدات |
| `core/idempotency` | 2 | خدمة مفاتيح Idempotency |
| `core/interfaces` | 5 | واجهات repository قديمة سابقة لمجلدات `contracts/`/`ports/` الحديثة — **معظمها ميت (انظر القسم 14)** |
| `core/jobs` | 7 | نظام مهام خلفية عام (registry, repository, routes, service, worker) |
| `core/middlewares` | 4 | Express middlewares: مصادقة، idempotency، أمان، تحقق من الطلبات |
| `core/outbox` | 3 | نمط Transactional Outbox لضمان توصيل الأحداث |
| `core/serial` | 2 | خدمة تعرّف الأرقام التسلسلية المشتركة بين inventory وcourier |
| `core/services` | 1 | خدمة Feature Flags |
| `core/storage` | 1 | `MemStorage.ts` — **ميت، معروف مسبقاً من مشروع ERP-005A-4** |
| `core/telemetry` | 7 | تسجيل، مقاييس، فحوصات جاهزية، تتبّع (تم إصلاح حلقته الدائرية في Phase 6) |
| `core/uploads` | 1 | قواعد التحقق من الملفات المرفوعة |
| `core/utils` | 1 | `vite.ts` — أداة تطوير، غير مرتبطة بمنطق الأعمال |

### `composition/` — الجذر الرسمي (~30 ملف، جميعها قُرئت بالكامل)

كل ملف `*.container.ts` يتبع النمط: `private readonly repo = new DrizzleXRepository(); readonly useCase = new XUseCase(this.repo);` — بدون منطق أعمال، بدون SQL خام، بدون تسجيل مسارات Express. **راجع القسم 8 لتفاصيل الاستثناءات المكتشفة.**

### شكل الطبقات الفعلي لكل وحدة

| الوحدة | domain | application | infrastructure | presentation | ملاحظات الانحراف |
|---|---|---|---|---|---|
| **accounting** | **0 (لا يوجد)** | 2 | 6 | 1 (routes فقط، **لا يوجد مجلد controllers**) | لا طبقة domain؛ منطق "controller" مدمج داخل ملف routes واحد (483 سطر) بدلاً من فصله |
| **ai-engine-settings** | — | — | — | — | **بنية مسطّحة بالكامل** — لا توجد أي من الطبقات الأربع، كل شيء (6 ملفات) في جذر الوحدة مباشرة |
| **courier** | 8 | 20 | 13 | 3 | يملك الطبقات الأربع **بالإضافة إلى مجلد `composition/` محلي منفصل تماماً عن الجذر الرسمي** — انظر القسم 8، هذا أخطر انحراف في التقرير بأكمله |
| **identity** | **0 (لا يوجد)** | 19 | 8 | 6 | لا طبقة domain؛ application مقسّمة إلى admin/auth/users بدلاً من ذلك |
| **inventory** | 10 | 103 | 60 | 49 | البنية القياسية الكاملة، أكبر وحدة بفارق كبير (223 ملف) |

**الخلاصة:** 3 من 5 وحدات (accounting، ai-engine-settings، identity) تنحرف عن الشكل القياسي رباعي الطبقات. هذا ليس بالضرورة خطأ (accounting/identity كوحدتين، منطقهما بسيط بما يكفي ليكون domain-less مبرراً معمارياً)، لكنه **غياب اتساق (Consistency)** يستحق قراراً معمارياً واعياً بدلاً من كونه أثراً عرضياً غير موثّق.

---

## 2. تدقيق إدارة الحالة (State Management Audit) — الواجهة الأمامية

**الأداة الرسمية المؤكَّدة:** `@tanstack/react-query` (نسخة واحدة من `QueryClient`، مزوَّدة مرة واحدة في `App.tsx:213`)، مع `lib/queryClient.ts` (205 سطر) كطبقة وصول بيانات وحيدة مقصودة: `apiRequest()` للكتابة (تُرفق `Authorization: Bearer`، تُعيد المحاولة بعد تجديد التوكن عند 401، تكتشف استجابات HTML الخاطئة)، و`getQueryFn()` كـ `queryFn` افتراضية (مفتاح الاستعلام = مسار URL، مما يضمن نسخة تخزين مؤقت واحدة لكل مورد). `AuthProvider` (`lib/auth.tsx`) هو السياق الوحيد للمستخدم/الجلسة — لا يوجد Redux ولا Zustand.

### حيث يُخترق هذا التصميم فعلياً (أدلة موثّقة)

| النوع | العدد | أمثلة |
|---|---|---|
| ملفات تُعرِّف `fetch`/`fetchJson` محلية بديلة عن `apiRequest`/`getQueryFn` | **13 ملفاً، ~17 موقع استدعاء** | `products-management.tsx:37-109` و`product-details.tsx:76-110` (نسخة شبه مطابقة منسوخة، بدون رأس `Authorization`، بدون تجديد 401، بدون فحص HTML) |
| ملفات تقرأ `localStorage.getItem("auth-token")` مباشرة خارج الطبقة الرسمية | **≥11 ملفاً** | `accounting-dashboard.tsx:305`, `backup-management.tsx:243`, 6 ملفات ضمن `pages/courier/*`, `neo-shell-layout.tsx:132-133,156-157` |
| تطبيقات مستقلة لمنطق تجديد التوكن (JWT refresh) | **2** | `lib/queryClient.ts` (الرسمي) مقابل `neo-shell-layout.tsx:128-169` (فك تشفير JWT يدوياً عبر `atob`، ونداء POST مستقل لـ `/api/auth/refresh`، **بدون حماية من تسابق الطلبات المتزامنة** التي يملكها التطبيق الرسمي) |
| مخزن بيانات محلي بالكامل يتجاوز الخادم كمصدر حقيقة | **1 (خطير)** | `lib/employee-profile-extra.ts` — يخزّن بيانات موظف حساسة (رقم الهوية، جواز السفر، بيانات المركبة، ملفات كـ base64) **في `localStorage` فقط بدون أي اتصال بالخادم إطلاقاً** — هذه البيانات تُفقد فوراً عند تغيير المتصفح/الجهاز، ولا تخضع لأي إبطال تخزين مؤقت لـ React Query. مستخدَم في صفحتي الملف الشخصي للموظف |
| تنقّل صفحة كاملة (Hard Reload) بدلاً من تحديث حالة العميل | 2+ موقع | `warehouse-details.tsx:86` بعد حذف ناجح؛ استعادة النسخة الاحتياطية في `backup-management.tsx` |

**تقييم:** البنية الرسمية سليمة ومصمَّمة بشكل صحيح، لكن **الانضباط في الالتزام بها غائب في نسبة معتبرة من الملفات** — هذا نمط "معمارية جيدة على الورق، غير منفَّذة بالكامل عملياً"، وليس غياب تصميم.

---

## 3. تدقيق طبقة العرض والـ View (Presentation & View Audit) — الواجهة الأمامية

**منهجية العيّنة:** جميع وحدات `features/*` الخمس (13 ملفاً كاملة) + 9 صفحات من `pages/*` (بينها صغيرة/متوسطة الحجم لم تظهر مسبقاً في قائمة God Objects) = 22 ملفاً بالكامل + ~15 فحصاً موجَّهاً إضافياً. **هذا ليس تدقيقاً شاملاً لـ163 ملفاً.**

### النمط البنيوي

- من 5 وحدات `features/*`، **2 فقط** (`products-management`, `warehouse-details`) لها فصل كامل (types.ts + helpers.ts + components/). البقية (`product-details`, `received-devices`, `withdrawn-devices`) تحتوي مساعداً واحد فقط (تحويل بيانات أو تصدير PDF) بينما الصفحة المستهلكة تحمل View+Controller+Model كلها مدمجة.
- حتى عند وجود فصل جيد على مستوى `features/`، **الصفحة نفسها غالباً تُعيد تطبيق طبقة جلب بيانات محلية خاصة بها** بدلاً من استخدام الطبقة المشتركة (انظر القسم 2).
- `login.tsx` هو أنظف مثال على فصل Validation/Model (مخطط zod مشترك من `@shared/schema`).

### أمثلة View تحتوي منطق أعمال حقيقياً (وليس عرضاً فقط)

| الملف | السطور | النتيجة |
|---|---|---|
| `pages/warehouses.tsx` | 417 | **أوضح مخالفة**: `calculateTotalItems`/`calculateLowStockCount` (119-173) تحسب فعلياً داخل المكوّن، وتحتوي عتبة عمل ثابتة غير موثّقة `threshold = 5` (سطر 148). كذلك تُكرِّر (Duplicate) واجهات `WarehouseInventory`/`WarehouseData` محلياً بدلاً من استيرادها من `features/warehouse-details/types.ts` |
| `pages/withdrawn-devices.tsx` | 552 | **أكثف منطق أعمال في العيّنة**: حساب معدل موافقة، **`estimatedLoss = stats.rejected * 350`** (سطر 147 — ثابت مالي بدون تسمية أو تعليق)، تجميع اتجاه 6 أشهر مع حسابات pixel للرسم البياني، ترتيب أعلى 5 فئات أجهزة — كل هذا حساب تحليلي حقيقي مدمج في مكوّن الصفحة |
| `pages/system-logs.tsx` | 337 | منطق فلترة/بحث متعدد الحقول ينفَّذ مباشرة في جسم العرض بدلاً من hook |
| `pages/warehouse-details.tsx` | 345 | ثابت سعة مستودع ثابت `maxWarehouseCapacity = 100` (سطر 206) مدمج في الحساب |

### View "سلبية" فعلاً (Render/Bind/Dispatch فقط)

`profile.tsx` (148 سطر) و`login.tsx` (536 سطر — معظمها CSS تزييني) هما المثالان الأنظف في العيّنة.

**الخلاصة العامة:** من 9 صفحات عُيِّنت، 2 سلبية بالكامل، 2 شبه سلبية بمنطق تنسيق بسيط، **5 تخلط منطق أعمال حقيقياً أو تتجاوز طبقة البيانات المشتركة**.

---

## 4. تدقيق Controllers — الواجهة الخلفية (شامل، 100%)

**تم فحص جميع الـ15 ملف تحت `apps/api/src/modules/*/presentation/controllers/*.ts` بالكامل (تغطية شاملة وليست عيّنة)، بالإضافة إلى `accounting.routes.ts` (483 سطر) بصفتها البديل الوحيد لطبقة controller في وحدة accounting.**

| # | Controller | السطور | النتيجة |
|---|---|---|---|
| 1 | `courier/courier.controller.ts` | 360 | **مخالفة** — قراءة ملفات خام (`fs.readFileSync`) + قرار تصدير متزامن/غير متزامن بناءً على `count > 10000` مع `import()` مباشر لـ jobsRepository داخل الـ controller |
| 2 | `identity/auth.controller.ts` | 63 | ✅ نظيف |
| 3 | `identity/users.controller.ts` | 253 | **مخالفة** — استعلام Drizzle خام مباشر (`getDatabase().insert(systemLogs)...`، سطر 58) + منطق تفويض عبر المناطق/المؤسسات مدمج في الـ controller |
| 4 | `inventory/base.controller.ts` | 61 | ✅ نظيف |
| 5 | `inventory/dashboard.controller.ts` | 40 | ✅ نظيف |
| 6 | `inventory/devices.controller.ts` | 502 | **مخالفة** — تحديد حالة موافقة/رفض الجهاز عبر **مطابقة Regex على نص حر** (`/(موافق\|approved\|accept)/i`) — قاعدة عمل حقيقية مموَّهة كـ parsing نصي |
| 7 | `inventory/inventory.controller.ts` | 113 | ✅ نظيف |
| 8 | `inventory/item-types.controller.ts` | 248 | **مخالفة** — حلقة يدوية للتحقق من تكرار الأسماء العربية/الإنجليزية قبل التحديث (139-169) |
| 9 | `inventory/regions.controller.ts` | 132 | **مخالفة** — فحص `usersCount > 0` ورفض الحذف مباشرة في الـ controller (قاعدة تكامل مرجعي) |
| 10 | `inventory/serialized-items.controller.ts` | 149 | ✅ نظيف |
| 11 | `inventory/supervisor-requests.controller.ts` | 39 | ✅ نظيف |
| 12 | `inventory/system.controller.ts` | 164 | مقبول (انحراف طفيف فقط) |
| 13 | `inventory/technicians.controller.ts` | 382 | **مخالفة** — فلترة أدوار وتنسيق بيانات متعدد الخطوات، ويستورد **8 حاويات composition مختلفة مباشرة** |
| 14 | `inventory/transactions.controller.ts` | 68 | ✅ نظيف |
| 15 | `inventory/warehouse-transfer.controller.ts` | 188 | **مخالفة** — فحص صلاحيات/حالة مكرَّر يدوياً في 5 من 8 معالجات، بدلاً من guard/use-case موحَّد |
| 16 | `inventory/warehouses.controller.ts` | 208 | **مخالفة** — نمط "استدعاء repository + استدعاء يدوي منفصل لتسجيل سجل تدقيق" بدلاً من use-case واحد يغلّف الاثنين |
| — | `accounting/accounting.routes.ts` | 483 | نظيف نسبياً كمنطق، لكنه **انحراف بنيوي**: لا يوجد مجلد controllers مخصص إطلاقاً |

**النتيجة الإجمالية: 8 من 15 controller (53%) تحتوي مخالفة واحدة على الأقل.** النمط الأكثر تكراراً: "استدعاء service/repository ثم استدعاء منفصل يدوي لتسجيل التدقيق" بدلاً من use-case واحد يضمن الاثنين معاً (regions، devices، warehouses)، يليه منطق أعمال/تفويض مدمج مباشرة في الـ controller (devices، item-types، regions، warehouse-transfer).

---

## 5. تدقيق Models / DTO

**تغطية:** جميع ملفات `packages/shared-types/schemas/*.schema.ts` (10 ملفات، 1546 سطراً) + عيّنة موسّعة (~40+ ملف) من عقود/أنواع محلية عبر identity/inventory/courier.

**النتيجة: صفر مخالفات.** جميع الملفات العشرة في `shared-types` تحتوي تعريفات Drizzle/Zod فقط، بدون أي `export function`/`export class` أو منطق شرطي. تأكيد عبر بحث شامل: صفر استيراد لـ `db`/`pool`/Express في أي طبقة domain أو application عبر النظام بأكمله. كيانات domain الحقيقية (`inventory-item.aggregate.ts`, `item-type.entity.ts`, السياسات) تحتوي منطقاً بالتصميم الصحيح، وهي ليست "Models/DTO" بل domain entities — موضعها الصحيح DDD-wise.

**هذا القسم هو الأقوى في التقرير بأكمله — فصل نموذج البيانات عن المنطق مطبَّق بانضباط كامل.**

---

## 6. تدقيق Use Cases / Services

**تغطية:** جرد كامل (42 use-case + 17 service)، مع قراءة معمّقة لـ10 ملفات موزَّعة عبر الوحدات.

**اكتشاف بنيوي مهم:** خدمات inventory الفعلية تعيش تحت `infrastructure/services/` وليس `application/` كما هو متوقَّع تسمياً — هذا لا يخالف قواعد dependency-cruiser (لأنها لا تزال بلا SQL مباشر... انتظر، بل تحتوي SQL مباشر، وهذا هو الموضع الصحيح معمارياً لخدمة تكتب SQL) لكنه انحراف تسموي عن الاصطلاح المتوقَّع.

| الملف | السطور | النتيجة |
|---|---|---|
| `accounting.service.ts` (معروف مسبقاً) | 1779 | God Object مؤكَّد — انظر القسم 15 |
| `courier.service.ts` (معروف مسبقاً) | 1476 | God Object مؤكَّد — انظر القسم 15 |
| `inventory/infrastructure/services/analytics.service.ts` | 474 | **مخالفة SRP جديدة** — يخلط: (1) إحصائيات لوحة التحكم، (2) CRUD كامل لسجلات التدقيق (وهو ما يوجد له بالفعل `SystemLogsRepository` منفصل — أي تكرار مسؤولية محتمل)، (3) تقارير متنوعة |
| `inventory/infrastructure/services/item-types.service.ts` | 658 | **مخالفة SRP طفيفة** — 193 سطراً (~30%) عبارة عن بيانات بذر افتراضية (`seedDefaultItemTypes`) مدمجة في خدمة تُفترض أنها لخدمة الاستعلامات وقت التشغيل فقط |
| `identity/application/auth.service.ts` | 228 | **ملاحظة ترابط خفيف** — يتلقى ويُعدِّل كائن `session: any` مباشرة (73-83، 163)، أي معرفة بشكل جلسة Express مدمجة في خدمة تطبيقية |
| 6 ملفات أخرى مُدقَّقة | — | ✅ نظيفة (`DeleteWarehouseTransfers`, `ApproveInventoryRequest`, `UserManagement`, `courier.workflow.ts`, `inventory.engine.ts`, `CustodyGuard.ts`) |

**تأكيد شامل:** صفر استخدام لـ `req.body`/`res.status()`/Express Request-Response في أي use-case/service عبر النظام بأكمله (تحقُّق عبر بحث شامل، نتيجة واحدة كانت positive-كاذبة).

**النتيجة: 8 من 10 ملفات مُدقَّقة بعمق نظيفة؛ مخالفتان حقيقيتان جديدتان + الـ God Objects المعروفة مسبقاً.**

---

## 7. تدقيق Repositories

**تغطية:** جرد كامل (57 ملفاً عبر 5 وحدات)، قراءة معمّقة لـ8 ملفات.

**النتيجة: صفر مخالفات في العيّنة المُدقَّقة بعمق.** جميع الـrepositories المفحوصة تحتوي بناء استعلامات فقط (مع شروط وجود/فلترة، وليس قرارات عمل). تأكيد عبر بحث شامل: **صفر** استيراد من طبقة `presentation/` أو من Express في أي من الـ57 ملفاً عبر النظام بأكمله.

الملفات القديمة الميتة (`*.repo.ts` بأحرف صغيرة في inventory وidentity) وُجدت كما هو معروف مسبقاً من ERP-005A-4، ولم تُعَد دراستها — انظر القسم 14.

**هذا القسم، مع القسم 5، من أقوى نتائج التقرير — طبقة الوصول للبيانات نظيفة ومنضبطة بشكل ممتاز.**

---

## 8. تدقيق Composition Root

**تغطية شاملة: جميع ملفات `apps/api/src/composition/*.ts` (~30 ملفاً) قُرئت بالكامل.**

### الجذر الرسمي نظيف إلى حد كبير

صفر SQL خام، صفر تسجيل مسارات Express، صفر منطق أعمال في 27 من 30 ملف. ملفان يقومان بترجمة/تحويل بيانات بسيطة موثَّقة (`courier-inventory.adapter.ts`)، وملفان يسجّلان في registry متغيّر (وليس حقن constructor) كنمط متعمَّد لعقود ERP-005A-4 عبر الوحدات (`inventory-identity.adapter.ts`, `accounting-cross-module.adapter.ts`).

### 🔴 الاكتشاف الأخطر في التقرير بأكمله: جذر Composition ثانٍ منافس

**`apps/api/src/modules/courier/composition/courier.container.ts` (129 سطراً) — جذر تكوين ثانٍ فعلي، خارج `apps/api/src/composition/` تماماً.**

- `bootstrapCourierModule()` (96-119) يُنشئ `DrizzleCourierRepository`، `CourierInventoryPortAdapter`، `DrizzleCourierUnitOfWork`، و`CourierService`، ويبني `CourierController` — **دون أي علم من الجذر الرسمي `apps/api/src/composition/`** (تأكيد: بحث عن كلمة "courier" في الجذر الرسمي يُظهر فقط الاتجاه المعاكس — أي كيف تصل وحدات أخرى لـcourier، وليس كيف يُبنى courier نفسه).
- يُستدعى مباشرة من `modules/courier/presentation/routes/courier.routes.ts:4,21` — أي أن وحدة courier بأكملها تُقيم بنيتها الداخلية وتُشغِّل نفسها **دون المرور عبر جذر التكوين الرسمي إطلاقاً**.
- **يحتوي منطق أعمال/بنية تحتية حقيقياً وليس مجرد ربط**: `registerCourierJobHandlers()` (18-94) يحسب نسبة تقدُّم التصدير (`Math.min(95, 10 + Math.round((processed/total)*85))`، سطر 59)، تقدير وقت متبقٍّ (ETA)، وعمليات نظام ملفات مباشرة (`fs.existsSync`/`fs.mkdirSync`/`fs.statSync`). هذا يخالف مباشرة القاعدة الصريحة في هذا التوجيه: "Composition Root يجب أن يكون بدون Business Logic، بدون SQL، بدون Controllers."

### اكتشاف ثانوي: تعدُّد نسخ نفس الـrepository

4 ملفات composition منفصلة (`auth.container.ts`, `users.container.ts`, `stock-fixed-inventory.container.ts`, `DrizzleBootstrapDefaultsRepository.ts`) تُنشئ كل منها `new UserRepository()` خاصة بها بدلاً من إعادة استخدام singleton الوحدة الواحدة `identityRepositories.user` الذي بُني عليه عقود ERP-005A-4 عبر الوحدات — أي وجود عدة نسخ حيّة متزامنة من نفس الـrepository في التطبيق الواحد قيد التشغيل، بدلاً من نسخة واحدة مُحقَنة في كل مكان.

**تقييم: الجذر الرسمي بحد ذاته سليم تقريباً، لكن ادّعاء "مكان وحيد للربط" غير صحيح فعلياً على مستوى النظام ككل — بسبب جذر courier المستقل.**

---

## 9. تدقيق Single Source of Truth

| الميزة | المالك الفعلي المكتشَف | مكان واحد واضح؟ |
|---|---|---|
| **Product** | `item-types.service.ts` + `item_types` جدول | **لا** — يوجد "كتالوج منتجات" مستقل ومتوازٍ تماماً: جدول `products` + `IProductRepository`/`DrizzleProductRepository`، مستخدَم فقط في مسار "البيع التمثيلي" (Representative Sale). نموذجا بيانات مستقلان لنفس المفهوم التجاري |
| **Inventory (مخزون)** | معماري use-case-per-operation (مبرَّر بالتصميم) | نعم من حيث المبدأ، **لكن** `technicians-inventory.routes.ts` يُعيد تطبيق منطق نقل مخزون موجود بالفعل، بشكل مختلف، في **3 ملفات routes أخرى ميتة** (انظر القسم 13) |
| **Courier** | `courier.service.ts` + `courier.workflow.ts` | ✅ نعم — طبقات واضحة، لا تكرار |
| **Customer** | **لا يوجد مالك على الإطلاق** | **لا — مفقود بالكامل**. جدول `customers` موجود في accounting لكن بلا Controller أو use-case أو مسار `/api/customers` واحد. اسم العميل يتسرّب كحقل نصي حر غير مرتبط (`customerName: string \| null`) في وحدة courier، بدون FK لجدول العملاء الحقيقي |
| **Sales (المبيعات)** | `accounting.service.ts` (`/api/sales/invoices`) | **لا — تكرار حقيقي مؤكَّد**. تطبيق ثانٍ مستقل تماماً موجود في `CreateRepresentativeSale.use-case.ts` (وحدة inventory)، يكتب لجدول `salesOrders` منفصل، **ولا يلمس القيود المحاسبية أو جدول العملاء إطلاقاً** — بيع مُسجَّل بهذا المسار غير مرئي محاسبياً بتاتاً. أيضاً مساراته مسجَّلة بدون بادئة `/api` خلافاً لكل مسار آخر في النظام |
| **Warehouse** | `warehouse.service.ts`/`warehouses.controller.ts` | **لا** — واجهتان باسم **متطابق حرفياً** `IWarehouseRepository` في مجلدين مختلفين بالاسم فقط بحرف واحد (`warehouse/` مقابل `warehouses/`)، كلاهما حيّ ومستخدَم في كود إنتاجي مختلف — خطر حقيقي أن يُعدِّل مطوّر الواجهة الخطأ |
| **Identity** | `identity.service.ts` (واجهة رقيقة) → `auth.service.ts` | ✅ نعم — تفويض موثَّق صراحة كـ"نقطة الدخول الوحيدة" |

**3 من 7 ميزات (Product, Customer, Sales) لديها انتهاك SSOT حقيقي وموثَّق؛ ميزة رابعة (Warehouse) لديها خطر تسمية خطير بواجهتين متطابقتي الاسم.**

---

## 10. تدقيق التكرار المنطقي (Duplicate Logic)

- **DTOs مكرَّرة**: `IUserRepository` (نسخة ميتة في `core/interfaces/`، 12 method، مقابل النسخة الحيّة في `@stockpro/contracts`، 20 method). `IWarehouseRepository` (كلا النسختين حيّتان — انظر القسم 9).
- **Mappers**: ملف واحد فقط عبر النظام بأكمله (`courier/infrastructure/mappers/courier.mapper.ts`) — لا تكرار مُكتشَف، لكن لم يُفحص التحويل المضمَّن يدوياً داخل controllers/use-cases أخرى.
- **Use Cases/Services مكرَّرة**: نفس زوج Sales وProduct الموثَّق في القسم 9 — عمليتان مستقلتان لـ"إنشاء بيع" بجداول وتحقُّق مختلفين تماماً بلا كود مشترك.
- **منطق تحقُّق/حسابات**: لم يُعثر على regex بريد/هاتف مركزي مكرَّر (التحقُّق غالباً inline عبر zod لكل حقل). اكتشاف جانبي مهم: `RepresentativeInventory.controller.ts` يتلقى `taxAmount` **من العميل مباشرة بدون إعادة حساب في الخادم**، بينما `accounting.service.ts` يحسب الضريبة فعلياً من جهة الخادم — ثغرة صحة بيانات محتملة أكثر من كونها "تكرار حساب"، تستحق تنبيهاً منفصلاً.

---

## 11. تدقيق الحالة المكرَّرة (Duplicate State) — الواجهة الأمامية

لا يوجد سياق مستخدم/مصادقة ثانٍ مكتشَف (`lib/auth.tsx` وحيد). **لكن التكرار الفعلي المكتشَف هو على مستوى ذاكرة التخزين المؤقت لنفس المورد الخادمي**: `product-details.tsx` و`item-type-details.tsx` (انظر القسم 13) يستدعيان **نفس نقطتي نهاية API** (`GET /api/item-types/:id` و`.../serial-tracking`) عبر مفاتيح React Query منفصلة تماماً، مما ينتج نسختين مستقلتين من ذاكرة التخزين المؤقت لنفس البيانات الخادمية — بالضبط نوع "نسخ متعددة من نفس البيانات" الذي يحذّر منه هذا التوجيه صراحة.

كذلك، مخزن `employee-profile-extra.ts` (القسم 2) هو حالة "مملوكة" بشكل حصري من طرف العميل، بلا نسخة خادمية مطلقاً — ليس تكراراً بالمعنى التقليدي، بل غياب مصدر حقيقة موحَّد بالكامل.

---

## 12. تدقيق التحقُّق المكرَّر (Duplicate Validation)

لم يُعثر على نمط تحقُّق مكرَّر بشكل منهجي واسع (Zod يُستخدم inline لكل حقل بدلاً من مخططات مركزية مُعاد استخدامها، مما يعني التحقُّق **مبعثَر لكنه ليس بالضرورة مكرَّراً حرفياً**). الاستثناء الموثَّق الوحيد ذو الصلة: منطق التحقُّق من تكرار اسم نوع الصنف (عربي/إنجليزي) مُطبَّق يدوياً داخل `item-types.controller.ts` (139-169) بدلاً من قاعدة domain/use-case مركزية — هذا تصنَّف كـ"مخالفة SRP للـcontroller" في القسم 4 وليس تكرار تحقُّق تقني بحت.

---

## 13. تدقيق المسارات المكرَّرة (Duplicate Routes) — **الاكتشاف الأكثر خطورة عملياً**

**منهجية:** استُخرج كل تسجيل `app.get/post/put/patch/delete` عبر النظام بأكمله وقورن بترتيب التسجيل الفعلي في `routes/index.ts` (Express يُجيب بأول معالج مسجَّل؛ تم التأكد من عدم وجود `next()` عابر في أي معالج خاسر — أي أن الكود اللاحق ميت فعلياً وليس طبقة تمرير متعمَّدة).

الحالة المعروفة مسبقاً (`GET /api/supervisor/technicians`) **لا تزال قائمة**. لكن التدقيق وجد **8 حالات إضافية جديدة غير موثَّقة سابقاً**، جميعها داخل وحدة inventory:

| المسار | الملف الحيّ (المسجَّل أولاً) | الملف الميت (غير قابل للوصول) |
|---|---|---|
| `GET /api/stock-movements` | `warehouse-stock-movements.routes.ts:13` | `technicians-inventory.routes.ts:88` **و** `stock-transfer.routes.ts:71` |
| `GET/PUT/DELETE /api/technician-fixed-inventory/:id` | `technicians-inventory.routes.ts:43,58,73` | `stock-fixed-inventory.routes.ts:14,27,72` |
| `POST /api/stock-transfer` | `technicians-inventory.routes.ts:95` | `stock-transfer.routes.ts:24` |
| `GET/POST /api/technicians/:id/fixed-inventory-entries` | `technicians-inventory.routes.ts:119,134` | `inventory-entries-technician.routes.ts:13,24` |
| `GET/POST /api/technicians/:id/moving-inventory-entries` | `technicians-inventory.routes.ts:150,165` | `inventory-entries-technician.routes.ts:45,56` |
| `GET/POST /api/warehouses/:id/inventory-entries` | `warehouses.routes.ts:88,95` | `inventory-entries-warehouse.routes.ts:13,24` |
| `GET /api/warehouse-inventory/:warehouseId` | `warehouses.routes.ts:72` | `warehouse-stock-movements.routes.ts:32` |
| `GET /api/supervisor/technicians-inventory` | `technicians-admin.routes.ts:10` | `supervisor-technicians-list.routes.ts:11` |

**لماذا هذا خطير وليس مجرد "كود زائد":** الملفات "الميتة" تستخدم **تطبيقات مختلفة جوهرياً** عن الملفات "الحيّة" لنفس المسار — مثلاً `stock-fixed-inventory.routes.ts` (ميت) يكتب سجل تدقيق `SystemLog` عند التحديث، بينما `technicians-inventory.routes.ts` (حيّ) **لا يفعل ذلك إطلاقاً**. مطوّر يحاول إصلاح قاعدة عمل قد يُعدِّل الملف الميت معتقداً أنه المسؤول، ولن يرى أي أثر لتعديله في الإنتاج أبداً.

**+ مسارات واجهة أمامية مكرَّرة حيّة** (انظر القسم 15 للتفاصيل): صفحتان كاملتان (`products-management.tsx`/`item-types-management.tsx` وصفحتا التفاصيل المرتبطتان بهما) تُوجَّهان لنفس نقاط نهاية API بالضبط.

---

## 14. تدقيق الكود الميت (Dead Code Audit)

**المنهجية:** تحليل رسم الاعتماد عبر `dependency-cruiser` (JSON) لإيجاد الوحدات اليتيمة (Orphans)، يليه تحقُّق يدوي بالبحث الشامل عبر الكود لاستبعاد أي استخدام ديناميكي قبل التصنيف كـ"ميت".

### الواجهة الخلفية — 20 ملفاً ميتاً مؤكَّداً (بالإضافة لما هو معروف مسبقاً من ERP-005A-4)

يشمل: `core/bootstrap/events.ts` (stub موثَّق أنه "منقول")، `core/bootstrap/infrastructure/database/DrizzleBootstrapDefaultsRepository.ts` (stub مشابه)، `core/interfaces/{IInventoryRepository,IUserRepository,IWarehouseRepository}.ts`، `courier/application/ports/CourierSerializedInventoryPort.ts` (استُبدل بـ`ICourierInventoryPort`)، `courier/contracts/index.ts` وَ`inventory/contracts/index.ts` (ملفا barrel بلا مستوردين)، `inventory/application/regions.service.ts` (stub سطر واحد)، `identity/application/identity.service.ts` (الفئة `IdentityService` — الفئة الحيّة الفعلية `AuthService`)، **5 ملفات عقود مكرَّرة محلية** في identity استُبدلت جميعها بنسخ `@stockpro/contracts` الحيّة، **5 ملفات `*.repo.ts` قديمة** (واجهات دالية بديلة عن repositories صنفية حيّة، غير مستوردة من أي مكان)، `inventory/presentation/controllers/base.controller.ts` (فئة مجرَّدة بلا أي فئة ترثها)، `shared/utils/vite.ts` (غلاف مُتجاوَز).

**ملاحظة مهمة (غير محذوفة، فقط موثَّقة):** 3 سكربتات (`migrate-roles.ts`, `seed.ts`, `sync-prod-db.ts`) هي أدوات صيانة يدوية مشروعة (self-invoking عبر `tsx`)، وليست كوداً ميتاً — لكنها غير مسجَّلة في `package.json` scripts، مما يستحق سؤال المتابعة للفريق حول ما إذا كانت لا تزال قيد الاستخدام.

### الواجهة الأمامية — شجرة فرعية ميتة كاملة (14 ملفاً، ~4700 سطر)

طبقة تخطيط ومكوّنات CRUD قديمة بأكملها استُبدلت بـ`components/layout/neo-shell-layout.tsx` ولم تُحذف: `header.tsx`, `sidebar.tsx`, `inventory-table.tsx` (353L), `technicians-table.tsx` (539L), `stats-cards.tsx`, `request-inventory-modal.tsx`, `withdraw-from-technician-modal.tsx` (744L)، `SplashScreen.tsx`، بالإضافة إلى 6 نوافذ modal إضافية لا تُستورد إلا من داخل هذه الشجرة الميتة نفسها. **53 من 53 صفحة (100%) في `pages/` حيّة ومسجَّلة** — لا كود صفحات ميت.

**اكتشاف إضافي:** حزمة `packages/ui` بأكملها (تحتوي `Button` مصغَّر مكرَّر) **غير مستوردة من أي مكان** في `apps/portal` — بداية متروكة لتوحيد لم تكتمل.

---

## 15. تدقيق God Objects

### الواجهة الخلفية

| الملف | السطور | التقييم |
|---|---|---|
| `accounting/infrastructure/accounting.service.ts` | **1779** (نما من 1671 عند الرصد الأول) | God Object مؤكَّد — قيود، فواتير، مدفوعات، ضرائب، تقارير كلها في فئة واحدة |
| `courier/application/courier.service.ts` | 1476 | God Object مؤكَّد — CRUD، مسح، آلة حالة التسليم، استخراج PDF بالذكاء الاصطناعي، إحصائيات — 4-5 مسؤوليات منفصلة فعلياً |
| `inventory/infrastructure/database/DrizzleDevicesRepository.ts` | 1196 | حدّي — مبرَّر جزئياً (واجهة واحدة، ~26 method) لكن يستحق تقسيماً حسب سحب/استلام/موافقة |

### الواجهة الأمامية — نمط منهجي واسع النطاق

| # | الملف | السطور | التقييم |
|---|---|---|---|
| 1 | `pages/accounting-dashboard.tsx` | **2423** | God Object — جلب بيانات من 4+ كيانات، تصدير Excel وPDF، 5+ أنواع رسوم بيانية، كل ذلك مضمَّن |
| 2 | `pages/dashboard.tsx` | 1857 | مرجَّح (15 hook) |
| 3 | `pages/technician-details.tsx` | 1650 | مؤكَّد — تصدير، حوارات، تبويبات، موافقة/رفض كلها مدمجة |
| 4 | `pages/operations.tsx` | 1602 | مرجَّح (17 hook) |
| 5 | `pages/notifications.tsx` | 1602 | مؤكَّد — فلترة، موافقة/رفض، تحكُّم أدوار، حوارات متعددة |
| 6 | `pages/ReceivedDeviceDetails.tsx` | 1276 | مرجَّح (14 hook) |
| 7 | `pages/admin.tsx` | 968 | مرجَّح (21 hook — الأعلى في العيّنة) |
| 8+ | 7 صفحات أخرى (item-types-management، courier-request-detail، product-smart-add، product-details، operation-details، my-moving-inventory، operations-search) | 835-912 | مرجَّحة بدرجات متفاوتة |

**استثناء مبرَّر واحد:** `lib/exportToExcel.ts` (1932 سطر) — حجم كبير لكن **مسؤولية واحدة متماسكة** (5 دوال بناء تقارير Excel، ليست منطقاً مختلطاً).

**النمط العام:** 8 من أكبر 20 ملفاً مجمَّعين (خلفية+أمامية) هي صفحات `apps/portal/src/pages/**` تخلط جلب البيانات + حالة الحوارات/النماذج + قواعد أعمال + العرض في ملف واحد — هذا هو النظير الأمامي لمشكلة "الخدمة تفعل كل شيء" في الخلفية.

---

## 16. الملفات التي تحتاج Refactoring (مرتَّبة حسب الخطورة)

**حرج (Critical):**
1. `apps/api/src/modules/courier/composition/courier.container.ts` — يجب دمجه في جذر composition الرسمي وفصل منطق job/fs عنه
2. `apps/api/src/modules/inventory/application/warehouse{,s}/contracts/IWarehouseRepository.ts` — توحيد الاسمين المتطابقين فوراً قبل خطأ تحرير حقيقي
3. جميع ملفات routes الـ9 المكرَّرة/الميتة في القسم 13 — إزالة الالتباس (لا حذف بدون قرار منفصل، لكن توثيق فوري كـ"معروف وخطير")
4. `apps/portal/src/lib/employee-profile-extra.ts` + الصفحتان المستهلكتان له — نقل البيانات لمصدر خادمي حقيقي

**عالٍ (High):**
5. `accounting/infrastructure/accounting.service.ts` (1779L) — تقسيم إلى Invoicing/Journal/Payments/Tax/Reporting
6. `courier/application/courier.service.ts` (1476L) — تقسيم مماثل
7. `apps/portal/src/pages/accounting-dashboard.tsx` (2423L) وبقية قائمة God Objects الأمامية في القسم 15
8. تكرار "Sales" (`CreateRepresentativeSale.use-case.ts` مقابل `accounting.service.ts`) — قرار معماري: دمج أم فصل رسمي موثَّق
9. تكرار "Product" (`item_types` مقابل `products`) — قرار مماثل
10. غياب مالك "Customer" — تصميم ملكية واضحة

**متوسط (Medium):**
11. 8 controllers المذكورة في القسم 4 — استخراج منطق الأعمال/التفويض إلى use-cases
12. `analytics.service.ts` (474L) — فصل CRUD سجلات التدقيق عن الإحصائيات
13. `item-types.service.ts` — نقل بيانات البذر إلى seed script منفصل
14. 13 ملفاً في الواجهة الأمامية تستدعي `fetch` مباشرة خارج طبقة queryClient
15. صفحتا `product-details.tsx`/`item-type-details.tsx` المكرَّرتان

**منخفض (Low):**
16. الملفات الميتة الموثَّقة في القسم 14 (خطر منخفض لكونها غير قابلة للوصول أصلاً، لكن تراكمها يُربك أي مطوّر جديد)
17. `auth.service.ts` — فصل معرفة "session" عن منطق المصادقة
18. `packages/ui` — حسم مصيرها (حذف أم إكمال التوحيد)

---

## 17. الملفات/الطبقات السليمة (موثَّقة كنقاط قوة، ليس فقط نقاط ضعف)

- **جميع ملفات `packages/shared-types/schemas/*.schema.ts` (10/10)** — فصل نموذج بيانات مثالي، صفر مخالفات
- **جميع الـrepositories المُدقَّقة بعمق (8/8)** — صفر معرفة بطبقة العرض، صفر منطق أعمال
- **7 من 15 controller (47%)** — نظيفة تماماً وفق النمط المطلوب حرفياً
- **8 من 10 use-cases/services المُدقَّقة بعمق** — مسؤولية واحدة واضحة
- **جذر Composition الرسمي (27 من 30 ملف)** — ربط نقي بدون منطق
- **`courier.service.ts`'s الطبقات الفرعية** (`courier.workflow.ts`, `inventory.engine.ts`, `CustodyGuard.ts`) — أمثلة نموذجية لفصل جيد رغم أن الملف الأب نفسه God Object
- **البنية التحتية الناتجة عن ERP-005A-4** (الـports، الـregistries المتأخرة التسجيل، حدود الوحدات) — صمدت بالكامل ولم يُكتشف أي خرق جديد لملكية البيانات
- **`lib/queryClient.ts` وتصميم React Query العام** — تصميم سليم تماماً، المشكلة في الانضباط بتطبيقه وليس في تصميمه
- **53 من 53 صفحة أمامية حيّة ومسجَّلة** — لا يوجد كود صفحات ميت
- **`lib/exportToExcel.ts`** — مثال جيد على حجم كبير مبرَّر بتماسك حقيقي

---

## 18. الأولويات (Critical / High / Medium / Low) — ملخَّص تنفيذي

| المستوى | العدد | الطابع المشترك |
|---|---|---|
| **Critical** | 4 مجموعات | جذر composition منافس يحتوي منطق أعمال، تطابق اسمي خطير بين واجهتين حيّتين، 9 مسارات مكرَّرة/ميتة (خطر تعديل الكود الخطأ)، فقدان بيانات PII عميل حقيقي |
| **High** | 6 مجموعات | God Objects كبرى (خلفية وأمامية)، غياب/تكرار SSOT لثلاث ميزات تجارية أساسية (Product/Customer/Sales) |
| **Medium** | 5 مجموعات | مخالفات controller منفردة، خدمات SRP، صفحات مكرَّرة |
| **Low** | 3 مجموعات | كود ميت موثَّق (غير خطير حالياً لأنه غير قابل للوصول)، ترابطات خفيفة |

---

## 19. التوصيات (استراتيجية، بدون تنفيذ)

هذا القسم يقترح **مسار عمل مقترح لمراحل مستقبلية منفصلة**، ولا يمثّل التزاماً أو بدء تنفيذ:

1. **الأولوية القصوى الفورية (بدون كود، توثيق فقط أولاً):** نشر تنبيه داخلي للفريق حول الـ9 مسارات المكرَّرة/الميتة، وتطابق اسم `IWarehouseRepository` — هذان الخطران الأعلى احتمالاً للتسبب بخطأ بشري حقيقي في القريب العاجل، وحلّهما لا يحتاج قراراً معمارياً كبيراً (إعادة تسمية/حذف مسار ميت واحد).
2. **قرار معماري صريح مطلوب (وليس تنفيذاً تلقائياً) حول:** هل "Sales" ميزة واحدة أم اثنتان مشروعتان لسياقين مختلفين (بيع محاسبي رسمي مقابل بيع ميداني سريع)؟ إن كانت الأخيرة، فيجب توثيق ذلك رسمياً وربط الاثنين محاسبياً بدلاً من فصلهما تماماً كما هو اليوم. نفس السؤال لـ"Product" مقابل `Item Types`.
3. **دمج composition الخاص بـcourier** ضمن مرحلة منفصلة، مصحوبة باختبارات توصيف (Characterization Tests) قبل أي نقل كود، بنفس انضباط ERP-005A-4.
4. **تفكيك God Objects الكبرى** (accounting.service.ts، courier.service.ts، وصفحات الواجهة الكبرى) كمشروع منفصل مرحلي، وليس دفعة واحدة.
5. **معالجة ثغرة `employee-profile-extra.ts`** كأولوية عمل منفصلة نظراً لطبيعتها الحسّاسة (بيانات هوية شخصية تُفقَد فعلياً).
6. **توحيد نمط الوصول للبيانات في الواجهة الأمامية** — إما فرض استخدام `apiRequest`/`getQueryFn` عبر قاعدة Lint، أو توثيق الاستثناءات المشروعة (رفع/تنزيل الملفات) رسمياً.

---

## 20. القرار النهائي

```
CONDITIONAL PASS
```

### الأساس المنطقي

الأسس المعمارية العميقة **سليمة وقوية**: فصل نموذج البيانات (القسم 5) والـrepositories (القسم 7) شبه مثاليين بأدلة شاملة، جذر composition الرسمي نظيف في 90% منه، وبنية ERP-005A-4 لحدود الوحدات صمدت بالكامل دون أي خرق ملكية بيانات جديد يُكتشف رغم تدقيق مستقل ومكثَّف.

لكن التقرير كشف **مشاكل حقيقية، متكرِّرة، وذات خطورة عملية وليست نظرية بحتة**:
- جذر composition منافس يحمل منطق أعمال (خرق مباشر لمبدأ صريح في هذا التوجيه)
- تطابق اسمي خطير بين واجهتين حيّتين مختلفتين
- 9 مسارات API مكرَّرة/ميتة بسلوكيات مختلفة فعلياً (خطر تشغيلي حقيقي، ليس تنظيفاً تجميلياً)
- غياب/تكرار مصدر الحقيقة الوحيد لثلاث ميزات تجارية جوهرية (Product، Customer، Sales)
- فقدان بيانات شخصية حساسة فعلياً بسبب تصميم تخزين محلي بحت
- 53% من الـcontrollers و8 من أكبر 20 ملفاً في النظام (منها معظمها في الواجهة الأمامية) تحمل مخالفات SRP موثَّقة

هذا المزيج — أسس قوية + ديون تقنية حقيقية ومحدَّدة بدقة وقابلة للإصلاح المرحلي دون إعادة كتابة جذرية — هو تعريف **CONDITIONAL PASS** حرفياً: النظام لا يفشل معمارياً (FAIL كان سيعني فوضى بنيوية غير قابلة للتتبُّع)، لكنه لا يستحق شهادة PASS نظيفة قبل معالجة نقاط Critical/High أعلاه على الأقل، أو توثيقها رسمياً كديون تقنية مقبولة مؤقتاً بقرار واعٍ من الفريق.

```
Presentation Layer      = جزئياً معزولة (انظر القسم 3)
Controller Layer        = 47% معزولة بالكامل، 53% بها اختراق
Application Layer       = 80% معزولة (8/10 عيّنة عميقة)
Domain Layer            = معزولة بالكامل حيث توجد (لكن غائبة في accounting/identity)
Infrastructure Layer    = معزولة بالكامل (0 مخالفات في العيّنة)
Repositories            = معزولة بالكامل (0 مخالفات في العيّنة)
Views                   = جزئياً سلبية (2/9 سلبية بالكامل في العيّنة)
State                   = مصدر حقيقة واحد مصمَّم، لكن مُخترَق في ≥24 موقعاً
Single Source of Truth  = 4/7 ميزات سليمة، 3/7 بها مشكلة حقيقية
Duplicate Logic         = موجود ومؤكَّد (routes، DTOs، صفحات، خدمات)
Dead Architectural Deps = موجودة ومحصورة (~34 ملفاً موثَّقاً، غير خطيرة حالياً)
Hidden Coupling         = مورد واحد خطير (courier composition الموازي)
```

**لا رمز موافقة نهائي بدون معالجة أو توثيق قرار رسمي لبنود Critical الأربعة في القسم 18.**
