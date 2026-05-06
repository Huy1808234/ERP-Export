import { Client } from 'pg';

async function checkUserSchema() {
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
      SELECT column_name, column_default, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user';
    `);
    console.log('User Table Schema:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error checking schema:', err.message);
  } finally {
    await client.end();
  }
}

checkUserSchema();
