import { describe, it, expect } from 'vitest';
import { SerialRecognitionService } from '../../core/serial/serial-recognition.service';
import { db } from '@core/config/db';
import { itemTypes, items, users } from '@shared/schema';
import { inArray } from 'drizzle-orm';
import { SerializedItemsService } from './infrastructure/services/serialized-items.service';

describe('ENTERPRISE SERIAL SCANNING & PERSISTENCE VERIFICATION SUITE', () => {

  describe('1. Backend Unit Tests (SerialRecognitionService.recognize)', () => {
    it('i9100: recognizes SAW43310018885 and preserves full SAW prefix', async () => {
      const res = await SerialRecognitionService.recognize('SAW43310018885', 'i9100');
      expect(res.isValid).toBe(true);
      expect(res.itemTypeId).toBe('i9100');
      expect(res.normalizedSerial).toBe('SAW43310018885');
    });

    it('i9100: rejects missing prefix (43310018885)', async () => {
      await expect(SerialRecognitionService.recognize('43310018885', 'i9100')).rejects.toThrow(
        'الرقم يجب أن يبدأ بـ SAW ويتكون من 14 خانة.'
      );
    });

    it('i9000S: recognizes SAS30810004647 and preserves full SAS prefix', async () => {
      const res = await SerialRecognitionService.recognize('SAS30810004647', 'i9000s');
      expect(res.isValid).toBe(true);
      expect(res.itemTypeId).toBe('i9000s');
      expect(res.normalizedSerial).toBe('SAS30810004647');
    });

    it('i9000S: rejects missing prefix (30810004647)', async () => {
      await expect(SerialRecognitionService.recognize('30810004647', 'i9000s')).rejects.toThrow(
        'الرقم يجب أن يبدأ بـ SAS ويتكون من 14 خانة.'
      );
    });

    it('A960: recognizes 1180234360 with A960 context', async () => {
      const res = await SerialRecognitionService.recognize('1180234360', 'a960');
      expect(res.isValid).toBe(true);
      expect(res.itemTypeId).toBe('a960');
      expect(res.normalizedSerial).toBe('1180234360');
    });

    it('A960: rejects Product Code (A960-2AW-RL6-C0EE)', async () => {
      await expect(SerialRecognitionService.recognize('A960-2AW-RL6-C0EE', 'a960')).rejects.toThrow(
        'الرقم التسلسلي يجب أن يتكون من 10 أرقام.'
      );
    });

    it('i9100 / i9000S / A960: rejects short/invalid inputs (SAW123, SAS123, 123456789)', async () => {
      await expect(SerialRecognitionService.recognize('SAW123', 'i9100')).rejects.toThrow();
      await expect(SerialRecognitionService.recognize('SAS123', 'i9000s')).rejects.toThrow();
      await expect(SerialRecognitionService.recognize('123456789', 'a960')).rejects.toThrow();
    });
  });

  describe('2. DB Persistence & Prefix Preservation', () => {
    it('verifies item_types table definitions in DB', async () => {
      const dbTypes = await db.select().from(itemTypes).where(inArray(itemTypes.id, ['i9100', 'i9000s', 'a960']));
      
      const i9100 = dbTypes.find(t => t.id === 'i9100');
      expect(i9100).toBeDefined();
      expect(i9100?.serialPrefix).toBe('SAW');
      expect(i9100?.serialLength).toBe(14);

      const i9000s = dbTypes.find(t => t.id === 'i9000s');
      expect(i9000s).toBeDefined();
      expect(i9000s?.serialPrefix).toBe('SAS');
      expect(i9000s?.serialLength).toBe(14);

      const a960 = dbTypes.find(t => t.id === 'a960');
      expect(a960).toBeDefined();
      expect(a960?.serialLength).toBe(10);
    });

    it('saves batch items and queries DB directly to prove zero prefix stripping', async () => {
      const service = new SerializedItemsService();
      
      let techId = 'test-tech-serial-verify';
      try {
        const [existing] = await db.select({ id: users.id }).from(users).limit(1);
        if (existing) {
          techId = existing.id;
        } else {
          await db.insert(users).values({
            id: techId,
            username: 'testtechserial',
            fullName: 'Test Tech Serial',
            email: 'techserial@example.com',
            role: 'technician',
            password: 'mock-hash',
          }).onConflictDoNothing();
        }
      } catch (e) {
        // Fallback
      }

      const testBatch = [
        { serialNumber: 'SAW43310018885', itemTypeId: 'i9100' },
        { serialNumber: 'SAS30810004647', itemTypeId: 'i9000s' },
        { serialNumber: '1180234360', itemTypeId: 'a960' },
      ];

      // Cleanup prior test records if any
      await db.delete(items).where(inArray(items.serialNumber, ['SAW43310018885', 'SAS30810004647', '1180234360']));

      // Execute batch scan-in
      const savedItems = await service.batchScanIn(techId, testBatch);
      expect(savedItems.length).toBe(3);

      // QUERY DB DIRECTLY (SQL Verification)
      const storedRows = await db
        .select()
        .from(items)
        .where(inArray(items.serialNumber, ['SAW43310018885', 'SAS30810004647', '1180234360']));

      expect(storedRows.length).toBe(3);

      const storedI9100 = storedRows.find(r => r.itemTypeId === 'i9100');
      expect(storedI9100?.serialNumber).toBe('SAW43310018885');

      const storedI9000S = storedRows.find(r => r.itemTypeId === 'i9000s');
      expect(storedI9000S?.serialNumber).toBe('SAS30810004647');

      const storedA960 = storedRows.find(r => r.itemTypeId === 'a960');
      expect(storedA960?.serialNumber).toBe('1180234360');

      // Cleanup after test
      await db.delete(items).where(inArray(items.serialNumber, ['SAW43310018885', 'SAS30810004647', '1180234360']));
    });
  });

});
