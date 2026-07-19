# تقرير المرحلة 5C — تضييق عقد SupervisorTechnicianDisplayPort

**التاريخ:** 2026-07-17
**الفرع:** `erp-005a-4/data-ownership`
**التاغات:** `ERP-005A-4/phase-5c/pre` → `ERP-005A-4/phase-5c/post`
**الحالة:** ✅ مكتملة — عمل معماري حقيقي (على عكس المرحلة 5B)

---

## 1. سبب تنفيذ المرحلة

في المرحلة 4B، تم إنشاء `SupervisorTechnicianDisplayPort` كحل وسط موثّق صراحة: العقد المنشور `ISupervisorAssignmentsRepository.getSupervisorTechnicians` (في `packages/contracts/`) كان يُلزم المستدعين بإرجاع `Promise<UserSafe[]>` — أي صف المستخدم الكامل تقريباً (~15 حقلاً: البريد، الصلاحيات، القسم، إلخ). بدلاً من تغيير هذا العقد المنشور في حينه، أُنشئ port يجلب صفوف `UserSafe` الكاملة عبر `IUserRepository.getUsersByIds` الخاصة بـ identity، مع توثيق صريح بأن هذا استثناء مؤقت يستحق إعادة نظر لاحقاً. هذه المرحلة هي تلك المراجعة.

---

## 2. تحليل العقد الحالي

تم تتبّع **كل** مستهلك فعلي لنتيجة `getSupervisorTechnicians` في النظام بأكمله (عبر بحث شامل، وليس افتراضاً):

- **المستهلك الفعلي الوحيد** هو `SupervisorAssignmentsUseCase.getTechnicianIdsBySupervisor`، والذي ينفّذ:
  ```ts
  const technicians = await this.repository.getSupervisorTechnicians(supervisorId);
  return technicians.map((technician) => technician.id);
  ```
  أي أنه يقرأ حقل `.id` فقط، ويتجاهل كل الحقول الأخرى فوراً.
- هذا الـ use case له 3 نقاط استدعاء فقط، جميعها في طبقة عرض inventory:
  - أحدها تبيّن أنه **كود ميت غير قابل للوصول** — تسجيل مسار مكرر (`GET /api/supervisor/technicians`) يعني أن معالجاً مختلفاً تماماً (`supervisor-technicians-list.routes.ts`) هو من يخدم هذا المسار فعلياً في الإنتاج، ولا يمرّ إطلاقاً عبر هذا العقد.
  - الاثنان الآخران إما يعيدان جلب بيانات المستخدم الكاملة بشكل منفصل (متجاهلَين الحقول الإضافية التي كان يعيدها هذا العقد أصلاً)، أو يعيدان مصفوفة معرّفات مجردة كـ JSON مباشرة.
- **لا يوجد أي اختبار** يتحقق من أي حقل غير حقل `.id` المُجمّع.
- **لا يوجد أي كود frontend/portal** يعتمد على المخرجات الكاملة لهذا العقد تحديداً — استدعاءات `apps/portal` التي تتوقع حقولاً كاملة (`fullName`, `username`, `city`) تُخدَم فعلياً عبر المسار المظلِّل المذكور أعلاه، وليس عبر هذا الـ port.
- ملف مكرر غير مستخدم (`modules/identity/application/users/contracts/ISupervisorAssignmentsRepository.ts`) تم تأكيد كونه ميتاً تماماً (صفر استيراد له في أي مكان).

**الخلاصة:** حقل `.id` هو فعلاً الحد الأدنى المطلق من البيانات المطلوبة — لا توجد أي تبعية مستقبلية محتملة ظاهرة في الكود الحالي. هذا على عكس المرحلة 5B (حيث لم يكن هناك خرق فعلي إطلاقاً)؛ هنا يوجد عمل تضييق حقيقي ومبرر بالكامل.

---

## 3. قرار التصميم: إزالة الـ Port بالكامل، وليس فقط تضييق الـ DTO

