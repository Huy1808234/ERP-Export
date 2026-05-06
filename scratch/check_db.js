
const { Client } = require('pg');

async function checkDb() {
  const client = new Client({
    user: 'erp_user',
    host: 'localhost',
    database: 'mini_erp_export',
    password: 'erp_pass',
    port: 5433,
  });
  try {
    await client.connect();
    const piRes = await client.query('SELECT count(*) FROM proforma_invoices');
    console.log('PI Count:', piRes.rows[0].count);
    const prodRes = await client.query('SELECT count(*) FROM products');
    console.log('Product Count:', prodRes.rows[0].count);
    const shipRes = await client.query('SELECT count(*) FROM shipments');
    console.log('Shipment Count:', shipRes.rows[0].count);
    await client.end();
  } catch (err) {
    console.error('Error connecting to DB:', err.message);
  }
}

checkDb();
