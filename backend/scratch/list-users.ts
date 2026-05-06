import { Client } from 'pg';

async function listUsers() {
  const client = new Client({
    user: 'erp_user',
    host: 'localhost',
    database: 'mini_erp_export',
    password: 'erp_pass',
    port: 5433,
  });
  
  try {
    await client.connect();
    const res = await client.query(`
      SELECT u.id, u.name, u.email, r.name as role_name 
      FROM "user" u
      LEFT JOIN "roles" r ON u."roleId" = r.id;
    `);
    console.log('Current Users in DB:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error listing users:', err.message);
  } finally {
    await client.end();
  }
}

listUsers();
