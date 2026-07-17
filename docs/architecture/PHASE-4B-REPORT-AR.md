# تقرير المرحلة 4B — إزالة وصول Identity العكسي إلى جداول Inventory

**التاريخ:** 2026-07-17
**الفرع:** `erp-005a-4/data-ownership`
**الكوميت:** `061dd9f`
**التاغات:** `ERP-005A-4/phase-4b/pre` → `ERP-005A-4/phase-4b/post`
**الحالة:** ✅ مكتملة، تم التحقق منها بالكامل، تم الـ commit

---

## 1. السياق والهدف

في المرحلة 0 (Phase 0.5) تم اكتشاف مشكلة معمارية بالاتجاه المعاكس لما وُثّق سابقاً في ARCH-AUDIT-001: بينما المرحلة 4 عالجت كون **inventory يقرأ من جدول `users` المملوك لـ identity** مباشرة (13 موقعاً)، تبيّن أن **identity بدورها تقرأ مباشرة من 7 جداول مملوكة لـ inventory**:

- `technician_fixed_inventories`
- `technician_fixed_inventory_entries`
- `technician_moving_inventory_entries`
- `technicians_inventory`
- `inventory_requests`
- `supervisor_technicians`
- `supervisor_warehouses`

هذا خرق مباشر لقاعدة ملكية البيانات (كل module يملك جداوله فقط، والوصول المتقاطع يجب أن يمر عبر port/contract). المرحلة 4B هي التنفيذ الفعلي لإصلاح هذا الخرق، بنفس الانضباط المتبع في المرحلة 4: بدون تغيير في السلوك التجاري، بدون حذف اختبارات، وبتحقق كامل (typecheck + lint معماري + فحص الحلقات الدائرية + اختبارات الوحدة) قبل الإغلاق.

تم التخطيط لهذه المرحلة أولاً عبر Plan Mode وتمت الموافقة عليها صراحة قبل البدء بالتنفيذ.

---

## 2. الملفات المتأثرة (3 أجزاء رئيسية)

### الجزء 1 — `DrizzleAdminDashboardRepository.ts`

هذا الملف يغذّي لوحة تحكم الأدمن (`/api/admin/fixed-inventory-dashboard`, `/api/admin/all-technicians-inventory`, `/api/inventory-requests`, `/api/inventory-requests/pending/count`) وكان يستورد ويستعلم مباشرة عن 4 جداول مملوكة لـ inventory عبر 5 methods:

- `getAllTechniciansWithFixedInventory()`
- `getFixedInventorySummary()`
- `getAllTechniciansWithBothInventories()`
- `getInventoryRequests()`
- `getPendingInventoryRequestsCount()`

**الحل:** تم إنشاء port جديد مملوك من قبل identity نفسها (consumer-owned port) باسم `InventoryTechnicianDataPort` في `modules/identity/application/ports/`، يعبّر عن حاجة identity بمفرداتها الخاصة. تم تنفيذه فعلياً من طرف inventory عبر خدمة جديدة `InventoryTechnicianDataService` في `modules/inventory/infrastructure/services/`. الربط بينهما يتم في composition root فقط (`composition/inventory-identity.adapter.ts`).

بقي استيراد جدول `users` كما هو دون تغيير — لأن `users` مملوك لـ identity نفسها، فلا مشكلة هناك.

### الجزء 2 — `DrizzleSupervisorUsersReadRepository.ts`

يغذّي مسارات المشرف (`/api/supervisor/users/:userId/fixed-inventory`, `/api/supervisor/users/:userId/moving-inventory`). كان يستورد جدولي `technician_fixed_inventories` و`technicians_inventory` مباشرة عبر method واحدة لكل جدول. تم تحويلهما لاستخدام نفس الـ port الجديد (`InventoryTechnicianDataPort`) — لم تكن هناك حاجة لأي method إضافية لأن الـ port صُمم من البداية ليغطي احتياجات الملفين معاً.

### الجزء 3 — نقل `SupervisorRepository.ts` بالكامل إلى inventory

هذه أكبر خطوة في المرحلة. الملف كان يتعامل حصراً مع جدولي `supervisor_technicians` و`supervisor_warehouses` — وهما من حيث المعنى الفعلي جداول تخص inventory (تحديد أي فني/مستودع يتبع أي مشرف)، ومساراتها (`supervisor-assignments.routes.ts`) موجودة أصلاً تحت طبقة عرض inventory. بالإضافة لذلك، تبيّن أن composition root (`warehouses.container.ts`) كان أصلاً يمرر repository الخاص بـ identity مباشرة لاستخدامه داخل use-case مملوك لـ inventory وكأنه محلي — أي أن هذا التصنيف الخاطئ كان موجوداً من قبل الأساس.

