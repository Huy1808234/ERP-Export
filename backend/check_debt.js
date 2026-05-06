
import { Client } from 'pg';

async function checkData() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123456@localhost:5432/mini_erp'
  });

  try {
    await client.connect();
    
    console.log('--- PARTNERS ---');
    const partners = await client.query('SELECT id, name, "partnerType", "currentDebt", "defaultCurrency" FROM partners WHERE name ILIKE \'%Amit%\' OR name ILIKE \'%Thống Nhất%\'');
    console.table(partners.rows);

    for (const partner of partners.rows) {
      console.log(`\n--- LEDGER ENTRIES FOR ${partner.name} (${partner.id}) ---`);
      const ledger = await client.query('SELECT * FROM ledger_entries WHERE "partnerId" = $1 AND "accountCode" = \'131\'', [partner.id]);
      console.table(ledger.rows);
      
      console.log(`\n--- SALES CONTRACTS FOR ${partner.name} ---`);
      const sc = await client.query('SELECT id, "contractNumber", status, "totalAmount", "totalAmountVnd" FROM sales_contracts WHERE "buyerId" = $1', [partner.id]);
      console.table(sc.rows);
    }

    await client.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