بما أن `SupervisorAssignmentsRepository.getSupervisorTechnicians` يملك معرّفات الفنيين أصلاً من استعلامه الخاص على جدول `supervisor_technicians` (جدول مملوك لـ inventory) **قبل** أن يستدعي port الهوية إطلاقاً، وبما أن الشيء الوحيد المطلوب لاحقاً هو نفس هذه المعرّفات، فإن تضييق الـ DTO إلى `{ id: string }` يجعل استدعاء port الهوية نفسه **غير ضروري بالمرة** — inventory يملك بالفعل كل ما يحتاجه من جدوله الخاص.

لذلك تجاوزت هذه المرحلة "تصغير حجم البيانات" (الحد الأدنى المطلوب في التوجيه) إلى **إزالة رحلة شبكة/قاعدة بيانات كاملة إلى identity** — تحسين أداء حقيقي، وليس فقط حمولة أصغر، مع صفر تغيير في السلوك للمستهلك الفعلي الوحيد.

---

## 4. الـ DTO الجديد

```ts
// packages/contracts/src/repositories/ISupervisorAssignmentsRepository.ts
export interface SupervisorTechnicianReference {
  id: string;
}
```

يحل محل `UserSafe[]` بالكامل في توقيع `getSupervisorTechnicians`.

---

## 5. الملفات المعدّلة

| الملف | التغيير |
|---|---|
| `packages/contracts/src/repositories/ISupervisorAssignmentsRepository.ts` | إضافة `SupervisorTechnicianReference`، تضييق توقيع `getSupervisorTechnicians` |
| `apps/api/src/modules/inventory/infrastructure/database/SupervisorAssignmentsRepository.ts` | إعادة كتابة `getSupervisorTechnicians` لبناء `{id}` مباشرة من نتيجة الاستعلام المحلي، **بدون أي استدعاء لـ `getInventoryIdentityPorts()`** |
| `apps/api/src/modules/inventory/application/ports/SupervisorTechnicianDisplayPort.ts` | **حُذف بالكامل** — لم يعد له أي مستهلك |
| `apps/api/src/modules/inventory/infrastructure/adapters/identity/IdentityPortsAdapter.ts` | إزالة `implements SupervisorTechnicianDisplayPort` وmethod `getUserSafeRowsByIds` |
| `apps/api/src/modules/inventory/infrastructure/adapters/identity/identity-ports.registry.ts` | إزالة `SupervisorTechnicianDisplayPort` من `InventoryIdentityPorts` المجمّعة |
| `apps/api/src/modules/identity/application/users/use-cases/SupervisorAssignments.use-case.test.ts` | تضييق `technicianFixture()` من `UserSafe` الكاملة إلى `{id}` فقط |
| `apps/api/src/modules/identity/application/users/contracts/ISupervisorAssignmentsRepository.ts` | **حُذف** — ملف مكرر ميت مؤكد (صفر استيراد) |

**الحقول التي أُزيلت من العقد:** `username`, `email`, `profileImage`, `city`, `role`, `regionId`, `employeeCode`, `technicianCode`, `department`, `permissions`, `isActive`, `createdAt`, `updatedAt` — كل شيء ما عدا `id`.

---

## 6. نتائج الاختبارات

| الفحص | النتيجة |
|---|---|
| `npx tsc --noEmit` | نظيف بدون أخطاء (بعد كل تعديل) |
| بحث شامل عن أي مرجع متبقٍ لـ `SupervisorTechnicianDisplayPort`/`getUserSafeRowsByIds` | **صفر مرجع** في كامل `apps/api/src` |
| `npm run lint:architecture:strict` | **0 مخالفة** (529 module — انخفض بمقدار 2 module بعد حذف الملفين الميتين، 1689 تبعية) |
| فحص الحلقات الدائرية | **حلقتان فقط**، بدون تغيير |
| `npm run test:unit` | **66/66 ملف اختبار، 280/280 اختبار ناجح** — مطابق تماماً لحالة نهاية المرحلة 5B، بدون أي تراجع |

