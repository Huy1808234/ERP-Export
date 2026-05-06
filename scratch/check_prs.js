
const { Client } = require('pg');

async function checkPRs() {
  const client = new Client({
    user: 'erp_user',
    host: 'localhost',
    database: 'mini_erp',
    password: 'erp_pass',
    port: 5433,
  });

  await client.connect();

  try {
    const res = await client.query(`
      SELECT pr."prNumber", pr.department, pr.status, COUNT(pri.id) as item_count, SUM(pri.quantity * pri."estimatedPrice") as total
      FROM purchase_requests pr
      LEFT JOIN purchase_request_items pri ON pr.id = pri."purchaseRequestId"
      GROUP BY pr.id
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkPRs();
