import pkg from 'pg';
const { Client } = pkg;

(async () => {
  const cs = 'postgresql://postgres:postgres@localhost:5432/nulip_inventory';
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    console.log('Connected to database. Starting moving inventory reconciliation for serialized items...');

    // 1. Fetch all item types
    const itemTypesRes = await client.query('SELECT id, name_ar, requires_serial, category FROM public.item_types');
    const itemTypes = itemTypesRes.rows;
    
    // Helper to check if item type is serialized
    const isSerialized = (itemType: any) => {
      return itemType.requires_serial === true || itemType.category === 'sim' || itemType.category === 'devices';
    };

    const serializedItemTypeIds = new Set(itemTypes.filter(isSerialized).map(it => it.id));
    console.log(`Found ${serializedItemTypeIds.size} serialized item types out of ${itemTypes.length} total item types.`);

    // 2. Fetch active items grouped by owner and type
    const itemsRes = await client.query(`
      SELECT current_owner_id, item_type_id, COUNT(*)::int AS count 
      FROM public.items 
      WHERE current_owner_id IS NOT NULL 
        AND status IN ('RECEIVED_BY_TECHNICIAN', 'IN_TRANSIT_CUSTODY') 
      GROUP BY current_owner_id, item_type_id
    `);
    const activeItemsGroups = itemsRes.rows;
    console.log(`Found ${activeItemsGroups.length} active custody groups in items table.`);

    // Map to quickly look up actual counts: key is "technicianId:itemTypeId"
    const actualCounts = new Map<string, number>();
    for (const group of activeItemsGroups) {
      if (serializedItemTypeIds.has(group.item_type_id)) {
        actualCounts.set(`${group.current_owner_id}:${group.item_type_id}`, group.count);
      }
    }

    // 3. Fetch current entries in technician_moving_inventory_entries
    const entriesRes = await client.query('SELECT id, technician_id, item_type_id, units, boxes FROM public.technician_moving_inventory_entries');
    const existingEntries = entriesRes.rows;
    console.log(`Found ${existingEntries.length} existing technician moving inventory entries.`);

    // Map of existing entries: key is "technicianId:itemTypeId"
    const existingEntriesMap = new Map<string, any>();
    for (const entry of existingEntries) {
      existingEntriesMap.set(`${entry.technician_id}:${entry.item_type_id}`, entry);
    }

    // 4. Reconcile
    console.log('\n--- Processing reconciliation ---');
    
    // Process groups with active items
    for (const [key, count] of actualCounts.entries()) {
      const [techId, itemTypeId] = key.split(':');
      const existing = existingEntriesMap.get(key);

      if (existing) {
        if (existing.units !== count) {
          console.log(`[UPDATE] Technician ${techId}, ItemType ${itemTypeId}: changing units from ${existing.units} to ${count}`);
          await client.query(
            'UPDATE public.technician_moving_inventory_entries SET units = $1, updated_at = NOW() WHERE id = $2',
            [count, existing.id]
          );
        } else {
          console.log(`[OK] Technician ${techId}, ItemType ${itemTypeId}: units match actual count (${count})`);
        }
      } else {
        console.log(`[INSERT] Technician ${techId}, ItemType ${itemTypeId}: creating new entry with units = ${count}`);
        await client.query(
          'INSERT INTO public.technician_moving_inventory_entries (technician_id, item_type_id, units, boxes) VALUES ($1, $2, $3, 0)',
          [techId, itemTypeId, count]
        );
      }
    }

    // Process existing entries for serialized types that have 0 active items
    for (const entry of existingEntries) {
      if (serializedItemTypeIds.has(entry.item_type_id)) {
        const key = `${entry.technician_id}:${entry.item_type_id}`;
        if (!actualCounts.has(key) && entry.units > 0) {
          console.log(`[CLEANUP] Technician ${entry.technician_id}, ItemType ${entry.item_type_id}: actual active count is 0, resetting units from ${entry.units} to 0`);
          await client.query(
            'UPDATE public.technician_moving_inventory_entries SET units = 0, updated_at = NOW() WHERE id = $1',
            [entry.id]
          );
        }
      }
    }

    console.log('\nReconciliation completed successfully!');
  } catch (err) {
    console.error('Error during reconciliation:', err);
  } finally {
    await client.end();
  }
})();