---

## 7. مقارنة قبل/بعد

| المقياس | قبل | بعد |
|---|---|---|
| عدد الاستعلامات لـ `getSupervisorTechnicians` | 2 (استعلام محلي + استدعاء port → استعلام identity) | **1** (استعلام محلي فقط) |
| حجم البيانات المنقولة لكل فني | ~15 حقلاً (`UserSafe`) | **حقل واحد** (`id`) |
| اعتماد عبر الوحدات لهذه العملية | inventory → identity (عبر port) | **لا يوجد** — العملية بأكملها داخل inventory |
| السلوك الوظيفي للمستهلك الوحيد (`getTechnicianIdsBySupervisor`) | يُرجع مصفوفة معرّفات | **مطابق تماماً** — نفس المخرجات، نفس الترتيب |

---

## 8. اكتشاف خارج النطاق (موثّق، لم يُصلح)

أثناء تحليل المستهلكين، تبيّن أن معالج `techniciansController.getSupervisorTechnicians` **كود ميت غير قابل للوصول فعلياً** — بسبب تسجيل مسار `GET /api/supervisor/technicians` مرتين في ملفي routes مختلفين، حيث يفوز المسجَّل أولاً (`supervisor-technicians-list.routes.ts`) ولا يصل الطلب أبداً للمعالج الثاني. هذا خلل حقيقي وسابق لهذا المشروع، لكنه **غير مرتبط بملكية البيانات** — هو مشكلة ترتيب تسجيل مسارات (routing bug). تماشياً مع توجيهكم الصريح بعدم خلط إصلاحات غير مرتبطة بنطاق المرحلة، تم توثيقه هنا فقط ولم يُمسّ الكود.

---

## 9. الالتزام بقواعد التوجيه

- **لا تغيير في منطق الأعمال:** المستهلك الوحيد (`getTechnicianIdsBySupervisor`) يعمل بنفس الطريقة تماماً — `{id}.id` يساوي `UserSafe.id`.
- **لا كسر لعقد منشور دون طبقة توافق:** تم التحقق الشامل أولاً من عدم وجود أي مستهلك حقيقي آخر يعتمد على الحقول المحذوفة، فلم تكن طبقة التوافق ضرورية — القرار مبني على أدلة لا افتراضات، تماماً كما يشترط التوجيه.
- **لا N+1:** بل تحسّن العدد من 2 إلى 1 استعلام.
- **لا تعطيل أو حذف اختبارات:** لم يُحذف أي اختبار؛ تم فقط تحديث نوع بيانات fixture واحدة (تضييق النوع، وليس تغيير التوقعات).
- **commit واحد:** التزام كامل.

---

## 10. Commit SHA والتاغ

- **Tag قبل:** `ERP-005A-4/phase-5c/pre`
- **Tag بعد:** `ERP-005A-4/phase-5c/post`
- **Commit SHA:** انظر سجل git.

---

## 11. القرار النهائي

```
PASS — تم تضييق العقد إلى الحد الأدنى الحقيقي المستخدم، مع إزالة استدعاء
عبر الوحدات كان غير ضروري بالمرة، دون أي تغيير في السلوك الوظيفي، وبتحسين
في عدد الاستعلامات. آخر دين تقني موثّق في ملفات ملكية البيانات أُزيل بالكامل.
```

---

## 12. ما تبقّى

بعد هذه المرحلة، لا يوجد أي دين تقني معروف متعلق بعقود ملكية البيانات. الانتهاك الوحيد المتبقي في `DATA-OWNERSHIP-MATRIX.md` هو الحلقة الدائرية C3 بين `tracer.ts` و`metrics.ts`، وهي ضمن نطاق **المرحلة 6** فقط.

توقفت هنا تماماً كما يشترط التوجيه — لن أبدأ المرحلة 6 أو 7 أو 8 دون موافقة صريحة منفصلة.
