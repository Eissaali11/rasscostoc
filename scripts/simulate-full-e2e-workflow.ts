import 'dotenv/config';
import pg from 'pg';

const BASE_URL = 'http://localhost:3001';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log("====================================================================");
  console.log("🚀 بدء محاكاة اختبار النظام بالكامل: النظام الرئيسي + الفني + الأدمن");
  console.log("====================================================================\n");

  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const posSerial = `SN-POS-SIM-${randSuffix}`;
  const simSerial = `SN-SIM-SIM-${randSuffix}`;

  // 1. تسجيل الدخول - الأدمن والفني
  console.log("🔑 [الخطوة 1] تسجيل دخول الأدمن والفني...");
  const adminToken = await login('admin', 'admin123');
  const techToken = await login('eissa', 'tech123');

  // جلب بيانات الفني للحصول على معرف المستخدم (id)
  const techMe = await getMe(techToken);
  const techId = techMe.user.id;
  console.log(`👤 تم تسجيل الفني: ${techMe.user.fullName} (ID: ${techId})`);

  // 2. إنشاء طلب التحويل من المستودع (أرقام فقط)
  console.log("\n📦 [الخطوة 2] الأدمن ينشئ طلب نقل عهدة (كميات فقط)...");
  const warehouseId = 'd5e8dfec-aa3a-4cf2-a4b7-59b701ac5e19'; // مستودع القصيم التجريبي
  
  const createRes = await fetch(`${BASE_URL}/api/warehouse-transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      warehouseId,
      technicianId: techId,
      notes: "طلب عهدة تجريبي من المحاكاة E2E",
      items: [
        { itemType: "n950", packagingType: "unit", quantity: 1 },
        { itemType: "lebaraSim", packagingType: "unit", quantity: 1 },
        { itemType: "rollPaper", packagingType: "unit", quantity: 3 }
      ]
    })
  });

  if (!createRes.ok) {
    throw new Error(`فشل إنشاء طلب النقل: ${await createRes.text()}`);
  }
  const createData = await createRes.json();
  console.log("✅ تم إنشاء طلب النقل بنجاح:", createData);

  // 3. جلب معرفات طلبات النقل المنشأة حديثاً
  console.log("\n🔍 [الخطوة 3] جلب طلبات النقل المعلقة للفني...");
  const transfersRes = await fetch(`${BASE_URL}/api/warehouse-transfers`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const allTransfers = await transfersRes.json();
  
  const pendingTransfers = allTransfers.filter((t: any) => 
    t.technicianId === techId && 
    t.status === 'pending'
  );

  console.log(`발جدنا ${pendingTransfers.length} طلبات نقل معلقة للفني.`);
  if (pendingTransfers.length === 0) {
    throw new Error("لم يتم العثور على طلبات نقل معلقة.");
  }

  // 4. الفني يقبل طلبات التحويل (Technician Accepts Request)
  console.log("\n📥 [الخطوة 4] تطبيق الفني: قبول طلبات التحويل...");
  for (const transfer of pendingTransfers) {
    console.log(`⚙️ قبول طلب رقم: ${transfer.id} للمادة: ${transfer.itemType}`);
    const acceptRes = await fetch(`${BASE_URL}/api/warehouse-transfers/${transfer.id}/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${techToken}` }
    });
    if (!acceptRes.ok) {
      throw new Error(`فشل قبول الطلب: ${await acceptRes.text()}`);
    }
  }
  console.log("✅ تم قبول جميع الطلبات بنجاح.");

  // 5. الفني يمسح الأرقام التسلسلية للأجهزة والشرائح (Scan-in)
  console.log("\n📸 [الخطوة 5] تطبيق الفني: مسح الأرقام التسلسلية واستلام العهدة...");
  
  const posTransfer = pendingTransfers.find((t: any) => t.itemType === 'n950');
  const simTransfer = pendingTransfers.find((t: any) => t.itemType === 'lebaraSim');
  const paperTransfer = pendingTransfers.find((t: any) => t.itemType === 'rollPaper');

  if (posTransfer) {
    console.log(`📱 مسح الجهاز بالرقم التسلسلي: ${posSerial}`);
    const scanPosRes = await fetch(`${BASE_URL}/api/warehouse-transfers/${posTransfer.id}/scan-serial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${techToken}`
      },
      body: JSON.stringify({ serialNumber: posSerial })
    });
    if (!scanPosRes.ok) {
      throw new Error(`فشل مسح الجهاز: ${await scanPosRes.text()}`);
    }
    console.log("✅ تم تسجيل واستلام الجهاز بنجاح.");
  }

  if (simTransfer) {
    console.log(`💳 مسح الشريحة بالرقم التسلسلي: ${simSerial}`);
    const scanSimRes = await fetch(`${BASE_URL}/api/warehouse-transfers/${simTransfer.id}/scan-serial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${techToken}`
      },
      body: JSON.stringify({ serialNumber: simSerial })
    });
    if (!scanSimRes.ok) {
      throw new Error(`فشل مسح الشريحة: ${await scanSimRes.text()}`);
    }
    console.log("✅ تم تسجيل واستلام الشريحة بنجاح.");
  }

  // 6. الفني يؤكد استلام العهدة كاملة
  console.log("\n✔️ [الخطوة 6] تطبيق الفني: تأكيد استلام العهدة بالكامل (Confirm Receipt)...");
  for (const transfer of pendingTransfers) {
    const confirmRes = await fetch(`${BASE_URL}/api/warehouse-transfers/${transfer.id}/confirm-receipt`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${techToken}` }
    });
    if (!confirmRes.ok) {
      throw new Error(`فشل تأكيد الاستلام للطلب ${transfer.id}: ${await confirmRes.text()}`);
    }
  }
  console.log("✅ تم تأكيد الاستلام بنجاح، وتحويل حالة الطلبات إلى approved.");

  // 7. التحقق من عهدة الفني (مخزوني) بالتطبيق
  console.log("\n📊 [الخطوة 7] تطبيق الفني: التحقق من شاشة عهدتي (My Custody)...");
  const custodyRes = await fetch(`${BASE_URL}/api/my-serialized-custody`, {
    headers: { 'Authorization': `Bearer ${techToken}` }
  });
  const custodyItems = await custodyRes.json();
  console.log("📦 الأجهزة والشرائح المسلسلة بعهدة الفني حالياً:");
  custodyItems.forEach((item: any) => {
    console.log(`- ${item.itemTypeNameAr} (${item.serialNumber}) | الحالة: ${item.status}`);
  });

  const fixedInvRes = await fetch(`${BASE_URL}/api/technicians/${techId}/fixed-inventory-entries`, {
    headers: { 'Authorization': `Bearer ${techToken}` }
  });
  const fixedInv = await fixedInvRes.json();
  console.log("📰 المواد غير المسلسلة (المخزون الثابت):");
  fixedInv.forEach((entry: any) => {
    console.log(`- ${entry.itemTypeId}: ${entry.units} وحدات`);
  });

  // 8. الأدمن يتحقق ويسلم الأجهزة للعميل (Admin Verification & Delivery)
  console.log("\n🖥️ [الخطوة 8] تطبيق الأدمن: التحقق من الأرقام وتسليمها للعميل...");
  
  // البحث عن معرفات العناصر (item ids) في النظام
  const posItemInfo = await lookupItem(adminToken, posSerial);
  const simItemInfo = await lookupItem(adminToken, simSerial);

  console.log(`🔍 تم العثور على الجهاز: ${posItemInfo.serialNumber} (ID: ${posItemInfo.id}) بعهدة: ${posItemInfo.ownerName}`);
  console.log(`🔍 تم العثور على الشريحة: ${simItemInfo.serialNumber} (ID: ${simItemInfo.id}) بعهدة: ${simItemInfo.ownerName}`);

  // الأدمن يقوم بالتسليم للعميل (Deduction from Custody Ledger)
  console.log(`⚙️ تسليم الجهاز (${posSerial}) للعميل وإخراجه من العهدة...`);
  await updateItemStatus(adminToken, posItemInfo.id, 'DELIVERED', 'ORD-SIMULATED-99');
  
  console.log(`⚙️ تسليم الشريحة (${simSerial}) للعميل وإخراجها من العهدة...`);
  await updateItemStatus(adminToken, simItemInfo.id, 'DELIVERED', 'ORD-SIMULATED-99');

  // الأدمن يخصم المواد المستهلكة (رول الورق) من المخزون الثابت للفني (صرف 2 ورق)
  // الفني كان لديه 3 ورق، الآن نحدث القيمة لتصبح 1
  console.log("⚙️ خصم 2 رول ورق من المخزون الثابت للفني (المتبقي: 1)...");
  const deductRes = await fetch(`${BASE_URL}/api/technicians/${techId}/fixed-inventory-entries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      itemTypeId: 'rollPaper',
      boxes: 0,
      units: 1
    })
  });
  if (!deductRes.ok) {
    throw new Error(`فشل تحديث المخزون الثابت: ${await deductRes.text()}`);
  }
  console.log("✅ تم خصم رول الورق بنجاح.");

  // 9. التحقق من زوال العهدة وتحديث المخزون
  console.log("\n📊 [الخطوة 9] التحقق من زوال العهدة النشطة بعد التسليم للعميل...");
  const updatedCustodyRes = await fetch(`${BASE_URL}/api/my-serialized-custody`, {
    headers: { 'Authorization': `Bearer ${techToken}` }
  });
  const updatedCustody = await updatedCustodyRes.json();
  console.log("📦 الأجهزة والشرائح النشطة بعهدة الفني الآن (يجب أن تكون فارغة أو لا تحتوي على ما تم تسليمه):");
  const stillInCustody = updatedCustody.filter((x: any) => x.serialNumber === posSerial || x.serialNumber === simSerial);
  if (stillInCustody.length === 0) {
    console.log("✅ ممتاز! زالت عهدة الأجهزة المسلمة من الفني بالكامل.");
  } else {
    console.log("⚠️ تحذير: الأجهزة لا تزال مسجلة بعهدة الفني.");
  }

  const updatedFixedRes = await fetch(`${BASE_URL}/api/technicians/${techId}/fixed-inventory-entries`, {
    headers: { 'Authorization': `Bearer ${techToken}` }
  });
  const updatedFixed = await updatedFixedRes.json();
  console.log("📰 المخزون الثابت المتبقي للفني:");
  updatedFixed.forEach((entry: any) => {
    console.log(`- ${entry.itemTypeId}: ${entry.units} وحدات`);
  });

  // 10. طباعة سجل العهدة الدائم (Custody Ledger Table)
  console.log("\n📑 [الخطوة 10] قراءة سجل العهدة الدائم (custody_movements) من قاعدة البيانات...");
  const ledgerResult = await pool.query(
    `SELECT cm.*, u.full_name as performed_by_name
     FROM custody_movements cm
     LEFT JOIN users u ON cm.performed_by_id = u.id
     WHERE cm.item_id = $1 OR cm.item_id = $2
     ORDER BY cm.performed_at ASC`,
    [posItemInfo.id, simItemInfo.id]
  );

  console.log(`🧾 عدد الحركات اللوجستية المسجلة للأصول في السجل الدائم: ${ledgerResult.rows.length}`);
  ledgerResult.rows.forEach(row => {
    console.log(`----------------------------------------------------------------`);
    console.log(`- الحركة: ${row.id}`);
    console.log(`  الأصل (Item ID): ${row.item_id}`);
    console.log(`  من الحائز (From): ${row.from_owner_id || 'بلا مالك (جديد)'}`);
    console.log(`  إلى الحائز (To): ${row.to_owner_id || 'بلا مالك (مسلم للعميل)'}`);
    console.log(`  السبب (Reason): ${row.reason}`);
    console.log(`  مرجع المستند (Ref): ${row.reference_type} [ID: ${row.reference_id}]`);
    console.log(`  بواسطة (By): ${row.performed_by_name} [${row.performed_by_id}]`);
    console.log(`  التاريخ (At): ${row.performed_at}`);
  });

  console.log("\n====================================================================");
  console.log("🎉 تم الانتهاء بنجاح تام من محاكاة اختبار دورة الحياة والعهدة Ledger!");
  console.log("====================================================================");

  await pool.end();
  process.exit(0);
}

async function login(username: string, pass: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: pass })
  });
  if (!res.ok) {
    throw new Error(`فشل تسجيل الدخول لـ ${username}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.token;
}

async function getMe(token: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`فشل جلب الملف الشخصي: ${await res.text()}`);
  }
  return res.json();
}

async function lookupItem(token: string, serialNumber: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/items/lookup/${serialNumber}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`فشل البحث عن السيريال ${serialNumber}: ${await res.text()}`);
  }
  return res.json();
}

async function updateItemStatus(token: string, itemId: string, status: string, orderNumber: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/items/${itemId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status, orderNumber })
  });
  if (!res.ok) {
    throw new Error(`فشل تحديث حالة السيريال ${itemId}: ${await res.text()}`);
  }
  return res.json();
}

main().catch(async err => {
  console.error("\n❌ فشل المحاكاة:", err);
  await pool.end();
  process.exit(1);
});
