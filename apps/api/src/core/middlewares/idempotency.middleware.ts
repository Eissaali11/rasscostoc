import { type Request, type Response, type NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@core/config/db";
import { idempotencyKeys } from "@shared/schema";

/**
 * Idempotency Middleware
 * تمنع تكرار معالجة الطلبات الحساسة (مثل القيود والتحويلات) عند إعادة إرسالها بنفس المفتاح.
 */
export async function idempotency(req: Request, res: Response, next: NextFunction) {
  // نقوم بفحص الطلبات من نوع POST, PUT, PATCH فقط
  if (!["POST", "PUT", "PATCH"].includes(req.method)) {
    return next();
  }

  const key = req.headers["x-idempotency-key"] || req.headers["X-Idempotency-Key"];

  if (!key || typeof key !== "string" || key.trim() === "") {
    return next();
  }

  const idempotencyKey = key.trim();

  // التحقق من صحة المفتاح (يجب أن يكون UUID أو طوله لا يقل عن 10 رموز للتأكيد)
  if (idempotencyKey.length < 10) {
    return res.status(400).json({
      message: "مفتاح منع التكرار المرسل غير صالح (Idempotency Key too short)",
    });
  }

  try {
    // 1. البحث عن المفتاح في قاعدة البيانات
    const [existing] = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, idempotencyKey))
      .limit(1);

    if (existing) {
      const now = new Date();
      
      // أ. إذا انتهت صلاحية المفتاح، نقوم بحذفه ونسمح للطلب بالمرور كطلب جديد
      if (existing.expiresAt < now) {
        await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, idempotencyKey));
      } else {
        // ب. إذا كان الطلب الأول قيد المعالجة حالياً (قفل مؤقت)
        if (existing.responseStatus === 102) {
          return res.status(409).json({
            message: "الطلب قيد المعالجة حالياً، يرجى المحاولة بعد قليل.",
            code: "PENDING_TRANSACTION",
          });
        }

        // ج. إذا كانت هناك استجابة مخزنة مسبقاً، نرجعها مباشرة للعميل
        try {
          const cachedBody = JSON.parse(existing.responseBody);
          return res.status(existing.responseStatus).json({
            ...cachedBody,
            _idempotent: true, // علامة للواجهة الأمامية لتوضيح أن الاستجابة مسترجعة من الذاكرة المؤقتة
          });
        } catch (e) {
          // في حال فشل القراءة النصية كـ JSON، نرسل النص الأصلي
          res.setHeader("Content-Type", "application/json");
          return res.status(existing.responseStatus).send(existing.responseBody);
        }
      }
    }

    // 2. إذا لم يكن المفتاح موجوداً، نضع قفل معالجة مؤقت (وضع حالة 102) وصلاحية قصيرة (5 دقائق)
    // ERP-008 Phase 4: هذا الإدراج هو نقطة القفل الذرّية الوحيدة (المفتاح
    // Primary Key). إذا وصل طلبان متزامنان بنفس المفتاح بعد أن اجتازا كلاهما
    // فحص SELECT أعلاه (قبل أن يُدرج أي منهما القفل)، فسينجح إدراج أحدهما
    // ويفشل الآخر بخطأ unique_violation (23505) — وهذا يعني أن طلبًا آخر
    // فاز بالسباق فعليًا، لا خطأ عاماً؛ يجب معاملته كقفل قيد المعالجة (409)
    // بدل تمريره إلى next() كما كان يحدث سابقًا (أثبتنا تنفيذ العملية
    // الحساسة مرتين فعليًا قبل هذا الإصلاح).
    const lockExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 دقائق للقفل في حال تعطل السيرفر
    try {
      await db.insert(idempotencyKeys).values({
        key: idempotencyKey,
        responseStatus: 102,
        responseBody: "",
        expiresAt: lockExpiry,
      });
    } catch (insertError: any) {
      if (insertError?.code === "23505") {
        return res.status(409).json({
          message: "الطلب قيد المعالجة حالياً، يرجى المحاولة بعد قليل.",
          code: "PENDING_TRANSACTION",
        });
      }
      throw insertError;
    }

    // 3. اعتراض وظائف إرسال الاستجابة (res.send / res.json) لتخزين النتيجة النهائية
    const originalSend = res.send;
    
    res.send = function (body: any): Response {
      // نعيد استعادة وظيفة res.send لمنع الاستدعاء الدائري
      res.send = originalSend;

      const statusCode = res.statusCode;

      // أ. إذا كانت العملية ناجحة (2xx أو 3xx)، نقوم بتخزين الاستجابة وتمديد الصلاحية لـ 24 ساعة
      if (statusCode >= 200 && statusCode < 400) {
        const bodyString = typeof body === "string" ? body : JSON.stringify(body);
        const finalExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ساعة

        db.update(idempotencyKeys)
          .set({
            responseStatus: statusCode,
            responseBody: bodyString,
            expiresAt: finalExpiry,
          })
          .where(eq(idempotencyKeys.key, idempotencyKey))
          .catch((err) => console.error("Failed to update idempotency response:", err));
      } else {
        // ب. إذا فشل الطلب (خطأ 4xx أو 5xx)، نحذف القفل حتى يتمكن العميل من المحاولة مرة أخرى
        db.delete(idempotencyKeys)
          .where(eq(idempotencyKeys.key, idempotencyKey))
          .catch((err) => console.error("Failed to delete idempotency lock on error:", err));
      }

      return originalSend.call(this, body);
    };

    next();
  } catch (error) {
    console.error("Idempotency middleware error:", error);
    // في حال حدوث خطأ داخلي في فحص التكرار، نسمح للطلب بالمرور كإجراء وقائي لعدم تعطيل الخدمة
    next();
  }
}
