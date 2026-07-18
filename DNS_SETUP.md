# 🌐 إعداد DNS للنطاق stoc.fun

## ✅ **الحالة الحالية:**
- ✅ SSL Certificate مثبت (Let's Encrypt)
- ✅ Cloud Panel يعرف النطاق
- ❌ DNS غير مضبوط (NXDOMAIN)

---

## 🔧 **خطوات إعداد DNS:**

### **1. في Domain Registrar (مزود النطاق):**

اذهب إلى إعدادات DNS للنطاق `stoc.fun` وأضف:

#### **A Record:**
```
Type: A
Name: @ (أو stoc أو اتركه فارغاً)
Value: <SERVER_IP>
TTL: 3600 (أو أقل)
```

#### **A Record لـ www:**
```
Type: A
Name: www
Value: <SERVER_IP>
TTL: 3600
```

---

### **2. التحقق من DNS:**

بعد إضافة Records، انتظر 5-10 دقائق ثم اختبر:

```bash
# على جهازك (Windows PowerShell)
nslookup stoc.fun

# يجب أن يظهر:
# Name: stoc.fun
# Address: <SERVER_IP>
```

---

### **3. إذا كان النطاق غير مسجل:**

إذا لم يكن لديك نطاق `stoc.fun` مسجل:

#### **الخيار 1: تسجيل النطاق**
- اذهب إلى أي Domain Registrar (Namecheap, GoDaddy, إلخ)
- سجّل النطاق `stoc.fun`
- ثم أضف DNS Records كما هو موضح أعلاه

#### **الخيار 2: استخدام subdomain من نطاق موجود**
إذا كان لديك نطاق آخر (مثل `yourdomain.com`):
- أضف A Record:
  ```
  Type: A
  Name: stoc
  Value: <SERVER_IP>
  ```
- في Cloud Panel، غيّر Domain إلى `stoc.yourdomain.com`

---

## ⏱️ **الانتظار:**

بعد إضافة DNS Records:
- **الحد الأدنى**: 5-10 دقائق
- **المعتاد**: 1-2 ساعة
- **الحد الأقصى**: 24-48 ساعة

---

## 🧪 **التحقق:**

بعد الانتظار:

```bash
# على جهازك
nslookup stoc.fun
ping stoc.fun
```

إذا ظهر IP `<SERVER_IP>`، DNS يعمل!

---

## 🌐 **بعد أن يعمل DNS:**

1. افتح: `https://stoc.fun`
2. سجّل الدخول:
   - **Username**: `admin`
   - **Password**: `admin123`

---

**هل لديك نطاق `stoc.fun` مسجل؟ أم تريد استخدام subdomain من نطاق آخر؟**
