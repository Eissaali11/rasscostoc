---
title: "وكيل B14 — تسريب البيانات في السجلات"
status: "💀 حرج"
verdict: "PARTIAL_REWRITE"
date: "2026-07-11"
---

# وكيل B14 — تسريب البيانات في السجلات

* **التقييم:** 💀 حرج
* **الحكم النهائي:** `PARTIAL_REWRITE`

---

### 1. تسريب البيانات الحساسة بالـ Logs
* **المشكلة الكبرى:** يقوم لوغر الاستجابة في `app.ts` بالتقاط وتحويل كامل جسم الاستجابة (Response Body) إلى JSON وطباعته في السجلات:
  `logLine += " :: " + JSON.stringify(capturedJsonResponse);`
* يؤدي هذا مباشرة لتسجيل الـ Access Token، والـ Refresh Token، والـ PII (بيانات المستخدم الشخصية) عند نجاح تسجيل الدخول `/api/auth/login`.

### 2. الحكم النهائي
**PARTIAL_REWRITE**
يجب فوراً تعديل لوغر الـ API لتصفية وحجب الحقول الحساسة (مثل `token`, `password`, `refreshToken`) قبل طباعتها بالـ Logs.
