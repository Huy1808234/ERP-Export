import { DataSource } from 'typeorm';

async function fixDb() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5433,
    username: 'erp_user',
    password: 'erp_pass',
    database: 'mini_erp_export',
  });

  await dataSource.initialize();
  console.log('DB connected.');

  console.log('Dropping all tables...');
  try {
    await dataSource.query(`
      DO $$
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN (
              SELECT tablename
              FROM pg_tables
              WHERE schemaname = 'public'
          ) LOOP
              EXECUTE 'DROP TABLE ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
    `);
    console.log('Successfully dropped all tables.');
  } catch (e) {
    console.error('Error dropping tables:', e.message);
  }
  
  await dataSource.destroy();
  console.log('Done.');
}

fixDb().catch(console.error);
