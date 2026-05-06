import { Client } from 'pg';

async function testInsertUser() {
  const client = new Client({
    user: 'erp_user',
    host: 'localhost',
    database: 'mini_erp_export',
    password: 'erp_pass',
    port: 5433,
  });
  
  try {
    await client.connect();
    console.log('Testing manual insert without roleId...');
    const res = await client.query(`
      INSERT INTO "user"("name", "email", "password", "isActive") 
      VALUES ('Test User', 'test@example.com', '123456', true) 
      RETURNING *;
    `);
    console.log('Inserted User:');
    console.table(res.rows);
    
    // Cleanup
    await client.query(`DELETE FROM "user" WHERE email = 'test@example.com'`);
  } catch (err) {
    console.error('Error during test:', err.message);
  } finally {
    await client.end();
  }
}

testInsertUser();
