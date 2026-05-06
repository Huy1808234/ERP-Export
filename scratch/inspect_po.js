const { Client } = require('pg');

async function checkPo(poNumber) {
  const client = new Client({
    user: 'erp_user',
    host: 'localhost',
    database: 'mini_erp_export',
    password: 'erp_pass',
    port: 5433,
  });
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM purchase_orders WHERE "poNumber" = $1', [poNumber]);
    if (res.rows.length > 0) {
      console.log('PO Data:', JSON.stringify(res.rows[0], null, 2));
      const items = await client.query('SELECT * FROM purchase_order_items WHERE "purchaseOrderId" = $1', [res.rows[0].id]);
      console.log('PO Items:', JSON.stringify(items.rows, null, 2));
    } else {
      console.log('PO not found:', poNumber);
    }
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

const poNumber = process.argv[2] || 'PO-20260501-0007';
checkPo(poNumber);
