# ERP-FINAL — Platform Quality Audit (StockPro / RASSCO)

| Field | Value |
|---|---|
| **Document** | `docs/adr/ERP-FINAL-platform-quality-audit.md` |
| **Audit date** | 2026-07-16 |
| **Auditor mode** | Evidence-only · No runtime code changes · No fixes during audit |
| **Workspace** | `D:\nulip-new.worktrees\copilot-worktree-2026-05-21T10-17-55` |
| **Product** | StockPro Enterprise / RASSCO |
| **Final verdict** | **CONDITIONAL** |

---

## 1. ملخص تنفيذي

تم تنفيذ تدقيق هندسي مستقل على الكود، الاختبارات، البناء، العزل المعماري، الوثائق (ERP-000 → ERP-006A)، ومخرجات أداء ERP-004 الموجودة في المستودع.

**الخلاصة:** المنصة لديها أساس معماري حقيقي (modules + composition + core + packages) وبوابات جودة تعمل (lint/check/build/tests)، لكنها **ليست معزولة بالكامل وظيفيًا**، وفيها **تداخلات وتكرار**، و**ادعاءات توثيقية أقدم من الكود أو أوسع منه**. جاهزية الإنتاج التشغيلية الحالية موجودة جزئيًا، لكن جاهزية **مئات آلاف السجلات تحت آلاف المستخدمين** و**AI إنتاجي مثبت الدقة** غير مثبتة بهذا التدقيق.

| سؤال | الحكم |
|---|---|
| هل المنصة منظمة بشكل احترافي؟ | **نعم جزئيًا** — هيكل modules/core/composition موجود ويعمل |
| هل جميع الوظائف معزولة؟ | **لا** |
| هل يمكن تعديل وظيفة من مكان واحد دائمًا؟ | **لا** |
| هل توجد تداخلات؟ | **نعم** |
| هل توجد وظائف مكررة؟ | **نعم** |
| هل النظام جاهز للإنتاج؟ | **مشروط** (يعمل إنتاجيًا لكن بفجوات أمن/AI/توثيق) |
| هل جاهز لمئات آلاف السجلات؟ | **جزئيًا مثبت سابقًا (ERP-004)** — ليس لجميع المسارات |
| هل جاهز لآلاف المستخدمين؟ | **غير مثبت** (أقصى حمل موثّق هنا C=100) |
| هل AI جاهز للإنتاج؟ | **لا (غير مثبت دقة / مسار هجين)** |
| هل يعمل لفترات طويلة دون توقف؟ | **غير مثبت في هذا التدقيق** (لا chaos/soak جديد) |

---

## 2–12. درجات الجودة (من 100)

| # | المحور | الدرجة | أساس التقييم |
|---:|---|---:|---|
| 2 | جودة المنصة إجمالًا | **62** | بوابات خضراء + ديون هيكلية/توثيقية/أمنية |
| 3 | Backend | **68** | طبقات/ports موجودة؛ god services؛ عقود تسرّب infra |
| 4 | Frontend | **48** | صفحات عملاقة؛ ألوان مكررة؛ i18n ناقص؛ fetch مباشر |
| 5 | العزل المعماري | **72** | `lint:architecture(:strict)` = 0 مخالفات حالية؛ baseline فيه 19 سجلًا قديمًا |
| 6 | قاعدة البيانات | **65** | نتائج ERP-004 + migrations؛ Staging/Full Complete غير مغلقين بالكامل |
| 7 | الأداء | **55** | 100k جيد نسبيًا؛ عند 1M بعض المسارات P95 سيئ عند C=100؛ لا اختبار 250–1000 |
| 8 | الاستقرار | **40** | غير معاد اختباره هنا (PM2/DB/AI failure/disk) |
| 9 | الأمن | **55** | جلسة/CSRF/rate-limit؛ endpoints عامة؛ upload size؛ AI key في URL |
| 10 | الاختبارات | **72** | 272/272 PASS؛ placeholders ضعيفة؛ لا تغطية ضغط 100/1000 jobs |
| 11 | AI | **45** | حزمة معزولة قوية؛ مسار Courier هجين + mock filenames؛ دقة غير مثبتة |
| 12 | الوظائف الخلفية (Jobs) | **70** | claim/heartbeat/retry/stale موجودة؛ dedupe/TTL cleanup/cancel interrupt ناقصة |

