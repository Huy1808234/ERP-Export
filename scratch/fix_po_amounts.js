const { Client } = require('pg');
require('dotenv').config({ path: '../backend/.env' });

async function fixPoAmounts() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:123456@localhost:5432/mini_erp'
    });

    try {
        await client.connect();
        console.log('Connected to DB');

        // 1. Calculate and Update each PO totalAmount from its items
        const query = `
            UPDATE purchase_orders po
            SET "totalAmount" = (
                SELECT COALESCE(SUM(poi."totalAmount"), 0)
                FROM purchase_order_items poi
                WHERE poi."purchaseOrderId" = po.id
            )
            WHERE po."totalAmount" = 0 OR po."totalAmount" IS NULL;
        `;

        const res = await client.query(query);
        console.log(`Updated ${res.rowCount} Purchase Orders with zero amount.`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

fixPoAmounts();
