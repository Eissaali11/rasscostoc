---
title: "وكيل A1 — بنية المستودع (Monorepo Health)"
status: "❌ إشكالية"
verdict: "PARTIAL_REWRITE"
date: "2026-07-11"
---

# وكيل A1 — بنية المستودع (Monorepo Health)

* **التقييم:** ❌ إشكالية
* **الحكم النهائي:** `PARTIAL_REWRITE`

---

### 1. تحليل الاعتماديات وهيكلية الحزم
* **المشكلة الأساسية:** بالرغم من استخدام npm workspaces ووجود مجلد `packages/` يحتوي على حزم فرعية مثل `@stockpro/core` و `@stockpro/ui` و `@stockpro/shared-types`، إلا أن هناك تداخلاً كبيراً في الاعتماديات.
* يتم تثبيت معظم الـ dependencies والـ devDependencies في الـ Root `package.json` بدلاً من الحزم الفردية.
* الحزم الفرعية داخل `packages/` هي في الغالب هياكل شبه فارغة (مثل `packages/ui` لا يحتوي إلا على زر `button.tsx` يتيم، و `packages/core` يحتوي على DDD primitives لا يتم استيرادها إطلاقاً في الـ API أو الـ Portal).

### 2. تهيئة Turbo
* الـ `turbo.json` بسيط جداً ومقتصر على مهام أساسية (`build`, `lint`, `dev`, `test:unit`). لا يستفيد المشروع من قدرات Caching المتقدمة لـ Turbo بسبب تداخل الملفات والاعتماديات في جذر المشروع.

### 3. الحكم النهائي
**PARTIAL_REWRITE**
تصلح بنية المجلدات كبداية، ولكن يجب إعادة هيكلة الاعتماديات بالكامل لتصبح حزم مستقلة حقيقية بدلاً من Monorepo "شكلي" يعتمد بالكامل على الـ root node_modules.