### 13. مبدأ «التغيير من مكان واحد»

| العنصر | # أماكن تقريبية | مصدر حقيقة واحد؟ | مكرر؟ | مركزي؟ | درجة |
|---|---:|---|---|---|---:|
| رابط API | 35+ route files + registrar | جزئي | لا | جزئي | 6/10 |
| إعدادات DB | ~3 | نعم | لا | نعم | 8/10 |
| حالة طلب/عهدة | 20+ | لا | نعم | لا | 3/10 |
| صلاحيات/أدوار | roles SSOT + 40+ gates | أدوار نعم / صلاحيات لا | نعم | جزئي | 5/10 |
| نوع Job | registry + handlers | جزئي | محدود | جزئي | 7/10 |
| مزود AI | settings + adapters + package flags | لا (بوابتان) | نعم | لا | 4/10 |
| نموذج PDF/Vision | 3–4 defaults | لا | نعم | لا | 3/10 |
| سياسة البحث | courier-list-query (+ أماكن أخرى) | جزئي | محدود | جزئي | 6/10 |
| إعدادات التصدير | server excel + portal exportToExcel | لا | نعم | لا | 3/10 |
| رفع الملفات | courier multer أساسًا | جزئي | محدود | ضعيف (لا fileSize) | 4/10 |
| ألوان الواجهة | tokens + 50+ hardcodes | لا | نعم | لا | 2/10 |
| رسائل الأخطاء | AppError + strings منتشرة | أنواع نعم / نصوص لا | نعم | لا | 4/10 |
| حدود التصفح | 15–25+ defaults محلية | لا | نعم | لا | 2/10 |
| حدود الملفات | محلي في courier | لا | — | ضعيف | 3/10 |

**الحكم:** الالتزام بمبدأ التغيير من مكان واحد = **غير مكتمل (~4.5/10)**.

---

## 14. قائمة المخالفات (أدلة حالية)

### 14.1 بوابات الأوامر (أُعيد تشغيلها في هذا التدقيق)

| الأمر | النتيجة | Exit | ملاحظات |
|---|---|---:|---|
| `npm run lint:architecture` | ✔ no dependency violations (505 modules, 1621 deps) | 0 | مع `--ignore-known` |
| `npm run lint:architecture:strict` | ✔ no dependency violations (505 modules, 1621 deps) | 0 | **بدون** ignore |
| `npm run check` | PASS | 0 | `tsconfig.runtime-check.json` |
| `npm run check:full` | PASS | 0 | `tsconfig.json` |
| `npm run build` | PASS | 0 | vite + esbuild |
| `npm run test:unit` | **65 files / 272 tests passed** | 0 | ~63s |

### 14.2 Baseline الدين التقني

- ملف: `.dependency-cruiser-known-violations.json`
- العدد: **19** سجلًا مصنّفًا (12 application→infra/drizzle، 3 controller، 1 domain، 3 cross-module)
- الحالة الحالية: **strict = 0 مخالفات حية** ⇒ السجلات في baseline **قديمة/غير متطابقة مع الرسم الحالي** (دين توثيقي للأداة، لا مخالفات حية مكتشفة الآن)
- الحكم: **صفر حي حقيقي في depcruise الآن**؛ **ليس** صفرًا ناتجًا عن استثناءات تخفي مخالفات حالية (لأن strict أيضًا 0). لكن ملف baseline ما زال يحتوي دينًا تاريخيًا غير منظّف.

### 14.3 مخالفات تصميم/حدود ما زالت موجودة رغم lint الأخضر

هذه **ليست** مخالفات depcruise حالية، لكنها مخالفات معمارية/جودة مثبتة بالكود:

