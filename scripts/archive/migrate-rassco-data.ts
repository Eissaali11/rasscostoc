import 'dotenv/config';
import Database from 'better-sqlite3';
import { db } from "../apps/api/src/core/config/db";
import {
  users,
  courierCities,
  courierSimTypes,
  courierVendorTypes,
  courierFailureReasons,
  courierRequests,
  courierExecutions,
  courierPdfReports,
  courierAuditLogs
} from "../packages/shared-types/schema";
import { eq, or } from 'drizzle-orm';
import path from 'path';

const SQLITE_DB_PATH = "c:\\Users\\TWc\\Downloads\\NULEB\\RASSCO\\data\\neoleap.db";

async function main() {
  console.log("🚀 Starting data migration from RASSCO SQLite to StockPro PostgreSQL...");

  // 1. Initialize SQLite Connection
  const sqliteDb = new Database(SQLITE_DB_PATH, { readonly: true });
  console.log(`✅ Connected to SQLite at: ${SQLITE_DB_PATH}`);

  // 2. Clean up target tables in correct dependency order to prevent FK violations
  console.log("🧹 Cleaning up existing PostgreSQL tables in dependency order...");
  await db.delete(courierPdfReports);
  await db.delete(courierExecutions);
  await db.delete(courierAuditLogs);
  await db.delete(courierRequests);
  await db.delete(courierFailureReasons);
  await db.delete(courierCities);
  await db.delete(courierSimTypes);
  await db.delete(courierVendorTypes);
  console.log("🧹 Cleanup complete.");

  // 3. Migrate / Sync Users
  console.log("👤 Syncing users...");
  const sqliteUsers = sqliteDb.prepare("SELECT * FROM users").all() as any[];
  const userMap = new Map<number, string>(); // sqliteId -> pgUuid

  for (const sUser of sqliteUsers) {
    // Check if user exists in Postgres by username
    const [existingPgUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, sUser.username))
      .limit(1);

    if (existingPgUser) {
      console.log(`   - User '${sUser.username}' already exists in PostgreSQL (UUID: ${existingPgUser.id})`);
      userMap.set(sUser.id, existingPgUser.id);
    } else {
      // Create new user in Postgres
      let pgRole = "technician";
      if (sUser.role === "admin") pgRole = "admin";
      else if (sUser.role === "supervisor") pgRole = "supervisor";

      const [newPgUser] = await db
        .insert(users)
        .values({
          username: sUser.username,
          email: `${sUser.username}@stockpro.local`,
          password: sUser.password_hash, // Keep hash
          fullName: sUser.name || sUser.username,
          role: pgRole,
          isActive: sUser.active === 1,
        })
        .returning();

      console.log(`   - Created user '${sUser.username}' in PostgreSQL (UUID: ${newPgUser.id})`);
      userMap.set(sUser.id, newPgUser.id);
    }
  }

  // 4. Migrate Cities
  console.log("🏙️ Migrating cities...");
  const sqliteCities = sqliteDb.prepare("SELECT * FROM cities").all() as any[];
  for (const city of sqliteCities) {
    await db.insert(courierCities).values({
      id: city.id,
      nameEn: city.name_en,
      nameAr: city.name_ar,
    });
  }
  console.log(`   - Migrated ${sqliteCities.length} cities`);

  // 5. Migrate SIM Types
  console.log("📶 Migrating SIM types...");
  const sqliteSimTypes = sqliteDb.prepare("SELECT * FROM sim_types").all() as any[];
  for (const sim of sqliteSimTypes) {
    await db.insert(courierSimTypes).values({
      id: sim.id,
      name: sim.name,
    });
  }
  console.log(`   - Migrated ${sqliteSimTypes.length} SIM types`);

  // 6. Migrate Vendor Types
  console.log("🖥️ Migrating vendor types...");
  const sqliteVendorTypes = sqliteDb.prepare("SELECT * FROM vendor_types").all() as any[];
  for (const vendor of sqliteVendorTypes) {
    await db.insert(courierVendorTypes).values({
      id: vendor.id,
      name: vendor.name,
    });
  }
  console.log(`   - Migrated ${sqliteVendorTypes.length} vendor types`);

  // 7. Migrate Failure Reasons
  console.log("⚠️ Migrating failure reasons...");
  const sqliteReasons = sqliteDb.prepare("SELECT * FROM failure_reasons").all() as any[];
  for (const r of sqliteReasons) {
    await db.insert(courierFailureReasons).values({
      id: r.id,
      code: r.code,
      labelEn: r.label_en,
      labelAr: r.label_ar,
      suggestedNoteEn: r.suggested_note_en,
      suggestedNoteAr: r.suggested_note_ar,
      requiresField: r.requires_field,
      active: r.active === 1,
      sortOrder: r.sort_order,
    });
  }
  console.log(`   - Migrated ${sqliteReasons.length} failure reasons`);

  // 8. Migrate Requests (Orders)
  console.log("📦 Migrating requests...");
  const sqliteRequests = sqliteDb.prepare("SELECT * FROM requests").all() as any[];
  const requestMap = new Map<number, number>(); // sqliteRequestId -> pgRequestId

  for (const req of sqliteRequests) {
    const createdByUuid = req.created_by ? userMap.get(req.created_by) : null;
    const [newReq] = await db
      .insert(courierRequests)
      .values({
        date: req.date,
        installationType: req.installation_type,
        sim: req.sim,
        tid: req.tid,
        otp: req.otp,
        ticketingHolouly: req.ticketing_holouly,
        incidentNumber: req.incident_number,
        pinCode: req.pin_code,
        trsm: req.trsm,
        terminalId: req.terminal_id,
        simSn: req.sim_sn,
        idData: req.id_data,
        vendorType: req.vendor_type,
        city: req.city,
        cityTec: req.city_tec,
        customerName: req.customer_name,
        retailerName: req.retailer_name,
        addressAr: req.address_ar,
        addressEn: req.address_en,
        mobile: req.mobile,
        mobile2: req.mobile2,
        tecName: req.tec_name,
        createdBy: createdByUuid,
        createdAt: req.created_at ? new Date(req.created_at) : new Date(),
        updatedAt: req.updated_at ? new Date(req.updated_at) : new Date(),
      })
      .returning();
    requestMap.set(req.id, newReq.id);
  }
  console.log(`   - Migrated ${sqliteRequests.length} requests`);

  // 9. Migrate Executions
  console.log("⚙️ Migrating executions...");
  const sqliteExecutions = sqliteDb.prepare("SELECT * FROM executions").all() as any[];

  for (const exec of sqliteExecutions) {
    const pgRequestId = requestMap.get(exec.request_id);
    if (!pgRequestId) {
      console.warn(`   ⚠️ Warning: No matching request in PG for SQLite request_id: ${exec.request_id}. Skipping.`);
      continue;
    }
    const enteredByUuid = exec.entered_by ? userMap.get(exec.entered_by) : null;

    await db
      .insert(courierExecutions)
      .values({
        requestId: pgRequestId,
        requestPriorityLevel: exec.request_priority_level,
        pushBack: exec.push_back,
        installationStatus: exec.installation_status,
        paperRoll: exec.paper_roll,
        time: exec.time,
        deliveryDate: exec.delivery_date,
        responseDate: exec.response_date,
        sn: exec.sn,
        simSerial: exec.sim_serial,
        simType: exec.sim_type,
        customerNotes: exec.customer_notes,
        extraField1: exec.extra_field_1,
        extraField2: exec.extra_field_2,
        responseReasonCode: exec.response_reason_code,
        salesTechnician: exec.sales_technician,
        technicianCode: exec.technician_code,
        extractionConfidence: exec.extraction_confidence,
        enteredBy: enteredByUuid,
        enteredAt: exec.entered_at ? new Date(exec.entered_at) : new Date(),
        updatedAt: exec.updated_at ? new Date(exec.updated_at) : new Date(),
      });
  }
  console.log(`   - Migrated ${sqliteExecutions.length} executions`);

  // 10. Migrate PDF Reports
  console.log("📑 Migrating PDF reports...");
  const sqlitePdf = sqliteDb.prepare("SELECT * FROM pdf_reports").all() as any[];

  for (const pdf of sqlitePdf) {
    const pgRequestId = pdf.request_id ? requestMap.get(pdf.request_id) : null;
    const uploadedByUuid = pdf.uploaded_by ? userMap.get(pdf.uploaded_by) : null;

    await db
      .insert(courierPdfReports)
      .values({
        requestId: pgRequestId,
        fileName: pdf.file_name,
        filePath: pdf.file_path,
        uploadedBy: uploadedByUuid,
        uploadedAt: pdf.uploaded_at ? new Date(pdf.uploaded_at) : new Date(),
        ocrText: pdf.ocr_text,
        extractedJson: pdf.extracted_json,
        overallConfidence: pdf.overall_confidence,
        status: pdf.status,
      });
  }
  console.log(`   - Migrated ${sqlitePdf.length} PDF reports`);

  // 11. Migrate Audit Log
  console.log("📝 Migrating audit log...");
  const sqliteAudit = sqliteDb.prepare("SELECT * FROM audit_log").all() as any[];

  for (const log of sqliteAudit) {
    const changedByUuid = log.changed_by ? userMap.get(log.changed_by) : null;
    await db
      .insert(courierAuditLogs)
      .values({
        tableName: log.table_name,
        recordId: log.record_id,
        fieldName: log.field_name,
        oldValue: log.old_value,
        newValue: log.new_value,
        action: log.action,
        changedBy: changedByUuid,
        changedAt: log.changed_at ? new Date(log.changed_at) : new Date(),
      });
  }
  console.log(`   - Migrated ${sqliteAudit.length} audit logs`);

  console.log("🎉 Database migration completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed with error:", err);
  process.exit(1);
});