**القرار (تم تأكيده مع المستخدم):** نقل الملف بالكامل (git rename، بنفس أسلوب نقل `InventorySubscriber` في المرحلة 2) إلى `modules/inventory/infrastructure/database/SupervisorAssignmentsRepository.ts` مع إعادة تسمية الكلاس من `SupervisorRepository` إلى `SupervisorAssignmentsRepository`.

**تعقيد تقني تم اكتشافه أثناء التنفيذ:** واحدة من الـ methods (`getSupervisorTechnicians`) كانت تنفّذ JOIN بين `supervisor_technicians` وجدول `users` لإرجاع بيانات فنيين كاملة (`UserSafe[]` — أي صف المستخدم الكامل ناقص كلمة المرور فقط: البريد، الصلاحيات، القسم، إلخ). بعد نقل الملف إلى inventory، أصبح هذا الـ JOIN وصولاً مباشراً من inventory إلى جدول `users` المملوك لـ identity — وهو بالضبط نوع الخرق الذي عالجته المرحلة 4 أصلاً.

الحل المعتمد: أُنشئ port ضيق جديد جداً ومخصص لهذه الحالة فقط، باسم `SupervisorTechnicianDisplayPort`، تم تنفيذه ضمن نفس `IdentityPortsAdapter` الذي بُني في المرحلة 4 (الذي يملك بالفعل مرجعاً لـ `IUserRepository` الخاص بـ identity). هذا الـ port موثّق بوضوح في الكود بأنه استثناء متعمد ولا يجب إعادة استخدامه في مواقع جديدة — لأن الـ port القياسي `IdentityUserReadPort` من المرحلة 4 مصمم عمداً ليعيد فقط بيانات عرض ضيقة (اسم، مدينة، صورة...) وليس الصف الكامل.

**ملاحظة تقنية مهمة أذكرها بشفافية:** الخطة المعتمدة نصّت على أن العقود المنشورة (`ISupervisorAssignmentsRepository` في `packages/contracts/`) يجب أن "تبقى كما هي دون تغيير". التزمت بذلك حرفياً، لكن هذا الالتزام هو الذي فرض إنشاء port الاستثناء أعلاه — لأن المستهلك الفعلي الوحيد لهذه الـ method (`SupervisorAssignmentsUseCase.getTechnicianIdsBySupervisor`) لا يستخدم فعلياً سوى حقل `.id` من كل النتائج، وليس بقية الحقول. لو سُمح بتضييق توقيع العقد بدلاً من الإبقاء عليه، لكان الحل أنظف معمارياً (بدون أي استثناء لمبدأ "لا تسريب لصف المستخدم الكامل"). فضّلت الالتزام بنص الخطة المعتمدة بدلاً من اتخاذ قرار توسيع نطاق العقد من تلقاء نفسي.

---

## 3. النمط التقني المستخدم (Late-Binding Registry)

نفس النمط الذي أُرسي في المرحلة 4 واستُخدم هنا بالاتجاهين معاً:

المشكلة: بعض الـ repositories تُنشأ كـ singletons عند وقت الاستيراد (import time) — أي قبل أن يعمل composition root. فلا يمكنها استقبال port عبر الـ constructor دون أن تستورد composition مباشرة (وهو ممنوع).

الحل: ملف registry صغير مملوك من قبل الوحدة المستهلكة نفسها (يستورد فقط نوع الـ port المحلي)، يوفّر:
- `register{X}Port(impl)` — تُستدعى مرة واحدة فقط من composition root عند بدء التشغيل
- `get{X}Port()` — تُستدعى وقت التنفيذ الفعلي، وترمي خطأ واضح إن لم يتم التسجيل بعد

في هذه المرحلة تم توسيع سجل identity (`identity/infrastructure/adapters/inventory-ports.registry.ts`) وسجل inventory الموجود مسبقاً (`identity-ports.registry.ts`)، وربط الاثنين معاً في نفس ملف composition root الوحيد: `composition/inventory-identity.adapter.ts`.

---

## 4. بوابة التحقق (Verification Gate) — جميع البنود ✅

| الفحص | النتيجة |
|---|---|
| `npx tsc --noEmit` (typecheck كامل) | نظيف، بدون أخطاء |
| `npm run lint:architecture:strict` (dependency-cruiser) | **0 مخالفة** (523 module، 1676 تبعية تم فحصها) |
| فحص الحلقات الدائرية (circular dependencies) | **حلقتان فقط**، بدون تغيير عن خط الأساس — وهما الحلقة القديمة المعروفة `tracer.ts` ↔ `metrics.ts` (خارج نطاق هذه المرحلة، مؤجلة للمرحلة 6) |
| `npm run test:unit` | **66/66 ملف اختبار ناجح، 279/279 اختبار ناجح** — بدون أي تراجع |
| مسح شامل متعدد الأسطر (multi-line-aware scan) للتأكد من صفر استيراد لجداول inventory داخل `modules/identity/**` | **نظيف تماماً** — صفر استيراد متبقٍ |