1. **God services:** `courier.service.ts` (~1305)، `accounting.service.ts` (~1423)، `DrizzleDevicesRepository.ts` (~1090)
2. **عقود عامة تسرّب infrastructure:** `inventory/contracts/index.ts` يعيد تصدير خدمات/subscribers
3. **دورة اعتماد contracts:** courier ↔ inventory عبر contracts + adapters + subscriber
4. **Presentation → infrastructure** داخل inventory (controllers/routes)
5. **SQL داخل controller:** `users.controller.ts` يدرج `systemLogs` مباشرة
6. **Endpoint بلا auth:** `GET /api/users/:id` في `users.routes.ts` سطر 16
7. **Observability عامة:** `/api/observability/metrics|spans` و `POST /api/observability/client-timing`
8. **Placeholder tests ضعيفة:** `apps/api/src/core/tests/api-versioning.test.ts` — `it("placeholder")` بلا assertions
9. **AI feature flags متعارضة:** `packages/ai-extraction` flags = OFF بينما Courier يستخدم `allowLive: true` عند تفعيل إعدادات الأدمن
10. **Mock بالاسم يتجاوز Vision الحقيقي:** أسماء ملفات تحتوي `device|single|...` في `courier-pdf-extraction.adapter.ts`

---

## 15. الوظائف المكررة

| الوظيفة | المواقع | الدليل |
|---|---|---|
| حالات العهدة/Custody statuses | courier guards/service + inventory custody-engine | ثوابت مكررة |
| Audit / System logs | courier audit + inventory system-logs + identity controller insert | ثلاثة مسارات |
| واجهات مخازن `IWarehouseRepository` | `application/warehouse` و `application/warehouses` | عقدان |
| خصم المخزون | courier `InventoryEngine` + inventory custody/serialized/devices | مساران |
| تصدير Excel | server streaming + portal `exportToExcel.ts` | مكدسان |
| بوابة تفعيل AI | package feature-flags vs admin settings + allowLive | بوابتان |

---

## 16. الأجزاء غير المعزولة

| القدرة المطلوبة في النطاق | الواقع | تقييم /10 |
|---|---|---:|
| Courier | وحدة موجودة + contracts | 6.5 |
| Inventory | وحدة كبيرة + عقود تسرّب | 5.5 |
| Custody | **ليست وحدة** — موزعة | 4 |
| Identity | موجودة؛ بلا facade عام | 6 |
| Administration | داخل identity | 6 |
| Audit | **ليست وحدة** — مجزأة | 3 |
| Jobs | في `core/jobs` (اتجاه صحيح) | 8 |
| AI package | `packages/ai-extraction` معزول ممتاز | 9 |
| AI runtime في Courier | هجين (Vision adapters + Tesseract + mock) | 4.5 |
| Reports | داخل courier | 3.5 |
| Core | لا يستورد modules (مثبت) | 7.5 |
| Composition | wiring صحيح مع بعض reverse imports | 7 |

---

## 17. ادعاءات غير مثبتة / تعارض توثيق ↔ تنفيذ

| الادعاء | الحكم |
|---|---|
| «0 مخالفات معمارية على مستوى النظام بالكامل» إن قُرئ خارج نطاق Core | **تعارض/مضلل تاريخيًا** — اليوم strict=0، لكن تقارير ERP-005A تحدثت عن 21 ثم 0 Core فقط |
| Index يقول ERP-004A «Not opened» بينما الكود فيه Jobs كامل | **تعارض بين التوثيق والتنفيذ** |
| Index يقول ERP-004 «Queued» بينما `docs/adr/erp004-results/` موجودة | **تعارض بين التوثيق والتنفيذ** |
| ERP-003 يغلق تجميد AI بينما 006A-10 يفعّل live عبر settings | **تعارض بين التوثيق والتنفيذ** |
| دقة AI (SN/SIM/TID/…) على PDF حقيقي | **غير مثبت** |
| اختبار Jobs عند 100 و 1000 | **غير مثبت** (أدلة حتى ~10) |
| استيراد Excel 100k/500k | **غير منفذ** |
| مستخدمون متزامنون 250/500/1000 | **غير مثبت** |
| Soak/chaos (قطع DB، امتلاء قرص، فشل AI طويل) في هذا التدقيق | **غير مثبت** |
| Staging Full Complete لـ ERP-002 | **غير مثبت/مفتوح** حسب ADR |
| «الإنتاج يعمل طويلًا بلا توقف» | **غير مثبت هنا** |

