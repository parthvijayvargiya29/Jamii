/**
 * Seed Inventory Logs for Analytics
 * 
 * This script generates 30 days of historical inventory log data
 * for both restaurants to power the dashboard analytics.
 * 
 * Run with: npx tsx server/seed-inventory-logs.ts
 */

import { pool } from "./db";

async function seedInventoryLogs() {
  console.log("Starting inventory log seeding...");
  
  try {
    // Get all restaurants
    const restaurantsResult = await pool.query("SELECT id, name FROM restaurants");
    const restaurants = restaurantsResult.rows;
    console.log(`Found ${restaurants.length} restaurants`);
    
    // For each restaurant, get a sample of inventory items
    for (const restaurant of restaurants) {
      console.log(`\nSeeding logs for: ${restaurant.name}`);
      
      // Get 10 items from each storage type for variety
      const itemsResult = await pool.query(`
        SELECT id, item, storage, quantity, low_stock_threshold 
        FROM inventory_items 
        WHERE restaurant_id = $1 
        ORDER BY storage, item 
        LIMIT 30
      `, [restaurant.id]);
      
      const items = itemsResult.rows;
      console.log(`  Found ${items.length} items to generate logs for`);
      
      if (items.length === 0) continue;
      
      // Generate 30 days of logs
      const now = new Date();
      const logs: Array<{
        inventory_item_id: string;
        restaurant_id: string;
        change_type: string;
        quantity_changed: number;
        final_quantity: number;
        created_at: Date;
        notes: string;
      }> = [];
      
      for (let day = 0; day < 30; day++) {
        const date = new Date(now);
        date.setDate(date.getDate() - day);
        date.setHours(Math.floor(Math.random() * 12) + 8); // 8am - 8pm
        
        // Process each item
        for (const item of items) {
          const baseQty = parseFloat(item.quantity) || 10;
          
          // Deliveries every 3-4 days (positive changes)
          if (day % 3 === 0) {
            const deliveryQty = Math.floor(Math.random() * 15) + 5; // 5-20
            const deliveryDate = new Date(date);
            deliveryDate.setHours(9, 0, 0, 0); // Morning delivery
            
            logs.push({
              inventory_item_id: item.id,
              restaurant_id: restaurant.id,
              change_type: "Delivery",
              quantity_changed: deliveryQty,
              final_quantity: baseQty + deliveryQty,
              created_at: deliveryDate,
              notes: "Scheduled delivery"
            });
          }
          
          // Usage logs (negative changes) - daily
          const usageQty = -(Math.floor(Math.random() * 5) + 1); // -1 to -5
          const eodDate = new Date(date);
          eodDate.setHours(20, 0, 0, 0); // Evening count
          
          logs.push({
            inventory_item_id: item.id,
            restaurant_id: restaurant.id,
            change_type: "Usage",
            quantity_changed: usageQty,
            final_quantity: Math.max(0, baseQty + usageQty),
            created_at: eodDate,
            notes: "Daily usage count"
          });
          
          // Occasional adjustments (every 7 days)
          if (day % 7 === 0 && Math.random() > 0.5) {
            const adjustQty = Math.floor(Math.random() * 6) - 3; // -3 to +3
            const adjDate = new Date(date);
            adjDate.setHours(14, 0, 0, 0);
            
            logs.push({
              inventory_item_id: item.id,
              restaurant_id: restaurant.id,
              change_type: "Adjustment",
              quantity_changed: adjustQty,
              final_quantity: Math.max(0, baseQty + adjustQty),
              created_at: adjDate,
              notes: "Inventory correction"
            });
          }
        }
      }
      
      console.log(`  Generated ${logs.length} log entries`);
      
      // Batch insert logs (100 at a time for efficiency)
      const batchSize = 100;
      for (let i = 0; i < logs.length; i += batchSize) {
        const batch = logs.slice(i, i + batchSize);
        const values: unknown[] = [];
        const placeholders: string[] = [];
        
        batch.forEach((log, idx) => {
          const offset = idx * 7;
          placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
          values.push(
            log.inventory_item_id,
            log.restaurant_id,
            log.change_type,
            log.quantity_changed,
            log.final_quantity,
            log.created_at,
            log.notes
          );
        });
        
        await pool.query(`
          INSERT INTO inventory_logs (inventory_item_id, restaurant_id, change_type, quantity_changed, final_quantity, created_at, notes)
          VALUES ${placeholders.join(", ")}
        `, values);
      }
      
      console.log(`  Inserted ${logs.length} logs for ${restaurant.name}`);
    }
    
    // Verify
    const countResult = await pool.query("SELECT COUNT(*) as total FROM inventory_logs");
    console.log(`\nTotal inventory logs in database: ${countResult.rows[0].total}`);
    
    console.log("\nInventory log seeding complete!");
    
  } catch (error) {
    console.error("Error seeding inventory logs:", error);
    throw error;
  }
}

// Run if called directly
seedInventoryLogs()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