هذا المسح الأخير هو نفس الأداة (سكربت Node.js يقرأ كامل محتوى كل ملف بدلاً من grep سطر بسطر) التي كشفت في المرحلة 0 أن الأرقام الأولية كانت مقلَّلة بشكل كبير (18 ملفاً فعلياً وليس 5 كما ظُنّ سابقاً بخصوص `users`) — تم تطبيقها هنا لضمان عدم تكرار نفس الخطأ.

---

## 5. تحديث وثيقة ملكية البيانات

تم تحديث `docs/architecture/DATA-OWNERSHIP-MATRIX.md` (كما طُلب صراحة في توجيه المرحلة 4B) بإضافة قسم "حالة التحديث بعد المراحل 3/4/4B" في أعلى الملف، يوضح حالة كل خرق تم اكتشافه في المسح الأصلي:

| المعرّف | الجداول | الحالة |
|---|---|---|
| V1, V1b | `items`, `item_types`, `inventory_transactions`, `item_history_logs` (courier→inventory) | ✅ تم الإصلاح — المرحلة 3 |
| V2 | `users` (inventory→identity، 19 ملفاً) | ✅ تم الإصلاح — المرحلة 4 |
| V2b | جداول الفنيين وطلبات المخزون (identity→inventory) | ✅ تم الإصلاح — **المرحلة 4B (هذه المرحلة)** |
| V2c | `supervisor_technicians`, `supervisor_warehouses` | ✅ تم الإصلاح بالنقل — **المرحلة 4B** |
| V2c (`courier_request_items`) | inventory→courier | ⏳ لم تُعالج بعد — خارج نطاق 4B |
| V3 | `users`, `item_types` عبر SQL خام (accounting→identity/inventory) | ⏳ لم تُعالج بعد — المرحلة 5 لم تبدأ |
| C1-C4 | الحلقات الدائرية | جزئياً — C3 متبقية عمداً حتى المرحلة 6 |

الوثيقة التاريخية الأصلية (تاريخ المسح ونتائجه الأولية) تُركت دون تعديل كسجل تاريخي، وأُضيف القسم الجديد فوقها فقط.

---

## 6. الالتزام بالقواعد الصارمة للتوجيه

- **لا تغيير في السلوك التجاري:** كل استعلام أُعيد بناؤه بنفس المخرجات المنطقية (فقط تغيّر مصدر البيانات من استيراد مباشر إلى port).
- **لا تغيير في مخطط قاعدة البيانات:** صفر migrations.
- **لا حذف أو تعطيل اختبارات:** لم يُحذف أي اختبار؛ لم تكن هناك حاجة حتى لتحديث mocks (بخلاف المرحلة 4 حيث احتاج اختبار واحد لتحديث mock بسبب التسجيل المتأخر الجديد).
- **لا استثناءات مخفية في dependency-cruiser:** صفر exceptions أُضيفت — النتيجة 0 مخالفة بدون أي "تسكيت" للقاعدة.
- **لا خدمات مشتركة تحتوي منطق تجاري:** الـ services الجديدة (`InventoryTechnicianDataService`) هي طبقة بيانات بحتة (query فقط)، بدون قرارات تجارية.
- **لا نقل ملكية جداول دون عقد رسمي:** نقل `SupervisorRepository` كان انتقال **ملف كود** فقط (الجداول كانت أصلاً غير مملوكة فعلياً لـ identity منطقياً، وكان composition يعاملها كملك لـ inventory أصلاً) — تم تأكيد هذا القرار مع المستخدم قبل التنفيذ عبر سؤال مباشر، ولم يُتخذ من تلقاء نفسي.
- **كل مرحلة: tag قبل → تنفيذ → تحقق → commit → tag بعد:** تم بالكامل (`phase-4b/pre` → تنفيذ → بوابة تحقق كاملة → commit واحد → `phase-4b/post`).

---

## 7. ما تبقّى (لم يبدأ بعد، بانتظار توجيه منفصل)

بحسب ترتيب المراحل الأصلي (3 → 4 → 4B → 5 → 6 → 7 → 8)، الخطوة التالية منطقياً هي **المرحلة 5 (عزل accounting)** — وهي الأعلى خطورة من بين كل المراحل لأنها تتعامل مع الكتابة على بيانات مالية (فواتير، قيود محاسبية، مدفوعات). بناءً على توجيهكم الصريح السابق، لن أبدأ هذه المرحلة إلا بعد خطة منفصلة وموافقة مستقلة عليها — تماماً كما تم مع المرحلة 4B.

نقطتان أخريان متبقيتان خارج ترتيب المراحل الأساسي وذُكرتا في وثيقة الملكية كملاحظة (وليستا جزءاً من التزام هذه المرحلة):
- `courier_request_items` — قراءة inventory من جدول مملوك لـ courier.
- الفحص الأعمق لـ `no-circular` كقاعدة فعلية في dependency-cruiser (حالياً غير مفعّلة كقاعدة صريحة) — هذا نطاق المرحلة 6.