---

## 18. المخاطر

| # | المخاطرة | الشدة |
|---:|---|---|
| 1 | `GET /api/users/:id` بدون `requireAuth` | **حرجة** |
| 2 | تفعيل AI live عبر إعدادات أدمن يتجاوز package production flags + مفتاح Gemini في query string | **عالية** |
| 3 | رفع ملفات بدون `limits.fileSize` واضح على multer | **عالية** |
| 4 | Observability metrics/spans عامة (تسريب تشغيلي) | **متوسطة–عالية** |
| 5 | استيراد Excel متزامن بلا transaction/rollback على ملفات كبيرة | **عالية** (عند الاستخدام) |
| 6 | God services + دورة courier↔inventory تصعّب التغيير الآمن | **متوسطة** |
| 7 | أداء بحث Courier يتدهور بشدة عند 1M × C=100 (P95 ≈ 9–10s في نتائج ERP-004) | **عالية** للتوسع |
| 8 | i18n/ألوان/حالات غير مركزية ⇒ انحدار جودة وصيانة | **متوسطة** |
| 9 | Jobs: لا dedupe قوي؛ purge لا يحذف ملفات التصدير | **متوسطة** |
| 10 | سر تشفير إعدادات AI الافتراضي إن غاب env | **متوسطة** |

---

## 19. ما تم تنفيذه فعليًا (مثبت)

- هيكل monorepo: `apps/api`, `apps/portal`, `packages/*`, `composition`, `core`, modules
- Dependency-cruiser + baseline tooling
- Core boundary: لا استيرادات core→modules (حاليًا)
- Jobs framework: claim once (`SKIP LOCKED`)، heartbeat، retry+backoff، stale recovery، progress، تسجيل handlers من الوحدات
- Outbox + idempotency + بعض اختبارات تكامل
- Package `@stockpro/ai-extraction` بعقد `VisionProvider` وadapters Gemini/OpenAI/Claude
- AI admin settings (تشفير مفاتيح + UI)
- Courier PDF path + manual_review status + OCR/Tesseract fallback
- Excel export غير متزامن عند >10k مع streaming (Courier)
- ERP-004 artifacts: خطط SQL + load tests لـ 100k/500k/1M حتى C=100
- بوابات: check / check:full / build / test:unit خضراء الآن
- أدوار مركزية جزئيًا في `packages/shared-types/roles.ts`
- Session + CSRF header check + rate limit في production

---

## 20. ما تبقى / ناقص / غير مثبت

- وحدات مستقلة: Custody / Audit / Reports / Administration
- تنظيف baseline (19 سجلًا قديمًا)
- كسر دورة courier↔inventory وتنحيف العقود العامة
- تفكيك god services
- إغلاق أمني: users/:id، observability، file size limits، ملكية GET job
- AI: ربط pipeline الكامل، إيقاف mock-by-filename، قياس دقة على PDF حقيقي، توحيد بوابة التفعيل
- استيراد Excel دفعات + idempotency + rollback
- اختبارات حمل C=250/500/1000 وإعادة قياس P95 تحت 1M
- اختبارات Jobs 100/1000 + cancel interrupt + purge ملفات
- i18n كامل + tokens كمصدر تشغيل فعلي
- تحديث `docs/adr/README.md` والحالات المتضاربة (003/004/004A/006)
- Chaos/soak واستقرار طويل الأمد

---

## 21. خطة إصلاح مرتبة بالأولوية

### P0 — أمن واستقرار تشغيل (قبل أي توسع)

1. حماية `GET /api/users/:id` بـ auth (+ سياسة بيانات)
2. تقييد/حماية observability endpoints
3. إضافة `limits.fileSize` + سياسات رفع موحّدة
4. توحيد بوابة AI live (flags ↔ settings) ومنع مفتاح في URL إن أمكن
5. إزالة/عزل mock-by-filename عن مسار الإنتاج

