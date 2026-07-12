---
title: "وكيل A2 — بنية الباك-إند (App Architecture)"
status: "❌ إشكالية"
verdict: "PARTIAL_REWRITE"
date: "2026-07-11"
---

# وكيل A2 — بنية الباك-إند (App Architecture)

* **التقييم:** ❌ إشكالية
* **الحكم النهائي:** `PARTIAL_REWRITE`

---

### 1. تحليل طبقات Clean Architecture
* **المشكلة:** يتبع المشروع ظاهرياً تقسيم الطبقات (`domain` -> `application` -> `infrastructure` -> `presentation`).
* لكن عند تتبع تدفق الطلبات، نجد تسريباً فادحاً للمنطق البرمجي (Business Logic) وعمليات قاعدة البيانات مباشرة داخل الـ Routes في طبقة Presentation (مثال: `warehouse-transfer-operations.routes.ts` يحتوي على عمليات `db.select` و `db.insert` معقدة، وتحقق من السيريال، وتحديث المخزون دون المرور بـ Use Case أو Repository).

### 2. الـ Composition Root
* الـ Container والـ dependency injection يتم يدوياً وتنقصه الهيكلية المركزية الواضحة، مما أدى لتكرار استدعاءات قاعدة البيانات مباشرة وتخطي الـ Use Cases في العديد من المسارات الحيوية.

### 3. الحكم النهائي
**PARTIAL_REWRITE**
البنية التحتية والموديلات صالحة للبناء عليها، ولكن طبقة Presentation والـ Controllers تحتاج لإعادة كتابة لفصل منطق العمل عن بروتوكول HTTP.