### P1 — صحة العزل والصيانة

6. تنظيف `.dependency-cruiser-known-violations.json` ليطابق الواقع (0)
7. عقود عامة نظيفة (بدون infra exports) وكسر دورة courier↔inventory
8. استخراج Custody + Audit كحدود واضحة
9. تقسيم `courier.service` / `accounting.service`

### P2 — بيانات وتوسع

10. تحسين مسارات البحث الثقيلة عند 1M (من backlog ERP-004)
11. Excel import دفعات + تقارير أخطاء + idempotency
12. Jobs: dedupe، cancel الحقيقي، حذف ملفات TTL، اختبارات 100/1000
13. إعادة load test حتى C=250–1000 وتوثيق SLOs

### P3 — Frontend والجودة المستمرة

14. ترحيل الألوان إلى tokens فقط؛ إكمال i18n
15. تفكيك الصفحات العملاقة إلى features
16. مزامنة ADR Index مع التنفيذ؛ إغلاق/تحديث ERP-003 بصدق

---

## 22. القرار النهائي

```text
CONDITIONAL
```

### أخطر خمس مشكلات متبقية

1. **ثغرة قراءة مستخدم بلا مصادقة** (`GET /api/users/:id`)
2. **AI إنتاجي غير مُحكَم البوابة وغير مثبت الدقة** (live عبر settings + OCR/mock)
3. **تدهور أداء البحث تحت 1M مع تزامن أعلى** (أدلة ERP-004 عند C=100)
4. **غياب عزل Custody/Audit + دورة courier↔inventory + god services**
5. **استيراد Excel غير جاهز للمقياس + فجوات Jobs (dedupe/TTL files/cancel)**

### إجابات صريحة مطلوبة

| السؤال | الإجابة |
|---|---|
| هل المنصة منظمة بشكل احترافي؟ | **نعم جزئيًا** |
| هل جميع الوظائف معزولة؟ | **لا** |
| هل يمكن تعديل وظيفة من مكان واحد؟ | **ليس دائمًا** |
| هل توجد تداخلات؟ | **نعم** |
| هل توجد وظائف مكررة؟ | **نعم** |
| هل النظام جاهز للإنتاج؟ | **مشروط** |
| هل جاهز لمئات آلاف السجلات؟ | **جزئيًا (مثبت سابقًا لبعض المسارات فقط)** |
| هل جاهز لآلاف المستخدمين؟ | **غير مثبت** |
| هل AI جاهز للإنتاج؟ | **لا** |
| هل يعمل طويلًا دون توقف؟ | **غير مثبت في هذا التدقيق** |

---

## الملحق A — فحص العزل المعماري (قائمة التحقق)

| الحالة المفحوصة | النتيجة الحالية |
|---|---|
| طبقة أعمال تستورد DB/Drizzle | **لا مخالفات depcruise حالية** في application/domain (grep drizzle في application/domain = 0) |
| Controller ينشئ Service/Repo | جزئيًا عبر composition؛ بعض routes ما زالت تلمس infra (تاريخيًا في baseline) |
| Route بمنطق أعمال/SQL | بعض routes/controllers (devices/users) أثقل من اللازم |
| Core يستورد وحدات أعمال | **لا** (مثبت) |
| Deep imports بين الوحدات | موجودة عبر contracts/adapters/composition؛ lint الحالي 0 |
| دوائر اعتماد | دورة contracts courier↔inventory (منطقية) |
| God service/repo | نعم |
| AI Provider داخل Courier مباشرة | نعم جزئيًا (adapters تُنشأ داخل courier + ocr.helper منفصل) |
| Jobs يعرف Courier/Inventory | **لا** (registry فقط) — جيد |

**أعداد depcruise الحالية:** مخالفات = **0** · دوائر مكتشفة بالأداة = **0** · deep-import errors = **0** · baseline records = **19 (stale)**.

---

## الملحق B — خريطة Backend (نمط مستهدف vs كسر)

النمط المستهدف:

`Route → Controller → Use Case/Service → Port → Repository → Database`

أمثلة كسر/انحراف مثبتة:

- `users.routes` → `users.controller` → insert SQL مباشر لـ systemLogs (**يكسر**)
- بعض inventory presentation → infrastructure services مباشرة (**يكسر**)
- courier controller → courier.service (سمين) → ports (**جزئي**)
- jobs.routes → jobs.service → jobs.repository (**سليم نسبيًا**)

---

## الملحق C — Frontend (درجات فرعية)

| المحور | /10 |
|---|---:|
| تنظيم الواجهة | 5 |
| سهولة التعديل | 4 |
| التكرار | 5 |
| جودة التصميم | 5 |
| قابلية التوسع | 4 |

---

## الملحق D — AI/PDF (مصفوفة جاهزية)

| البند | الحالة |
|---|---|
| محرك مركزي مستقل | جاهز (package) |
| Courier مستهلك فقط | منفذ جزئيًا |
| Gemini/OpenAI/Claude خلف عقد واحد | نعم (adapters) |
| مفاتيح مخفية | جزئي (تشفير + خطر URL) |
| تفعيل مركزي | تعارض flags/settings |
| Timeout | نعم |
| Retry Vision | غير مثبت |
| صور / متعدد صفحات / متعدد أجهزة | package نعم / Courier جزئي (maxPages=3) |
| Provenance في DB Courier | غير مثبت |
| مراجعة يدوية | جزئي |
| OCR قديم | ما زال نشطًا |
| دقة 1/2/3/10 أجهزة على PDF حقيقي | **غير مثبت** (fixtures/mock) |

---

## الملحق E — Jobs / Excel / أداء (تصنيف)

| القدرة | التصنيف |
|---|---|
| Jobs claim/heartbeat/retry/stale | جاهز |
| Jobs dedupe / cancel interrupt / file TTL purge | منفذ جزئيًا / غير منفذ |
| Jobs 100/1000 | غير مختبر |
| Excel export async+stream >10k | جاهز (جزئي التغطية) |
| Excel import 100k/500k | غير منفذ |
| ERP-004 100k list C=100 | مختبر سابقًا (نتائج موجودة) |
| ERP-004 1M search C=100 | مختبر سابقًا — أداء ضعيف على بعض المسارات |
| C=250/500/1000 | غير مختبر |

---

## الملحق F — مقارنة ADR السريعة

| ADR | التصنيف في هذا التدقيق |
|---|---|
| ERP-000 | توثيق حاكم + إنفاذ جزئي |
| ERP-001 | منفذ جزئيًا / مشروط |
| ERP-002 | منفذ جزئيًا (Staging Full Complete غير مثبت) |
| ERP-003 | مفتوح / منفذ جزئيًا — يتعارض مع مسار AI اللاحق |
| ERP-004 | منفذ كقياس (نتائج موجودة) — الفهرس قديم |
| ERP-004A | منفذ في الكود — الفهرس قديم |
| ERP-005 | توثيق |
| ERP-005A | تدقيق تاريخي |
| ERP-005A-2 | Core PASS مثبت اتجاهيًا |
| ERP-005A-3 | منفذ جزئيًا |
| ERP-006 | معماري + package جزئي |
| ERP-006A (+PRs) | منفذ محليًا جزئيًا / ليس إنتاجًا مثبت الدقة |

---

## الملحق G — نطاق لم يُعاد تنفيذه في هذه الجلسة (صراحة)

لم يُعد تشغيل ما يلي داخل هذه الجلسة (لذلك تُصنَّف نتائجها اعتمادًا على أدلة المستودع أو **غير مثبت**):

- إعادة بذر 100k/500k/1M + EXPLAIN ANALYZE جديد
- إعادة load test لـ 250/500/1000 مستخدم
- اختبار PDF حقيقي متعدد الأجهزة ضد مزود live وقياس نسب الدقة
- Chaos: قتل Node/PM2/Worker، قطع DB، امتلاء قرص
- فحص إنتاج حي شامل بعد هذا التقرير

---

**STOP AFTER THE FINAL REPORT.**  
لا تعديل Runtime · لا إصلاحات أثناء التدقيق · أدلة ونتائج فقط.
