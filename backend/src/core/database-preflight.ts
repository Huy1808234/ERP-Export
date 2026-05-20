type DatabasePreflightOptions = {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
};

const SYSTEM_USER_ID = '_user_system';
const SYSTEM_USERNAME = 'system';
const DISABLED_PASSWORD_HASH = '$2b$10$K4L6XlEUi5J1eU8rY2bQOO1t5l5o1WJ49QGv1PpIcdw0N4Mn9iV5a';

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;
const legacyIdentityColumn = (stem: string) => `${stem}Id`;

async function tableExists(client: any, tableName: string) {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
      LIMIT 1
    `,
    [tableName],
  );

  return result.rowCount > 0;
}

async function columnExists(client: any, tableName: string, columnName: string) {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return result.rowCount > 0;
}

async function addColumnIfMissing(
  client: any,
  tableName: string,
  columnName: string,
  definition: string,
) {
  await client.query(
    `ALTER TABLE ${quote(tableName)} ADD COLUMN IF NOT EXISTS ${quote(columnName)} ${definition}`,
  );
}

async function dropColumnIfExists(client: any, tableName: string, columnName: string) {
  if (!(await tableExists(client, tableName))) return;
  if (!(await columnExists(client, tableName, columnName))) return;

  await client.query(
    `ALTER TABLE ${quote(tableName)} DROP COLUMN IF EXISTS ${quote(columnName)} CASCADE`,
  );
}

async function renameColumnIfExists(
  client: any,
  tableName: string,
  oldColumnName: string,
  newColumnName: string,
) {
  if (!(await tableExists(client, tableName))) return;
  if (!(await columnExists(client, tableName, oldColumnName))) return;
  if (await columnExists(client, tableName, newColumnName)) return;

  await client.query(
    `ALTER TABLE ${quote(tableName)} RENAME COLUMN ${quote(oldColumnName)} TO ${quote(newColumnName)}`,
  );
}

async function convertColumnToVarcharIfExists(
  client: any,
  tableName: string,
  columnName: string,
  length?: number,
) {
  if (!(await tableExists(client, tableName))) return;
  if (!(await columnExists(client, tableName, columnName))) return;

  const constraints = await client.query(
    `
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN unnest(con.conkey) AS key(attnum) ON true
      JOIN pg_attribute attr ON attr.attrelid = rel.oid AND attr.attnum = key.attnum
      WHERE con.contype = 'f'
        AND nsp.nspname = 'public'
        AND rel.relname = $1
        AND attr.attname = $2
    `,
    [tableName, columnName],
  );

  for (const constraint of constraints.rows) {
    await client.query(
      `ALTER TABLE ${quote(tableName)} DROP CONSTRAINT IF EXISTS ${quote(constraint.conname)}`,
    );
  }

  const typeDefinition = length ? `varchar(${length})` : 'varchar';
  await client.query(`
    ALTER TABLE ${quote(tableName)}
    ALTER COLUMN ${quote(columnName)}
    TYPE ${typeDefinition}
    USING ${quote(columnName)}::text
  `);
}

async function dropForeignKeysReferencingColumn(
  client: any,
  targetTable: string,
  targetColumn: string,
) {
  if (!(await tableExists(client, targetTable))) return;
  if (!(await columnExists(client, targetTable, targetColumn))) return;

  const constraints = await client.query(
    `
      SELECT con.conname, rel.relname AS table_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN pg_class target_rel ON target_rel.oid = con.confrelid
      JOIN pg_namespace target_nsp ON target_nsp.oid = target_rel.relnamespace
      JOIN unnest(con.confkey) AS key(attnum) ON true
      JOIN pg_attribute target_attr ON target_attr.attrelid = target_rel.oid AND target_attr.attnum = key.attnum
      WHERE con.contype = 'f'
        AND nsp.nspname = 'public'
        AND target_nsp.nspname = 'public'
        AND target_rel.relname = $1
        AND target_attr.attname = $2
    `,
    [targetTable, targetColumn],
  );

  for (const constraint of constraints.rows) {
    await client.query(
      `ALTER TABLE ${quote(constraint.table_name)} DROP CONSTRAINT IF EXISTS ${quote(constraint.conname)}`,
    );
  }
}

async function ensureRoles(client: any) {
  if (!(await tableExists(client, 'roles'))) return;

  await addColumnIfMissing(client, 'roles', '_id', 'varchar(40)');
  if (await columnExists(client, 'roles', 'id')) {
    await client.query(`
      UPDATE "roles"
      SET "_id" = '_role_' || replace(COALESCE("id"::text, md5("name")), '-', '')
      WHERE "_id" IS NULL OR "_id" = ''
    `);
  } else {
    await client.query(`
      UPDATE "roles"
      SET "_id" = '_role_' || substring(md5(COALESCE("name", ctid::text)), 1, 24)
      WHERE "_id" IS NULL OR "_id" = ''
    `);
  }
  await client.query(`ALTER TABLE "roles" ALTER COLUMN "_id" SET NOT NULL`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_roles__id" ON "roles" ("_id")`);
}

async function ensurePermissions(client: any) {
  if (!(await tableExists(client, 'permissions'))) return;

  await addColumnIfMissing(client, 'permissions', '_id', 'varchar(40)');
  if (await columnExists(client, 'permissions', 'id')) {
    await client.query(`
      UPDATE "permissions"
      SET "_id" = '_perm_' || replace(COALESCE("id"::text, md5("module" || ':' || "method" || ':' || "apiPath")), '-', '')
      WHERE "_id" IS NULL OR "_id" = ''
    `);
  } else {
    await client.query(`
      UPDATE "permissions"
      SET "_id" = '_perm_' || substring(md5(COALESCE("module", '') || ':' || COALESCE("method", '') || ':' || COALESCE("apiPath", '') || ':' || ctid::text), 1, 24)
      WHERE "_id" IS NULL OR "_id" = ''
    `);
  }
  await client.query(`ALTER TABLE "permissions" ALTER COLUMN "_id" SET NOT NULL`);
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_permissions__id" ON "permissions" ("_id")`,
  );

  const coreAccountingPermissions = [
    {
      _id: '_perm_read_accounting',
      name: 'read:accounting',
      apiPath: '/api/v1/accounting',
      method: 'GET',
      module: 'ACCOUNTING',
    },
    {
      _id: '_perm_write_accounting',
      name: 'write:accounting',
      apiPath: '/api/v1/accounting',
      method: 'POST/PATCH',
      module: 'ACCOUNTING',
    },
  ];

  for (const permission of coreAccountingPermissions) {
    await client.query(
      `
        INSERT INTO "permissions" ("_id", "name", "apiPath", "method", "module", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT ("_id") DO UPDATE
        SET "name" = EXCLUDED."name",
            "apiPath" = EXCLUDED."apiPath",
            "method" = EXCLUDED."method",
            "module" = EXCLUDED."module",
            "updatedAt" = NOW()
      `,
      [permission._id, permission.name, permission.apiPath, permission.method, permission.module],
    );
  }
}

async function ensureUsers(client: any) {
  if (!(await tableExists(client, 'user'))) return;

  await addColumnIfMissing(client, 'user', '_id', 'varchar(40)');
  await addColumnIfMissing(client, 'user', 'username', 'varchar');
  await addColumnIfMissing(client, 'user', 'roleName', 'varchar');
  await addColumnIfMissing(client, 'user', 'refreshTokenHash', 'varchar');
  await addColumnIfMissing(client, 'user', 'refreshTokenExpiresAt', 'timestamp');

  if (await columnExists(client, 'user', 'id')) {
    await client.query(`
      UPDATE "user"
      SET "_id" = '_user_' || replace(COALESCE("id"::text, md5(COALESCE("email", "name", random()::text))), '-', '')
      WHERE "_id" IS NULL OR "_id" = ''
    `);
  } else {
    await client.query(`
      UPDATE "user"
      SET "_id" = '_user_' || substring(md5(COALESCE("email", "name", ctid::text)), 1, 24)
      WHERE "_id" IS NULL OR "_id" = ''
    `);
  }

  await client.query(`
    UPDATE "user"
    SET "username" =
      regexp_replace(
        lower(split_part(COALESCE(NULLIF("email", ''), NULLIF("name", ''), "_id"), '@', 1)),
        '[^a-z0-9._-]+',
        '.',
        'g'
      ) || '_' || substring(md5("_id"), 1, 6)
    WHERE "username" IS NULL OR "username" = ''
  `);

  await client.query(`
    WITH ranked AS (
      SELECT ctid, "username", row_number() OVER (PARTITION BY "username" ORDER BY "_id") AS rn
      FROM "user"
    )
    UPDATE "user" u
    SET "username" = u."username" || '_' || ranked.rn
    FROM ranked
    WHERE u.ctid = ranked.ctid AND ranked.rn > 1
  `);

  if ((await tableExists(client, 'roles')) && (await columnExists(client, 'user', 'roleId'))) {
    const roleHasId = await columnExists(client, 'roles', 'id');
    const roleJoinCondition = roleHasId
      ? `(u."roleId"::text = r."id"::text OR u."roleId"::text = r."_id"::text)`
      : `u."roleId"::text = r."_id"::text`;

    await client.query(`
      UPDATE "user" u
      SET "roleName" = r."name"
      FROM "roles" r
      WHERE ${roleJoinCondition} AND (u."roleName" IS NULL OR u."roleName" = '')
    `);
  }

  await client.query(`
    INSERT INTO "user" ("_id", "username", "name", "email", "password", "isActive", "createdAt", "updatedAt")
    SELECT $1::varchar, $2::varchar, 'System', 'system@local.invalid', $3::varchar, false, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "username" = $2::varchar)
  `, [SYSTEM_USER_ID, SYSTEM_USERNAME, DISABLED_PASSWORD_HASH]);

  await client.query(`ALTER TABLE "user" ALTER COLUMN "_id" SET NOT NULL`);
  await client.query(`ALTER TABLE "user" ALTER COLUMN "username" SET NOT NULL`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user__id" ON "user" ("_id")`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_username" ON "user" ("username")`);
}

async function ensureRolePermissions(client: any) {
  if (!(await tableExists(client, 'role_permissions'))) return;

  await addColumnIfMissing(client, 'role_permissions', 'roleRef', 'varchar(40)');
  await addColumnIfMissing(client, 'role_permissions', 'permissionRef', 'varchar(40)');

  if ((await tableExists(client, 'roles')) && (await columnExists(client, 'role_permissions', 'roleId'))) {
    const roleHasId = await columnExists(client, 'roles', 'id');
    const roleJoinCondition = roleHasId
      ? `(rp."roleId"::text = r."id"::text OR rp."roleId"::text = r."_id"::text)`
      : `rp."roleId"::text = r."_id"::text`;

    await client.query(`
      UPDATE "role_permissions" rp
      SET "roleRef" = r."_id"
      FROM "roles" r
      WHERE ${roleJoinCondition} AND (rp."roleRef" IS NULL OR rp."roleRef" = '')
    `);
  }

  if (
    (await tableExists(client, 'permissions')) &&
    (await columnExists(client, 'role_permissions', 'permissionId'))
  ) {
    const permissionHasId = await columnExists(client, 'permissions', 'id');
    const permissionJoinCondition = permissionHasId
      ? `(rp."permissionId"::text = p."id"::text OR rp."permissionId"::text = p."_id"::text)`
      : `rp."permissionId"::text = p."_id"::text`;

    await client.query(`
      UPDATE "role_permissions" rp
      SET "permissionRef" = p."_id"
      FROM "permissions" p
      WHERE ${permissionJoinCondition} AND (rp."permissionRef" IS NULL OR rp."permissionRef" = '')
    `);
  }
}

async function backfillUserReference(
  client: any,
  tableName: string,
  oldColumn: string,
  newColumn: string,
  required: boolean,
) {
  if (!(await tableExists(client, tableName))) return;

  await addColumnIfMissing(client, tableName, newColumn, 'varchar');

  if (await columnExists(client, tableName, oldColumn)) {
    const userHasId = await columnExists(client, 'user', 'id');
    const joinCondition = userHasId
      ? `(target.${quote(oldColumn)}::text = u."id"::text OR target.${quote(oldColumn)}::text = u."_id"::text OR ('_user_' || replace(target.${quote(oldColumn)}::text, '-', '')) = u."_id")`
      : `(target.${quote(oldColumn)}::text = u."_id"::text OR ('_user_' || replace(target.${quote(oldColumn)}::text, '-', '')) = u."_id")`;

    await client.query(`
      UPDATE ${quote(tableName)} target
      SET ${quote(newColumn)} = u."username"
      FROM "user" u
      WHERE ${joinCondition}
        AND (target.${quote(newColumn)} IS NULL OR target.${quote(newColumn)} = '')
    `);
  }

  if (required) {
    await client.query(`
      UPDATE ${quote(tableName)}
      SET ${quote(newColumn)} = $1
      WHERE ${quote(newColumn)} IS NULL OR ${quote(newColumn)} = ''
    `, [SYSTEM_USERNAME]);
    await client.query(`ALTER TABLE ${quote(tableName)} ALTER COLUMN ${quote(newColumn)} SET NOT NULL`);
  }

  await dropColumnIfExists(client, tableName, oldColumn);
}

async function ensureBusinessUserReferences(client: any) {
  const refs: Array<[string, string, string, boolean]> = [
    ['purchase_requests', legacyIdentityColumn('createdBy'), 'createdByUsername', true],
    ['purchase_requests', legacyIdentityColumn('approvedBy'), 'approvedByUsername', false],
    ['purchase_orders', legacyIdentityColumn('createdBy'), 'createdByUsername', true],
    ['goods_receipts', legacyIdentityColumn('receivedBy'), 'receivedByUsername', true],
    ['quotations', legacyIdentityColumn('createdBy'), 'createdByUsername', true],
    ['quotations', legacyIdentityColumn('approvedBy'), 'approvedByUsername', false],
    ['proforma_invoices', legacyIdentityColumn('createdBy'), 'createdByUsername', true],
    ['shipments', legacyIdentityColumn('createdBy'), 'createdByUsername', true],
    ['trade_finance_transactions', legacyIdentityColumn('createdBy'), 'createdByUsername', true],
    ['letters_of_credit', legacyIdentityColumn('createdBy'), 'createdByUsername', true],
    ['purchase_return', legacyIdentityColumn('createdBy'), 'createdByUsername', true],
    ['quality_checks', legacyIdentityColumn('inspector'), 'inspectorUsername', true],
    ['journal_entries', legacyIdentityColumn('createdBy'), 'createdByUsername', false],
  ];

  for (const [tableName, oldColumn, newColumn, required] of refs) {
    await backfillUserReference(client, tableName, oldColumn, newColumn, required);
  }
}

async function ensureAuditLogs(client: any) {
  if (!(await tableExists(client, 'audit_logs'))) return;

  await addColumnIfMissing(client, 'audit_logs', '_id', 'varchar(40)');
  if (await columnExists(client, 'audit_logs', 'id')) {
    await client.query(`
      UPDATE "audit_logs"
      SET "_id" = '_audit_' || replace(COALESCE("id"::text, md5(COALESCE("tableName", '') || ':' || COALESCE("recordId", '') || ':' || ctid::text)), '-', '')
      WHERE "_id" IS NULL OR "_id" = ''
    `);
  } else {
    await client.query(`
      UPDATE "audit_logs"
      SET "_id" = '_audit_' || substring(md5(COALESCE("tableName", '') || ':' || COALESCE("recordId", '') || ':' || ctid::text), 1, 24)
      WHERE "_id" IS NULL OR "_id" = ''
    `);
  }

  await addColumnIfMissing(client, 'audit_logs', 'username', 'varchar');
  const legacyAuditUserColumn = legacyIdentityColumn('user');
  if (await columnExists(client, 'audit_logs', legacyAuditUserColumn)) {
    if (await tableExists(client, 'user')) {
      await client.query(`
        UPDATE "audit_logs" a
        SET "username" = COALESCE(u."username", lower(NULLIF(a.${quote(legacyAuditUserColumn)}, '')), $1)
        FROM "user" u
        WHERE (
          a.${quote(legacyAuditUserColumn)}::text = u."_id"::text
          OR a.${quote(legacyAuditUserColumn)}::text = u."username"::text
          OR lower(a.${quote(legacyAuditUserColumn)}::text) = $1
        )
        AND (a."username" IS NULL OR a."username" = '')
      `, [SYSTEM_USERNAME]);
    }

    await client.query(`
      UPDATE "audit_logs"
      SET "username" = COALESCE(lower(NULLIF(${quote(legacyAuditUserColumn)}, '')), $1)
      WHERE "username" IS NULL OR "username" = ''
    `, [SYSTEM_USERNAME]);

    await dropColumnIfExists(client, 'audit_logs', legacyAuditUserColumn);
  }

  await client.query(`ALTER TABLE "audit_logs" ALTER COLUMN "_id" SET NOT NULL`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_audit_logs__id" ON "audit_logs" ("_id")`);
}

async function ensureSettings(client: any) {
  if (!(await tableExists(client, 'settings'))) return;

  await addColumnIfMissing(client, 'settings', '_id', 'varchar(40)');
  await client.query(`
    UPDATE "settings"
    SET "_id" = '_setting_' || substring(md5(COALESCE("key", ctid::text)), 1, 24)
    WHERE "_id" IS NULL OR "_id" = ''
  `);

  await client.query(`ALTER TABLE "settings" ALTER COLUMN "_id" SET NOT NULL`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_settings__id" ON "settings" ("_id")`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_settings_key" ON "settings" ("key")`);
}

async function ensureEntityId(
  client: any,
  tableName: string,
  prefix: string,
  seedExpression: string,
) {
  if (!(await tableExists(client, tableName))) return;

  await addColumnIfMissing(client, tableName, '_id', 'varchar(40)');
  if (await columnExists(client, tableName, 'id')) {
    await client.query(`
      UPDATE ${quote(tableName)}
      SET "_id" = $1 || to_char(CURRENT_DATE, 'YYYYMMDD') || '_' || substring(md5(COALESCE("id"::text, ${seedExpression})), 1, 8)
      WHERE "_id" IS NULL OR "_id" = ''
    `, [`_${prefix}_`]);
  } else {
    await client.query(`
      UPDATE ${quote(tableName)}
      SET "_id" = $1 || to_char(CURRENT_DATE, 'YYYYMMDD') || '_' || substring(md5(${seedExpression}), 1, 8)
      WHERE "_id" IS NULL OR "_id" = ''
    `, [`_${prefix}_`]);
  }

  await client.query(`ALTER TABLE ${quote(tableName)} ALTER COLUMN "_id" SET NOT NULL`);
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${quote(`UQ_${tableName}__id`)} ON ${quote(tableName)} ("_id")`,
  );
}

async function backfillReferenceToEntityId(
  client: any,
  sourceTable: string,
  sourceColumn: string,
  targetTable: string,
) {
  if (!(await tableExists(client, sourceTable))) return;
  if (!(await tableExists(client, targetTable))) return;
  if (!(await columnExists(client, sourceTable, sourceColumn))) return;
  if (!(await columnExists(client, targetTable, '_id'))) return;

  await convertColumnToVarcharIfExists(client, sourceTable, sourceColumn, 40);
  await dropForeignKeysReferencingColumn(client, targetTable, 'id');

  const targetHasId = await columnExists(client, targetTable, 'id');
  const joinCondition = targetHasId
    ? `(source.${quote(sourceColumn)}::text = target."id"::text OR source.${quote(sourceColumn)}::text = target."_id"::text)`
    : `source.${quote(sourceColumn)}::text = target."_id"::text`;

  await client.query(`
    UPDATE ${quote(sourceTable)} source
    SET ${quote(sourceColumn)} = target."_id"
    FROM ${quote(targetTable)} target
    WHERE source.${quote(sourceColumn)} IS NOT NULL
      AND source.${quote(sourceColumn)}::text <> ''
      AND ${joinCondition}
  `);
}

async function ensureAdminCoreEntityIds(client: any) {
  await renameColumnIfExists(client, 'lots', ['pro', 'duction', 'Date'].join(''), 'manufactureDate');

  await ensureEntityId(client, 'partners', 'partner', `COALESCE("taxCode", '') || ':' || COALESCE("name", '') || ':' || ctid::text`);
  await ensureEntityId(client, 'products', 'prod', `COALESCE("sku", '') || ':' || COALESCE("vietnameseName", '') || ':' || ctid::text`);
  await ensureEntityId(client, 'categories', 'category', `COALESCE("slug", '') || ':' || COALESCE("name", '') || ':' || ctid::text`);
  await ensureEntityId(client, 'account_payables', 'ap', `COALESCE("invoiceNumber", '') || ':' || COALESCE("vendorId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'journal_entries', 'je', `COALESCE("entryNumber", '') || ':' || COALESCE("referenceType", '') || ':' || COALESCE("referenceId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'ledger_entries', 'ledger', `COALESCE("journalEntryId"::text, '') || ':' || COALESCE("accountCode", '') || ':' || ctid::text`);
  await ensureEntityId(client, 'accounting_periods', 'period', `COALESCE("startDate"::text, '') || ':' || COALESCE("endDate"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'inventory_ledger', 'invled', `COALESCE("productId"::text, '') || ':' || COALESCE("referenceId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'vendor_price_histories', 'vendor_price', `COALESCE("vendorId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'vendor_evaluations', 'vendor_eval', `COALESCE("vendorId"::text, '') || ':' || COALESCE("evaluatedByUsername", '') || ':' || ctid::text`);

  await ensureEntityId(client, 'quotations', 'quote', `COALESCE("quotationNumber", '') || ':' || COALESCE("customerId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'quotation_items', 'quote_item', `COALESCE("quotationId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'proforma_invoices', 'pi', `COALESCE("piNumber", '') || ':' || COALESCE("customerId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'proforma_invoice_items', 'pi_item', `COALESCE("proformaInvoiceId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'sales_contracts', 'sc', `COALESCE("contractNumber", '') || ':' || COALESCE("buyerId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'sales_contract_items', 'sc_item', `COALESCE("salesContractId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);

  await ensureEntityId(client, 'shipments', 'shp', `COALESCE("shipmentNumber", '') || ':' || COALESCE("salesContractId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'containers', 'container', `COALESCE("shipmentId"::text, '') || ':' || COALESCE("containerNumber", '') || ':' || ctid::text`);
  await ensureEntityId(client, 'shipment_documents', 'shp_doc', `COALESCE("shipmentId"::text, '') || ':' || COALESCE("documentType"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'shipment_cost_allocations', 'shp_cost', `COALESCE("shipmentId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'export_documents', 'export_doc', `COALESCE("shipmentId"::text, '') || ':' || COALESCE("documentType"::text, '') || ':' || ctid::text`);

  await ensureEntityId(client, 'currencies', 'currency', `COALESCE("code", '') || ':' || ctid::text`);
  await ensureEntityId(client, 'exchange_rates', 'rate', `COALESCE("currencyId"::text, '') || ':' || COALESCE("rateType", '') || ':' || COALESCE("effectiveDate"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'letters_of_credit', 'lc', `COALESCE("lcNumber", '') || ':' || COALESCE("salesContractId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'lc_discrepancies', 'lc_disc', `COALESCE("lcId"::text, '') || ':' || COALESCE("description", '') || ':' || ctid::text`);
  await ensureEntityId(client, 'collection_orders', 'collection', `COALESCE("orderNumber", '') || ':' || COALESCE("salesContractId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'trade_finance_transactions', 'tf', `COALESCE("bankReference", '') || ':' || COALESCE("salesContractId"::text, '') || ':' || COALESCE("vendorInvoiceId"::text, '') || ':' || ctid::text`);

  await ensureEntityId(client, 'purchase_return', 'pret', `COALESCE("returnNumber", '') || ':' || COALESCE("purchaseOrderId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'purchase_return_item', 'pret_item', `COALESCE("purchaseReturnId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'lots', 'lot', `COALESCE("lotNumber", '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'quality_checks', 'qc', `COALESCE("checkNumber", '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'product_inquiries', 'inquiry', `COALESCE("customerEmail", '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);


  await backfillReferenceToEntityId(client, 'products', 'preferredSupplierId', 'partners');
  await backfillReferenceToEntityId(client, 'purchase_orders', 'vendorId', 'partners');
  await backfillReferenceToEntityId(client, 'vendor_invoices', 'vendorId', 'partners');
  await backfillReferenceToEntityId(client, 'account_payables', 'vendorId', 'partners');
  await backfillReferenceToEntityId(client, 'ledger_entries', 'partnerId', 'partners');
  await backfillReferenceToEntityId(client, 'quotations', 'customerId', 'partners');
  await backfillReferenceToEntityId(client, 'proforma_invoices', 'customerId', 'partners');
  await backfillReferenceToEntityId(client, 'sales_contracts', 'buyerId', 'partners');
  await backfillReferenceToEntityId(client, 'sales_contracts', 'logisticsPartnerId', 'partners');
  await backfillReferenceToEntityId(client, 'shipments', 'logisticsPartnerId', 'partners');
  await backfillReferenceToEntityId(client, 'vendor_price_histories', 'vendorId', 'partners');
  await backfillReferenceToEntityId(client, 'vendor_evaluations', 'vendorId', 'partners');
  await backfillReferenceToEntityId(client, 'lots', 'supplierId', 'partners');

  await backfillReferenceToEntityId(client, 'purchase_request_items', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'purchase_order_items', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'goods_receipt_items', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'vendor_invoice_items', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'inventory_ledger', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'purchase_return_item', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'quotation_items', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'proforma_invoice_items', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'sales_contract_items', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'shipment_cost_allocations', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'vendor_price_histories', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'lots', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'quality_checks', 'productId', 'products');
  await backfillReferenceToEntityId(client, 'product_inquiries', 'productId', 'products');

  await backfillReferenceToEntityId(client, 'ledger_entries', 'journalEntryId', 'journal_entries');
  await backfillReferenceToEntityId(client, 'trade_finance_transactions', 'journalEntryId', 'journal_entries');

  await backfillReferenceToEntityId(client, 'quotation_items', 'quotationId', 'quotations');
  await backfillReferenceToEntityId(client, 'proforma_invoices', 'quotationId', 'quotations');
  await backfillReferenceToEntityId(client, 'proforma_invoice_items', 'proformaInvoiceId', 'proforma_invoices');
  await backfillReferenceToEntityId(client, 'sales_contracts', 'proformaInvoiceId', 'proforma_invoices');
  await backfillReferenceToEntityId(client, 'proforma_invoices', 'salesContractId', 'sales_contracts');
  await backfillReferenceToEntityId(client, 'sales_contract_items', 'salesContractId', 'sales_contracts');
  await backfillReferenceToEntityId(client, 'shipments', 'salesContractId', 'sales_contracts');
  await backfillReferenceToEntityId(client, 'letters_of_credit', 'salesContractId', 'sales_contracts');
  await backfillReferenceToEntityId(client, 'lc_discrepancies', 'lcId', 'letters_of_credit');
  await backfillReferenceToEntityId(client, 'collection_orders', 'salesContractId', 'sales_contracts');
  await backfillReferenceToEntityId(client, 'trade_finance_transactions', 'salesContractId', 'sales_contracts');

  await backfillReferenceToEntityId(client, 'containers', 'shipmentId', 'shipments');
  await backfillReferenceToEntityId(client, 'shipment_documents', 'shipmentId', 'shipments');
  await backfillReferenceToEntityId(client, 'shipment_cost_allocations', 'shipmentId', 'shipments');
  await backfillReferenceToEntityId(client, 'export_documents', 'shipmentId', 'shipments');

  await backfillReferenceToEntityId(client, 'exchange_rates', 'currencyId', 'currencies');
  await backfillReferenceToEntityId(client, 'purchase_return_item', 'purchaseReturnId', 'purchase_return');
  await backfillReferenceToEntityId(client, 'quality_checks', 'lotId', 'lots');
}

async function ensureP2PEntityIds(client: any) {
  await ensureEntityId(
    client,
    'purchase_requests',
    'pr',
    `COALESCE("prNumber", ctid::text)`,
  );
  await ensureEntityId(
    client,
    'purchase_request_items',
    'pritem',
    `COALESCE("purchaseRequestId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`,
  );
  await ensureEntityId(
    client,
    'purchase_orders',
    'po',
    `COALESCE("poNumber", ctid::text)`,
  );
  await ensureEntityId(
    client,
    'purchase_order_items',
    'poitem',
    `COALESCE("purchaseOrderId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`,
  );
  await ensureEntityId(
    client,
    'goods_receipts',
    'grn',
    `COALESCE("grNumber", ctid::text)`,
  );
  await ensureEntityId(
    client,
    'goods_receipt_items',
    'gri',
    `COALESCE("goodsReceiptId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`,
  );
  await ensureEntityId(
    client,
    'vendor_invoices',
    'vinv',
    `COALESCE("invoiceNumber", '') || ':' || COALESCE("vendorId"::text, '') || ':' || ctid::text`,
  );
  await ensureEntityId(
    client,
    'vendor_invoice_items',
    'vii',
    `COALESCE("vendorInvoiceId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`,
  );

  await convertColumnToVarcharIfExists(client, 'purchase_request_items', 'purchaseRequestId', 40);
  await convertColumnToVarcharIfExists(client, 'purchase_orders', 'purchaseRequestId', 40);
  await convertColumnToVarcharIfExists(client, 'purchase_order_items', 'purchaseOrderId', 40);
  await convertColumnToVarcharIfExists(client, 'goods_receipts', 'purchaseOrderId', 40);
  await convertColumnToVarcharIfExists(client, 'vendor_invoices', 'purchaseOrderId', 40);
  await convertColumnToVarcharIfExists(client, 'purchase_return', 'purchaseOrderId', 40);
  await convertColumnToVarcharIfExists(client, 'goods_receipt_items', 'goodsReceiptId', 40);
  await convertColumnToVarcharIfExists(client, 'vendor_invoice_items', 'vendorInvoiceId', 40);
  await convertColumnToVarcharIfExists(client, 'trade_finance_transactions', 'vendorInvoiceId', 40);
  await convertColumnToVarcharIfExists(client, 'journal_entries', 'referenceId');

  await dropForeignKeysReferencingColumn(client, 'purchase_requests', 'id');
  await dropForeignKeysReferencingColumn(client, 'purchase_orders', 'id');
  await dropForeignKeysReferencingColumn(client, 'goods_receipts', 'id');
  await dropForeignKeysReferencingColumn(client, 'vendor_invoices', 'id');

  if (
    (await tableExists(client, 'purchase_request_items')) &&
    (await tableExists(client, 'purchase_requests')) &&
    (await columnExists(client, 'purchase_request_items', 'purchaseRequestId'))
  ) {
    const prHasId = await columnExists(client, 'purchase_requests', 'id');
    const joinCondition = prHasId
      ? `(item."purchaseRequestId"::text = pr."id"::text OR item."purchaseRequestId"::text = pr."_id"::text)`
      : `item."purchaseRequestId"::text = pr."_id"::text`;

    await client.query(`
      UPDATE "purchase_request_items" item
      SET "purchaseRequestId" = pr."_id"
      FROM "purchase_requests" pr
      WHERE ${joinCondition}
    `);
  }

  if (
    (await tableExists(client, 'purchase_orders')) &&
    (await tableExists(client, 'purchase_requests')) &&
    (await columnExists(client, 'purchase_orders', 'purchaseRequestId'))
  ) {
    const prHasId = await columnExists(client, 'purchase_requests', 'id');
    const joinCondition = prHasId
      ? `(po."purchaseRequestId"::text = pr."id"::text OR po."purchaseRequestId"::text = pr."_id"::text)`
      : `po."purchaseRequestId"::text = pr."_id"::text`;

    await client.query(`
      UPDATE "purchase_orders" po
      SET "purchaseRequestId" = pr."_id"
      FROM "purchase_requests" pr
      WHERE ${joinCondition}
    `);
  }

  if (
    (await tableExists(client, 'purchase_order_items')) &&
    (await tableExists(client, 'purchase_orders')) &&
    (await columnExists(client, 'purchase_order_items', 'purchaseOrderId'))
  ) {
    const poHasId = await columnExists(client, 'purchase_orders', 'id');
    const joinCondition = poHasId
      ? `(item."purchaseOrderId"::text = po."id"::text OR item."purchaseOrderId"::text = po."_id"::text)`
      : `item."purchaseOrderId"::text = po."_id"::text`;

    await client.query(`
      UPDATE "purchase_order_items" item
      SET "purchaseOrderId" = po."_id"
      FROM "purchase_orders" po
      WHERE ${joinCondition}
    `);
  }

  if (
    (await tableExists(client, 'goods_receipts')) &&
    (await tableExists(client, 'purchase_orders')) &&
    (await columnExists(client, 'goods_receipts', 'purchaseOrderId'))
  ) {
    const poHasId = await columnExists(client, 'purchase_orders', 'id');
    const joinCondition = poHasId
      ? `(gr."purchaseOrderId"::text = po."id"::text OR gr."purchaseOrderId"::text = po."_id"::text)`
      : `gr."purchaseOrderId"::text = po."_id"::text`;

    await client.query(`
      UPDATE "goods_receipts" gr
      SET "purchaseOrderId" = po."_id"
      FROM "purchase_orders" po
      WHERE ${joinCondition}
    `);
  }

  if (
    (await tableExists(client, 'vendor_invoices')) &&
    (await tableExists(client, 'purchase_orders')) &&
    (await columnExists(client, 'vendor_invoices', 'purchaseOrderId'))
  ) {
    const poHasId = await columnExists(client, 'purchase_orders', 'id');
    const joinCondition = poHasId
      ? `(invoice."purchaseOrderId"::text = po."id"::text OR invoice."purchaseOrderId"::text = po."_id"::text)`
      : `invoice."purchaseOrderId"::text = po."_id"::text`;

    await client.query(`
      UPDATE "vendor_invoices" invoice
      SET "purchaseOrderId" = po."_id"
      FROM "purchase_orders" po
      WHERE ${joinCondition}
    `);
  }

  if (
    (await tableExists(client, 'purchase_return')) &&
    (await tableExists(client, 'purchase_orders')) &&
    (await columnExists(client, 'purchase_return', 'purchaseOrderId'))
  ) {
    const poHasId = await columnExists(client, 'purchase_orders', 'id');
    const joinCondition = poHasId
      ? `(return_doc."purchaseOrderId"::text = po."id"::text OR return_doc."purchaseOrderId"::text = po."_id"::text)`
      : `return_doc."purchaseOrderId"::text = po."_id"::text`;

    await client.query(`
      UPDATE "purchase_return" return_doc
      SET "purchaseOrderId" = po."_id"
      FROM "purchase_orders" po
      WHERE ${joinCondition}
    `);
  }

  if (
    (await tableExists(client, 'goods_receipt_items')) &&
    (await tableExists(client, 'goods_receipts')) &&
    (await columnExists(client, 'goods_receipt_items', 'goodsReceiptId'))
  ) {
    const grHasId = await columnExists(client, 'goods_receipts', 'id');
    const joinCondition = grHasId
      ? `(item."goodsReceiptId"::text = gr."id"::text OR item."goodsReceiptId"::text = gr."_id"::text)`
      : `item."goodsReceiptId"::text = gr."_id"::text`;

    await client.query(`
      UPDATE "goods_receipt_items" item
      SET "goodsReceiptId" = gr."_id"
      FROM "goods_receipts" gr
      WHERE ${joinCondition}
    `);
  }

  if (
    (await tableExists(client, 'vendor_invoice_items')) &&
    (await tableExists(client, 'vendor_invoices')) &&
    (await columnExists(client, 'vendor_invoice_items', 'vendorInvoiceId'))
  ) {
    const invoiceHasId = await columnExists(client, 'vendor_invoices', 'id');
    const joinCondition = invoiceHasId
      ? `(item."vendorInvoiceId"::text = invoice."id"::text OR item."vendorInvoiceId"::text = invoice."_id"::text)`
      : `item."vendorInvoiceId"::text = invoice."_id"::text`;

    await client.query(`
      UPDATE "vendor_invoice_items" item
      SET "vendorInvoiceId" = invoice."_id"
      FROM "vendor_invoices" invoice
      WHERE ${joinCondition}
    `);
  }

  if (
    (await tableExists(client, 'trade_finance_transactions')) &&
    (await tableExists(client, 'vendor_invoices')) &&
    (await columnExists(client, 'trade_finance_transactions', 'vendorInvoiceId'))
  ) {
    const invoiceHasId = await columnExists(client, 'vendor_invoices', 'id');
    const joinCondition = invoiceHasId
      ? `(tx."vendorInvoiceId"::text = invoice."id"::text OR tx."vendorInvoiceId"::text = invoice."_id"::text)`
      : `tx."vendorInvoiceId"::text = invoice."_id"::text`;

    await client.query(`
      UPDATE "trade_finance_transactions" tx
      SET "vendorInvoiceId" = invoice."_id"
      FROM "vendor_invoices" invoice
      WHERE ${joinCondition}
    `);
  }

  if (
    (await tableExists(client, 'journal_entries')) &&
    (await tableExists(client, 'vendor_invoices')) &&
    (await columnExists(client, 'journal_entries', 'referenceId'))
  ) {
    const invoiceHasId = await columnExists(client, 'vendor_invoices', 'id');
    const joinCondition = invoiceHasId
      ? `(entry."referenceId"::text = invoice."id"::text OR entry."referenceId"::text = invoice."_id"::text)`
      : `entry."referenceId"::text = invoice."_id"::text`;

    await client.query(`
      UPDATE "journal_entries" entry
      SET "referenceId" = invoice."_id"
      FROM "vendor_invoices" invoice
      WHERE entry."referenceType" = 'VENDOR_INVOICE' AND ${joinCondition}
    `);
  }
}

async function ensureAccountPayableWorkflow(client: any) {
  if (await tableExists(client, 'account_payables')) {
    await addColumnIfMissing(client, 'account_payables', 'vendorInvoiceId', 'varchar(40)');
    await addColumnIfMissing(client, 'account_payables', 'isApprovedForPayment', 'boolean DEFAULT false');
    await addColumnIfMissing(client, 'account_payables', 'approvedByUsername', 'varchar');
    await addColumnIfMissing(client, 'account_payables', 'approvedAt', 'timestamp');
    await addColumnIfMissing(client, 'account_payables', 'paidByUsername', 'varchar');
    await addColumnIfMissing(client, 'account_payables', 'paidAt', 'timestamp');

    await client.query(`
      UPDATE "account_payables" ap
      SET "vendorInvoiceId" = invoice."_id"
      FROM "vendor_invoices" invoice
      WHERE (ap."vendorInvoiceId" IS NULL OR ap."vendorInvoiceId" = '')
        AND ap."invoiceNumber" IS NOT NULL
        AND ap."vendorId"::text = invoice."vendorId"::text
        AND ap."invoiceNumber" = invoice."invoiceNumber"
    `);

    await client.query(`
      UPDATE "account_payables"
      SET "isApprovedForPayment" = false
      WHERE "isApprovedForPayment" IS NULL
    `);

    await client.query(`
      UPDATE "account_payables"
      SET
        "isApprovedForPayment" = true,
        "approvedByUsername" = COALESCE("approvedByUsername", $1),
        "approvedAt" = COALESCE("approvedAt", "updatedAt", NOW()),
        "paidByUsername" = COALESCE("paidByUsername", $1),
        "paidAt" = COALESCE("paidAt", "updatedAt", NOW())
      WHERE "status" = 'PAID'
    `, [SYSTEM_USERNAME]);
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS "account_payable_payment_batches" (
      "_id" varchar(40) PRIMARY KEY,
      "batchNumber" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'DRAFT',
      "currency" varchar NOT NULL DEFAULT 'VND',
      "totalAmount" numeric(15, 2) NOT NULL DEFAULT 0,
      "exchangeRate" numeric(15, 6) NOT NULL DEFAULT 1,
      "totalAmountVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "paymentDate" date,
      "paymentMethod" varchar,
      "bankReference" varchar,
      "bankProofFileId" varchar(40),
      "bankProofUrl" text,
      "bankTransferAt" timestamp,
      "settlementNote" text,
      "createdByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "submittedByUsername" varchar,
      "submittedAt" timestamp,
      "approvalWorkflowRequestId" varchar(40),
      "firstApprovedByUsername" varchar,
      "firstApprovedAt" timestamp,
      "finalApprovedByUsername" varchar,
      "finalApprovedAt" timestamp,
      "rejectedByUsername" varchar,
      "rejectedAt" timestamp,
      "paidByUsername" varchar,
      "paidAt" timestamp,
      "paymentJournalEntryId" varchar(40),
      "rejectionReason" text,
      "note" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "account_payable_payment_batch_items" (
      "_id" varchar(40) PRIMARY KEY,
      "batchId" varchar(40) NOT NULL,
      "accountPayableId" varchar(40) NOT NULL,
      "vendorId" varchar(40) NOT NULL,
      "vendorInvoiceId" varchar(40),
      "invoiceNumber" varchar,
      "amount" numeric(15, 2) NOT NULL DEFAULT 0,
      "currency" varchar NOT NULL DEFAULT 'VND',
      "note" text
    )
  `);

  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "UDX_ap_payment_batch_number" ON "account_payable_payment_batches" ("batchNumber")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "IDX_ap_payment_batch_status" ON "account_payable_payment_batches" ("status", "paymentDate")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_ap_payment_batches_approval_request" ON "account_payable_payment_batches" ("approvalWorkflowRequestId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "IDX_ap_payment_batch_item_batch" ON "account_payable_payment_batch_items" ("batchId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "IDX_ap_payment_batch_item_ap" ON "account_payable_payment_batch_items" ("accountPayableId")`,
  );
  await ensureEntityId(client, 'account_payable_payment_batches', 'ap_batch', `COALESCE("batchNumber", '') || ':' || ctid::text`);
  await ensureEntityId(client, 'account_payable_payment_batch_items', 'ap_batch_item', `COALESCE("batchId"::text, '') || ':' || COALESCE("accountPayableId"::text, '') || ':' || ctid::text`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "account_payable_settlement_audits" (
      "_id" varchar(40) PRIMARY KEY,
      "accountPayableId" varchar(40) NOT NULL,
      "paymentBatchId" varchar(40),
      "vendorId" varchar(40) NOT NULL,
      "vendorInvoiceId" varchar(40),
      "invoiceNumber" varchar,
      "settlementDate" timestamp NOT NULL DEFAULT NOW(),
      "amount" numeric(15, 2) NOT NULL DEFAULT 0,
      "exchangeRate" numeric(15, 6) NOT NULL DEFAULT 1,
      "amountVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "currency" varchar NOT NULL DEFAULT 'VND',
      "paymentMethod" varchar,
      "bankReference" varchar,
      "bankProofFileId" varchar(40),
      "bankProofUrl" text,
      "settlementNote" text,
      "auditType" varchar NOT NULL DEFAULT 'SETTLEMENT',
      "reversedSettlementAudit_id" varchar(40),
      "reversedAt" timestamp,
      "reversedByUsername" varchar,
      "reversalReason" text,
      "approvalWorkflowRequestId" varchar(40),
      "reversalJournalEntry_id" varchar(40),
      "settledByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await addColumnIfMissing(client, 'account_payable_settlement_audits', 'auditType', `varchar NOT NULL DEFAULT 'SETTLEMENT'`);
  await addColumnIfMissing(client, 'account_payable_settlement_audits', 'reversedSettlementAudit_id', `varchar(40)`);
  await addColumnIfMissing(client, 'account_payable_settlement_audits', 'reversedAt', `timestamp`);
  await addColumnIfMissing(client, 'account_payable_settlement_audits', 'reversedByUsername', `varchar`);
  await addColumnIfMissing(client, 'account_payable_settlement_audits', 'reversalReason', `text`);
  await addColumnIfMissing(client, 'account_payable_settlement_audits', 'approvalWorkflowRequestId', `varchar(40)`);
  await addColumnIfMissing(client, 'account_payable_settlement_audits', 'reversalJournalEntry_id', `varchar(40)`);

  await client.query(
    `CREATE INDEX IF NOT EXISTS "IDX_ap_settlement_ap" ON "account_payable_settlement_audits" ("accountPayableId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "IDX_ap_settlement_batch" ON "account_payable_settlement_audits" ("paymentBatchId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "IDX_ap_settlement_vendor" ON "account_payable_settlement_audits" ("vendorId", "settlementDate")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "IDX_ap_settlement_reversed_audit" ON "account_payable_settlement_audits" ("reversedSettlementAudit_id")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_ap_settlement_approval_request" ON "account_payable_settlement_audits" ("approvalWorkflowRequestId")`,
  );
}

async function ensureInventoryCountWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "inventory_counts" (
      "_id" varchar(40) PRIMARY KEY,
      "countNumber" varchar NOT NULL UNIQUE,
      "countDate" date NOT NULL,
      "warehouseName" varchar NOT NULL DEFAULT 'Main Warehouse',
      "status" varchar NOT NULL DEFAULT 'DRAFT',
      "createdByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "submittedByUsername" varchar,
      "submittedAt" timestamp,
      "approvedByUsername" varchar,
      "approvedAt" timestamp,
      "approvalNote" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "inventory_count_items" (
      "_id" varchar(40) PRIMARY KEY,
      "countId" varchar(40) NOT NULL,
      "productId" varchar(40) NOT NULL,
      "systemQuantity" numeric(12, 2) NOT NULL DEFAULT 0,
      "countedQuantity" numeric(12, 2) NOT NULL DEFAULT 0,
      "varianceQuantity" numeric(12, 2) NOT NULL DEFAULT 0,
      "unitCost" numeric(15, 2) NOT NULL DEFAULT 0,
      "varianceValue" numeric(15, 2) NOT NULL DEFAULT 0,
      "note" text
    )
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS "IDX_inventory_counts_status_date" ON "inventory_counts" ("status", "countDate")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "IDX_inventory_count_items_count_product" ON "inventory_count_items" ("countId", "productId")`,
  );

  await client.query(`
    DELETE FROM "inventory_count_items" item
    WHERE NOT EXISTS (
      SELECT 1 FROM "inventory_counts" count_doc WHERE count_doc."_id" = item."countId"
    )
  `);
}

async function ensureInventoryReturnWorkflow(client: any) {
  if (await tableExists(client, 'inventory_ledger')) {
    await addColumnIfMissing(client, 'inventory_ledger', 'partnerId', 'varchar(40)');
    await addColumnIfMissing(client, 'inventory_ledger', 'referenceNumber', 'varchar');
    await addColumnIfMissing(client, 'inventory_ledger', 'createdBy', 'varchar');
    await addColumnIfMissing(client, 'inventory_ledger', 'remainingQuantity', 'numeric(12, 2) NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'inventory_ledger', 'lotNumber', 'varchar');

    await client.query(`
      UPDATE "inventory_ledger"
      SET "remainingQuantity" = COALESCE("remainingQuantity", 0)
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_inventory_ledger_partner" ON "inventory_ledger" ("partnerId")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_inventory_ledger_lot" ON "inventory_ledger" ("lotNumber")`,
    );
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS "customer_returns" (
      "_id" varchar(40) PRIMARY KEY,
      "returnNumber" varchar NOT NULL UNIQUE,
      "buyerId" varchar(40) NOT NULL,
      "shipmentId" varchar(40),
      "salesContractId" varchar(40),
      "reason" varchar NOT NULL DEFAULT 'OTHER',
      "status" varchar NOT NULL DEFAULT 'DRAFT',
      "returnDate" date NOT NULL DEFAULT CURRENT_DATE,
      "note" text,
      "createdByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "submittedByUsername" varchar,
      "submittedAt" timestamp,
      "approvedByUsername" varchar,
      "approvedAt" timestamp,
      "receivedByUsername" varchar,
      "receivedAt" timestamp,
      "decisionNote" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "customer_return_items" (
      "_id" varchar(40) PRIMARY KEY,
      "customerReturnId" varchar(40) NOT NULL,
      "productId" varchar(40) NOT NULL,
      "quantity" numeric(12, 2) NOT NULL DEFAULT 0,
      "unit" varchar,
      "unitCost" numeric(15, 2) NOT NULL DEFAULT 0,
      "lotNumber" varchar,
      "quarantine" boolean NOT NULL DEFAULT false,
      "note" text
    )
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_customer_returns_buyer_status" ON "customer_returns" ("buyerId", "status")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_customer_return_items_return" ON "customer_return_items" ("customerReturnId")`,
  );
  await ensureEntityId(client, 'customer_returns', 'cret', `COALESCE("returnNumber", '') || ':' || COALESCE("buyerId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'customer_return_items', 'cretitem', `COALESCE("customerReturnId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
}

async function ensureExportDeliveryAdjustmentWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "export_deliveries" (
      "_id" varchar(40) PRIMARY KEY,
      "deliveryNumber" varchar NOT NULL UNIQUE,
      "shipmentId" varchar(40) NOT NULL,
      "salesContractId" varchar(40) NOT NULL,
      "buyerId" varchar(40) NOT NULL,
      "deliveryDate" date NOT NULL DEFAULT CURRENT_DATE,
      "status" varchar NOT NULL DEFAULT 'DRAFT',
      "createdByUsername" varchar(120),
      "issuedByUsername" varchar(120),
      "issuedAt" timestamp,
      "cancelledByUsername" varchar(120),
      "cancelledAt" timestamp,
      "cancellationReason" text,
      "note" text,
      "auditTrail" jsonb,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "export_delivery_items" (
      "_id" varchar(40) PRIMARY KEY,
      "exportDeliveryId" varchar(40) NOT NULL,
      "productId" varchar(40) NOT NULL,
      "quantity" numeric(12, 2) NOT NULL DEFAULT 0,
      "unit" varchar,
      "unitCost" numeric(15, 2) NOT NULL DEFAULT 0,
      "totalCost" numeric(15, 2) NOT NULL DEFAULT 0,
      "lotNumber" varchar,
      "note" text
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "inventory_adjustments" (
      "_id" varchar(40) PRIMARY KEY,
      "adjustmentNumber" varchar NOT NULL UNIQUE,
      "productId" varchar(40) NOT NULL,
      "adjustmentQuantity" numeric(12, 2) NOT NULL DEFAULT 0,
      "unitPrice" numeric(15, 2) NOT NULL DEFAULT 0,
      "amountVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "lotNumber" varchar,
      "reason" text NOT NULL,
      "valuationSnapshot" jsonb,
      "appliedValuationSnapshot" jsonb,
      "status" varchar NOT NULL DEFAULT 'PENDING_APPROVAL',
      "approvalWorkflowRequestId" varchar(40),
      "requestedByUsername" varchar(120) NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "requestedAt" timestamp NOT NULL DEFAULT NOW(),
      "approvedByUsername" varchar(120),
      "approvedAt" timestamp,
      "rejectedByUsername" varchar(120),
      "rejectedAt" timestamp,
      "rejectionReason" text,
      "ledgerEntryId" varchar(40),
      "auditTrail" jsonb,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "inventory_period_snapshots" (
      "_id" varchar(40) PRIMARY KEY,
      "snapshotNumber" varchar(60) NOT NULL UNIQUE,
      "periodKey" varchar(40) NOT NULL,
      "periodStartDate" date NOT NULL,
      "periodEndDate" date NOT NULL,
      "valuationMethod" varchar(10) NOT NULL DEFAULT 'FIFO',
      "totalQuantity" numeric(15, 2) NOT NULL DEFAULT 0,
      "totalValue" numeric(18, 2) NOT NULL DEFAULT 0,
      "lineCount" integer NOT NULL DEFAULT 0,
      "snapshotData" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "createdByUsername" varchar(120) NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "immutableHash" varchar,
      "note" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await addColumnIfMissing(client, 'export_deliveries', 'createdByUsername', 'varchar(120)');
  await addColumnIfMissing(client, 'export_deliveries', 'cancelledByUsername', 'varchar(120)');
  await addColumnIfMissing(client, 'export_deliveries', 'cancelledAt', 'timestamp');
  await addColumnIfMissing(client, 'export_deliveries', 'cancellationReason', 'text');
  await addColumnIfMissing(client, 'export_deliveries', 'auditTrail', 'jsonb');
  await client.query(`ALTER TABLE "export_deliveries" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`);
  await client.query(`ALTER TABLE "export_deliveries" ALTER COLUMN "issuedByUsername" DROP NOT NULL`);
  await client.query(`ALTER TABLE "export_deliveries" ALTER COLUMN "issuedAt" DROP NOT NULL`);
  await client.query(`
    UPDATE "export_deliveries"
    SET "createdByUsername" = COALESCE("createdByUsername", "issuedByUsername", '${SYSTEM_USERNAME}')
    WHERE "createdByUsername" IS NULL
  `);

  await addColumnIfMissing(client, 'inventory_adjustments', 'valuationSnapshot', 'jsonb');
  await addColumnIfMissing(client, 'inventory_adjustments', 'appliedValuationSnapshot', 'jsonb');
  await addColumnIfMissing(client, 'inventory_adjustments', 'auditTrail', 'jsonb');

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_export_deliveries_shipment" ON "export_deliveries" ("shipmentId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_export_deliveries_status_date" ON "export_deliveries" ("status", "deliveryDate")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_export_delivery_items_delivery_product" ON "export_delivery_items" ("exportDeliveryId", "productId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_inventory_adjustments_status_date" ON "inventory_adjustments" ("status", "requestedAt")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_inventory_adjustments_product" ON "inventory_adjustments" ("productId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_inventory_adjustments_workflow" ON "inventory_adjustments" ("approvalWorkflowRequestId")`,
  );
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "idx_inventory_period_snapshots_period_method" ON "inventory_period_snapshots" ("periodKey", "valuationMethod")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_inventory_period_snapshots_period_end" ON "inventory_period_snapshots" ("periodEndDate")`,
  );

  await ensureEntityId(client, 'export_deliveries', 'exdel', `COALESCE("deliveryNumber", '') || ':' || COALESCE("shipmentId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'export_delivery_items', 'exdel_item', `COALESCE("exportDeliveryId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'inventory_adjustments', 'inv_adj', `COALESCE("adjustmentNumber", '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'inventory_period_snapshots', 'inv_snap', `COALESCE("snapshotNumber", '') || ':' || COALESCE("periodKey", '') || ':' || ctid::text`);
}

async function ensureAccountReceivableWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "account_receivables" (
      "_id" varchar(40) PRIMARY KEY,
      "buyerId" varchar(40) NOT NULL,
      "salesContractId" varchar(40),
      "commercialInvoice_id" varchar(40),
      "invoiceNumber" varchar NOT NULL UNIQUE,
      "sourceType" varchar NOT NULL DEFAULT 'COMMERCIAL_INVOICE',
      "invoiceDate" date NOT NULL,
      "dueDate" date,
      "amountForeign" numeric(15, 2) NOT NULL DEFAULT 0,
      "paidAmountForeign" numeric(15, 2) NOT NULL DEFAULT 0,
      "currency" varchar NOT NULL DEFAULT 'USD',
      "exchangeRate" numeric(15, 6) NOT NULL DEFAULT 1,
      "amountVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "paidAmountVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "status" varchar NOT NULL DEFAULT 'UNPAID',
      "revenueJournalEntryId" varchar(40),
      "createdByUsername" varchar,
      "note" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "payment_allocations" (
      "_id" varchar(40) PRIMARY KEY,
      "accountReceivableId" varchar(40) NOT NULL,
      "tradeFinanceTransactionId" varchar(40),
      "allocatedAmountForeign" numeric(15, 2) NOT NULL DEFAULT 0,
      "allocatedAmountVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "exchangeRate" numeric(15, 6) NOT NULL DEFAULT 1,
      "allocatedAt" timestamp NOT NULL DEFAULT NOW(),
      "allocatedByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "note" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await addColumnIfMissing(client, 'account_receivables', 'commercialInvoice_id', 'varchar(40)');

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_account_receivables_buyer" ON "account_receivables" ("buyerId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_account_receivables_contract" ON "account_receivables" ("salesContractId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_account_receivables_commercial_invoice" ON "account_receivables" ("commercialInvoice_id")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_payment_allocations_ar" ON "payment_allocations" ("accountReceivableId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_payment_allocations_trade_finance" ON "payment_allocations" ("tradeFinanceTransactionId")`,
  );
}

async function ensureCommercialInvoiceWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "commercial_invoices" (
      "_id" varchar(40) PRIMARY KEY,
      "invoiceNumber" varchar NOT NULL UNIQUE,
      "salesContract_id" varchar(40) NOT NULL,
      "shipment_id" varchar(40) NOT NULL,
      "buyer_id" varchar(40) NOT NULL,
      "accountReceivable_id" varchar(40),
      "exportDocument_id" varchar(40),
      "invoiceDate" date NOT NULL,
      "dueDate" date,
      "currency" varchar NOT NULL DEFAULT 'USD',
      "exchangeRate" numeric(15, 6) NOT NULL DEFAULT 1,
      "subtotalForeign" numeric(15, 2) NOT NULL DEFAULT 0,
      "taxRatePercent" numeric(7, 4) NOT NULL DEFAULT 0,
      "taxAmountForeign" numeric(15, 2) NOT NULL DEFAULT 0,
      "totalAmountForeign" numeric(15, 2) NOT NULL DEFAULT 0,
      "totalAmountVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "incoterm" varchar,
      "paymentTerms" text,
      "status" varchar NOT NULL DEFAULT 'DRAFT',
      "sourceSnapshot" jsonb,
      "auditTrail" jsonb,
      "createdByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "issuedByUsername" varchar,
      "issuedAt" timestamp,
      "cancelledByUsername" varchar,
      "cancelledAt" timestamp,
      "cancellationReason" text,
      "note" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "commercial_invoice_items" (
      "_id" varchar(40) PRIMARY KEY,
      "commercialInvoice_id" varchar(40) NOT NULL,
      "salesContractItem_id" varchar(40),
      "product_id" varchar(40),
      "description" varchar NOT NULL,
      "sku" varchar,
      "hsCode" varchar,
      "quantity" numeric(12, 2) NOT NULL DEFAULT 0,
      "unit" varchar,
      "unitPriceForeign" numeric(15, 2) NOT NULL DEFAULT 0,
      "lineAmountForeign" numeric(15, 2) NOT NULL DEFAULT 0,
      "netWeight" numeric(12, 4),
      "grossWeight" numeric(12, 4),
      "cbm" numeric(12, 4)
    )
  `);

  await addColumnIfMissing(client, 'commercial_invoices', 'accountReceivable_id', 'varchar(40)');
  await addColumnIfMissing(client, 'commercial_invoices', 'exportDocument_id', 'varchar(40)');
  await addColumnIfMissing(client, 'commercial_invoices', 'sourceSnapshot', 'jsonb');
  await addColumnIfMissing(client, 'commercial_invoices', 'auditTrail', 'jsonb');
  await addColumnIfMissing(client, 'commercial_invoice_items', 'sku', 'varchar');
  await addColumnIfMissing(client, 'commercial_invoice_items', 'netWeight', 'numeric(12, 4)');
  await addColumnIfMissing(client, 'commercial_invoice_items', 'grossWeight', 'numeric(12, 4)');
  await addColumnIfMissing(client, 'commercial_invoice_items', 'cbm', 'numeric(12, 4)');

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_commercial_invoices_status_date" ON "commercial_invoices" ("status", "invoiceDate")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_commercial_invoices_shipment" ON "commercial_invoices" ("shipment_id")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_commercial_invoices_contract" ON "commercial_invoices" ("salesContract_id")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_commercial_invoices_buyer" ON "commercial_invoices" ("buyer_id")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_commercial_invoice_items_invoice" ON "commercial_invoice_items" ("commercialInvoice_id")`,
  );

  await ensureEntityId(client, 'commercial_invoices', 'ci', `COALESCE("invoiceNumber", '') || ':' || COALESCE("shipment_id"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'commercial_invoice_items', 'ci_item', `COALESCE("commercialInvoice_id"::text, '') || ':' || COALESCE("product_id"::text, '') || ':' || ctid::text`);
}

async function ensurePricingPolicyWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "pricing_policies" (
      "_id" varchar(40) PRIMARY KEY,
      "productId" varchar(40) NOT NULL,
      "buyerId" varchar(40),
      "marketRegion" varchar,
      "country" varchar,
      "incoterm" varchar NOT NULL,
      "currency" varchar NOT NULL DEFAULT 'USD',
      "minQuantity" numeric(12, 2) NOT NULL DEFAULT 0,
      "maxQuantity" numeric(12, 2),
      "unitPrice" numeric(15, 4) NOT NULL DEFAULT 0,
      "effectiveFrom" date NOT NULL DEFAULT CURRENT_DATE,
      "effectiveTo" date,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "note" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "sales_price_history" (
      "_id" varchar(40) PRIMARY KEY,
      "productId" varchar(40) NOT NULL,
      "buyerId" varchar(40) NOT NULL,
      "pricingPolicyId" varchar(40),
      "sourceType" varchar NOT NULL,
      "sourceId" varchar(40) NOT NULL,
      "sourceNumber" varchar,
      "salesContractId" varchar(40),
      "quotationId" varchar(40),
      "marketRegion" varchar,
      "country" varchar,
      "incoterm" varchar NOT NULL,
      "currency" varchar NOT NULL DEFAULT 'USD',
      "quantity" numeric(12, 2) NOT NULL DEFAULT 0,
      "unitPrice" numeric(15, 4) NOT NULL DEFAULT 0,
      "exchangeRate" numeric(15, 6) NOT NULL DEFAULT 1,
      "createdByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "occurredAt" timestamp NOT NULL DEFAULT NOW(),
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_pricing_policy_lookup" ON "pricing_policies" ("productId", "incoterm", "currency", "isActive")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_sales_price_history_buyer_product" ON "sales_price_history" ("buyerId", "productId", "occurredAt")`,
  );
}

async function ensureProductChangeWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "product_change_requests" (
      "_id" varchar(40) PRIMARY KEY,
      "productId" varchar(40) NOT NULL,
      "requestNumber" varchar(60) NOT NULL UNIQUE,
      "status" varchar NOT NULL DEFAULT 'PENDING_APPROVAL',
      "proposedPatch" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "changedFields" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "approvalWorkflowRequestId" varchar(40),
      "fieldDecisionAudit" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "reason" text,
      "requestedByUsername" varchar(120) NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "requestedAt" timestamp NOT NULL DEFAULT NOW(),
      "approvedByUsername" varchar(120),
      "approvedAt" timestamp,
      "rejectedByUsername" varchar(120),
      "rejectedAt" timestamp,
      "decisionNote" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await addColumnIfMissing(client, 'product_change_requests', 'approvalWorkflowRequestId', 'varchar(40)');
  await addColumnIfMissing(client, 'product_change_requests', 'fieldDecisionAudit', `jsonb NOT NULL DEFAULT '[]'::jsonb`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "product_versions" (
      "_id" varchar(40) PRIMARY KEY,
      "productId" varchar(40) NOT NULL,
      "changeRequestId" varchar(40),
      "versionNumber" integer NOT NULL DEFAULT 1,
      "changedFields" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "beforeSnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "afterSnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "changedByUsername" varchar(120) NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "approvedByUsername" varchar(120),
      "note" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_product_change_requests_product_status" ON "product_change_requests" ("productId", "status")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_product_change_requests_workflow" ON "product_change_requests" ("approvalWorkflowRequestId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_product_versions_product" ON "product_versions" ("productId")`,
  );
  await ensureEntityId(client, 'product_change_requests', 'pcr', `COALESCE("requestNumber", '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'product_versions', 'pver', `COALESCE("productId"::text, '') || ':' || COALESCE("versionNumber"::text, '') || ':' || ctid::text`);
}

async function ensureVendorPriceHistoryWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "vendor_price_histories" (
      "_id" varchar(40) PRIMARY KEY,
      "vendorId" varchar(40) NOT NULL,
      "productId" varchar(40) NOT NULL,
      "price" numeric(15, 2) NOT NULL DEFAULT 0,
      "currency" varchar NOT NULL DEFAULT 'VND',
      "effectiveDate" date,
      "note" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_vendor_price_history_vendor" ON "vendor_price_histories" ("vendorId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_vendor_price_history_product" ON "vendor_price_histories" ("productId")`,
  );
  await ensureEntityId(client, 'vendor_price_histories', 'vendor_price', `COALESCE("vendorId"::text, '') || ':' || COALESCE("productId"::text, '') || ':' || ctid::text`);
}

async function ensureFilesWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "file_assets" (
      "_id" varchar(40) PRIMARY KEY,
      "folder" varchar NOT NULL,
      "fileName" varchar NOT NULL,
      "originalName" varchar NOT NULL,
      "mimeType" varchar NOT NULL,
      "size" integer NOT NULL DEFAULT 0,
      "url" varchar NOT NULL,
      "storagePath" text NOT NULL,
      "uploadedByUsername" varchar,
      "linkedModule" varchar,
      "linkedDocumentType" varchar,
      "linkedDocument_id" varchar(40),
      "auditTrail" jsonb,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await addColumnIfMissing(client, 'file_assets', 'folder', 'varchar');
  await addColumnIfMissing(client, 'file_assets', 'fileName', 'varchar');
  await addColumnIfMissing(client, 'file_assets', 'originalName', 'varchar');
  await addColumnIfMissing(client, 'file_assets', 'mimeType', 'varchar');
  await addColumnIfMissing(client, 'file_assets', 'size', 'integer NOT NULL DEFAULT 0');
  await addColumnIfMissing(client, 'file_assets', 'url', 'varchar');
  await addColumnIfMissing(client, 'file_assets', 'storagePath', 'text');
  await addColumnIfMissing(client, 'file_assets', 'uploadedByUsername', 'varchar');
  await addColumnIfMissing(client, 'file_assets', 'linkedModule', 'varchar');
  await addColumnIfMissing(client, 'file_assets', 'linkedDocumentType', 'varchar');
  await addColumnIfMissing(client, 'file_assets', 'linkedDocument_id', 'varchar(40)');
  await addColumnIfMissing(client, 'file_assets', 'auditTrail', 'jsonb');
  await addColumnIfMissing(client, 'file_assets', 'updatedAt', 'timestamp NOT NULL DEFAULT NOW()');
  await ensureEntityId(client, 'file_assets', 'file_asset', `COALESCE("url", '') || ':' || ctid::text`);

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_file_assets_folder_created" ON "file_assets" ("folder", "createdAt")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_file_assets_linked_document" ON "file_assets" ("linkedModule", "linkedDocumentType", "linkedDocument_id")`,
  );
}

async function ensureExportDocumentWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "export_documents" (
      "_id" varchar(40) PRIMARY KEY,
      "documentType" varchar NOT NULL,
      "shipmentId" varchar(40) NOT NULL,
      "documentNumber" varchar,
      "versionNo" integer NOT NULL DEFAULT 1,
      "isCurrentVersion" boolean NOT NULL DEFAULT true,
      "checklistStatus" varchar NOT NULL DEFAULT 'MISSING',
      "fileName" varchar,
      "originalFileName" varchar,
      "mimeType" varchar,
      "fileSize" integer NOT NULL DEFAULT 0,
      "fileUrl" varchar,
      "fileAsset_id" varchar(40),
      "snapshotData" jsonb,
      "businessData" jsonb,
      "sourceDocumentType" varchar,
      "sourceDocument_id" varchar(40),
      "auditTrail" jsonb,
      "isGenerated" boolean NOT NULL DEFAULT false,
      "issueDate" timestamp,
      "expiryDate" timestamp,
      "customsDeclarationNumber" varchar,
      "customsClearedAt" timestamp,
      "uploadedByUsername" varchar,
      "reviewedByUsername" varchar,
      "reviewedAt" timestamp,
      "approvalWorkflowRequestId" varchar(40),
      "sharedWithBuyer" boolean NOT NULL DEFAULT false,
      "sharedByUsername" varchar,
      "sharedAt" timestamp,
      "downloadCount" integer NOT NULL DEFAULT 0,
      "lastDownloadedAt" timestamp,
      "notes" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await convertColumnToVarcharIfExists(client, 'export_documents', 'documentType');
  await addColumnIfMissing(client, 'export_documents', 'documentNumber', 'varchar');
  await addColumnIfMissing(client, 'export_documents', 'versionNo', 'integer NOT NULL DEFAULT 1');
  await addColumnIfMissing(client, 'export_documents', 'isCurrentVersion', 'boolean NOT NULL DEFAULT true');
  await addColumnIfMissing(client, 'export_documents', 'checklistStatus', `varchar NOT NULL DEFAULT 'MISSING'`);
  await addColumnIfMissing(client, 'export_documents', 'originalFileName', 'varchar');
  await addColumnIfMissing(client, 'export_documents', 'mimeType', 'varchar');
  await addColumnIfMissing(client, 'export_documents', 'fileSize', 'integer NOT NULL DEFAULT 0');
  await addColumnIfMissing(client, 'export_documents', 'fileAsset_id', 'varchar(40)');
  await addColumnIfMissing(client, 'export_documents', 'snapshotData', 'jsonb');
  await addColumnIfMissing(client, 'export_documents', 'businessData', 'jsonb');
  await addColumnIfMissing(client, 'export_documents', 'sourceDocumentType', 'varchar');
  await addColumnIfMissing(client, 'export_documents', 'sourceDocument_id', 'varchar(40)');
  await addColumnIfMissing(client, 'export_documents', 'auditTrail', 'jsonb');
  await addColumnIfMissing(client, 'export_documents', 'issueDate', 'timestamp');
  await addColumnIfMissing(client, 'export_documents', 'expiryDate', 'timestamp');
  await addColumnIfMissing(client, 'export_documents', 'customsDeclarationNumber', 'varchar');
  await addColumnIfMissing(client, 'export_documents', 'customsClearedAt', 'timestamp');
  await addColumnIfMissing(client, 'export_documents', 'uploadedByUsername', 'varchar');
  await addColumnIfMissing(client, 'export_documents', 'reviewedByUsername', 'varchar');
  await addColumnIfMissing(client, 'export_documents', 'reviewedAt', 'timestamp');
  await addColumnIfMissing(client, 'export_documents', 'approvalWorkflowRequestId', 'varchar(40)');
  await addColumnIfMissing(client, 'export_documents', 'sharedWithBuyer', 'boolean NOT NULL DEFAULT false');
  await addColumnIfMissing(client, 'export_documents', 'sharedByUsername', 'varchar');
  await addColumnIfMissing(client, 'export_documents', 'sharedAt', 'timestamp');
  await addColumnIfMissing(client, 'export_documents', 'downloadCount', 'integer NOT NULL DEFAULT 0');
  await addColumnIfMissing(client, 'export_documents', 'lastDownloadedAt', 'timestamp');
  await addColumnIfMissing(client, 'export_documents', 'notes', 'text');
  await addColumnIfMissing(client, 'export_documents', 'updatedAt', 'timestamp NOT NULL DEFAULT NOW()');

  await client.query(`ALTER TABLE "export_documents" ALTER COLUMN "fileName" DROP NOT NULL`);
  await client.query(`ALTER TABLE "export_documents" ALTER COLUMN "fileUrl" DROP NOT NULL`);
  await client.query(`
    UPDATE "export_documents"
    SET "checklistStatus" = CASE
      WHEN "isGenerated" = true THEN 'GENERATED'
      WHEN COALESCE("fileUrl", '') <> '' THEN 'UPLOADED'
      ELSE COALESCE(NULLIF("checklistStatus", ''), 'DRAFT')
    END
    WHERE "checklistStatus" IS NULL OR "checklistStatus" = 'MISSING'
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_export_documents_shipment_current" ON "export_documents" ("shipmentId", "isCurrentVersion")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_export_documents_type_version" ON "export_documents" ("documentType", "versionNo")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_export_documents_buyer_share" ON "export_documents" ("sharedWithBuyer", "sharedAt")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_export_documents_approval_request" ON "export_documents" ("approvalWorkflowRequestId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_export_documents_source_document" ON "export_documents" ("sourceDocumentType", "sourceDocument_id")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_export_documents_file_asset" ON "export_documents" ("fileAsset_id")`,
  );
}

async function ensureTradeFinanceReconciliationWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "lc_discrepancies" (
      "_id" varchar(40) PRIMARY KEY,
      "lcId" varchar(40) NOT NULL,
      "exportDocumentId" varchar(40),
      "documentType" varchar,
      "severity" varchar NOT NULL DEFAULT 'MEDIUM',
      "status" varchar NOT NULL DEFAULT 'OPEN',
      "description" text NOT NULL,
      "resolutionNote" text,
      "dueDate" timestamp,
      "reportedByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "resolvedByUsername" varchar,
      "resolvedAt" timestamp,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await addColumnIfMissing(client, 'trade_finance_transactions', 'expectedAmount', 'numeric(15, 2)');
  await addColumnIfMissing(client, 'trade_finance_transactions', 'varianceAmount', 'numeric(15, 2) NOT NULL DEFAULT 0');
  await addColumnIfMissing(client, 'trade_finance_transactions', 'reconciliationStatus', `varchar NOT NULL DEFAULT 'PENDING'`);
  await addColumnIfMissing(client, 'trade_finance_transactions', 'reconciledByUsername', 'varchar');
  await addColumnIfMissing(client, 'trade_finance_transactions', 'reconciledAt', 'timestamp');

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_lc_discrepancies_lc_status" ON "lc_discrepancies" ("lcId", "status")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_tf_transactions_reconciliation" ON "trade_finance_transactions" ("salesContractId", "reconciliationStatus")`,
  );
}

async function ensureP2PExceptionWorkflow(client: any) {
  if (await tableExists(client, 'purchase_order_items')) {
    await addColumnIfMissing(client, 'purchase_order_items', 'receivedQuantity', 'numeric(12, 2) NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'purchase_order_items', 'rejectedQuantity', 'numeric(12, 2) NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'purchase_order_items', 'backorderQuantity', 'numeric(12, 2) NOT NULL DEFAULT 0');

    await client.query(`
      UPDATE "purchase_order_items"
      SET
        "receivedQuantity" = COALESCE("receivedQuantity", 0),
        "rejectedQuantity" = COALESCE("rejectedQuantity", 0),
        "backorderQuantity" = COALESCE("backorderQuantity", 0)
    `);
  }

  if (await tableExists(client, 'goods_receipt_items')) {
    await addColumnIfMissing(client, 'goods_receipt_items', 'purchaseOrderItem_id', 'varchar(40)');
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_goods_receipt_items_po_line" ON "goods_receipt_items" ("purchaseOrderItem_id")`,
    );
  }

  if (await tableExists(client, 'vendor_invoice_items')) {
    await addColumnIfMissing(client, 'vendor_invoice_items', 'purchaseOrderItem_id', 'varchar(40)');
    await addColumnIfMissing(client, 'vendor_invoice_items', 'goodsReceiptItem_id', 'varchar(40)');
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_vendor_invoice_items_po_line" ON "vendor_invoice_items" ("purchaseOrderItem_id")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_vendor_invoice_items_grn_line" ON "vendor_invoice_items" ("goodsReceiptItem_id")`,
    );
  }

  if (await tableExists(client, 'quality_checks')) {
    await addColumnIfMissing(client, 'quality_checks', 'goodsReceiptId', 'varchar(40)');
    await addColumnIfMissing(client, 'quality_checks', 'goodsReceiptItemId', 'varchar(40)');
    await addColumnIfMissing(client, 'quality_checks', 'purchaseOrderId', 'varchar(40)');
    await addColumnIfMissing(client, 'quality_checks', 'receivedQuantity', 'numeric(12, 2) NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'quality_checks', 'acceptedQuantity', 'numeric(12, 2) NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'quality_checks', 'rejectedQuantity', 'numeric(12, 2) NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'quality_checks', 'quarantineQuantity', 'numeric(12, 2) NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'quality_checks', 'backorderQuantity', 'numeric(12, 2) NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'quality_checks', 'purchaseReturnId', 'varchar(40)');
    await addColumnIfMissing(client, 'quality_checks', 'claimNumber', 'varchar');
    await addColumnIfMissing(client, 'quality_checks', 'claimStatus', `varchar NOT NULL DEFAULT 'NONE'`);
    await addColumnIfMissing(client, 'quality_checks', 'claimSentByUsername', 'varchar(120)');
    await addColumnIfMissing(client, 'quality_checks', 'claimSentAt', 'timestamp');
    await addColumnIfMissing(client, 'quality_checks', 'exceptionStatus', `varchar NOT NULL DEFAULT 'NONE'`);
    await addColumnIfMissing(client, 'quality_checks', 'resolutionType', `varchar NOT NULL DEFAULT 'NONE'`);
    await addColumnIfMissing(client, 'quality_checks', 'creditAmount', 'numeric(15, 2) NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'quality_checks', 'replacementDueDate', 'date');
    await addColumnIfMissing(client, 'quality_checks', 'resolvedByUsername', 'varchar(120)');
    await addColumnIfMissing(client, 'quality_checks', 'resolvedAt', 'timestamp');
    await addColumnIfMissing(client, 'quality_checks', 'resolutionNote', 'text');
    await addColumnIfMissing(client, 'quality_checks', 'correctiveAction', 'text');
    await addColumnIfMissing(client, 'quality_checks', 'updatedAt', 'timestamp NOT NULL DEFAULT NOW()');

    await client.query(`
      UPDATE "quality_checks"
      SET
        "receivedQuantity" = COALESCE("receivedQuantity", 0),
        "acceptedQuantity" = COALESCE("acceptedQuantity", 0),
        "rejectedQuantity" = COALESCE("rejectedQuantity", 0),
        "quarantineQuantity" = COALESCE("quarantineQuantity", 0),
        "backorderQuantity" = COALESCE("backorderQuantity", 0),
        "claimStatus" = COALESCE(NULLIF("claimStatus", ''), 'NONE'),
        "resolutionType" = COALESCE(NULLIF("resolutionType", ''), 'NONE'),
        "creditAmount" = COALESCE("creditAmount", 0),
        "exceptionStatus" = CASE
          WHEN COALESCE(NULLIF("exceptionStatus", ''), 'NONE') <> 'NONE' THEN "exceptionStatus"
          WHEN "result" IN ('FAILED', 'CONDITIONAL') THEN 'QUARANTINED'
          ELSE 'NONE'
        END
    `);

    await backfillReferenceToEntityId(client, 'quality_checks', 'goodsReceiptId', 'goods_receipts');
    await backfillReferenceToEntityId(client, 'quality_checks', 'goodsReceiptItemId', 'goods_receipt_items');
    await backfillReferenceToEntityId(client, 'quality_checks', 'purchaseOrderId', 'purchase_orders');
    await backfillReferenceToEntityId(client, 'quality_checks', 'purchaseReturnId', 'purchase_return');

    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_quality_checks_exception" ON "quality_checks" ("exceptionStatus", "claimStatus")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_quality_checks_grn_line" ON "quality_checks" ("goodsReceiptItemId")`,
    );
  }

  if (await tableExists(client, 'purchase_return')) {
    await addColumnIfMissing(client, 'purchase_return', 'qualityCheckId', 'varchar(40)');
    await addColumnIfMissing(client, 'purchase_return', 'claimNumber', 'varchar');
    await addColumnIfMissing(client, 'purchase_return', 'status', `varchar NOT NULL DEFAULT 'DRAFT'`);
    await addColumnIfMissing(client, 'purchase_return', 'sentByUsername', 'varchar(120)');
    await addColumnIfMissing(client, 'purchase_return', 'sentAt', 'timestamp');
    await addColumnIfMissing(client, 'purchase_return', 'resolvedByUsername', 'varchar(120)');
    await addColumnIfMissing(client, 'purchase_return', 'resolvedAt', 'timestamp');
    await addColumnIfMissing(client, 'purchase_return', 'settlementType', 'varchar');
    await addColumnIfMissing(client, 'purchase_return', 'settlementNote', 'text');

    await client.query(`
      UPDATE "purchase_return"
      SET "status" = COALESCE(NULLIF("status", ''), 'DRAFT')
    `);

    await backfillReferenceToEntityId(client, 'purchase_return', 'qualityCheckId', 'quality_checks');
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_purchase_return_qc_claim" ON "purchase_return" ("qualityCheckId", "claimNumber")`,
    );
  }
}

async function ensureVendorEvaluationWorkflow(client: any) {
  if (await tableExists(client, 'partners')) {
    await addColumnIfMissing(client, 'partners', 'vendorOverallScore', 'numeric(5, 2)');
    await addColumnIfMissing(client, 'partners', 'vendorGrade', 'varchar');
    await addColumnIfMissing(client, 'partners', 'vendorOnTimeDeliveryRate', 'numeric(5, 2)');
    await addColumnIfMissing(client, 'partners', 'vendorDefectRate', 'numeric(5, 2)');
    await addColumnIfMissing(client, 'partners', 'vendorClaimCount', 'integer NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'partners', 'vendorRejectionCount', 'integer NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'partners', 'vendorLastEvaluationAt', 'timestamp');
    await addColumnIfMissing(client, 'partners', 'vendorScoreUpdatedAt', 'timestamp');

    await client.query(`
      UPDATE "partners"
      SET
        "vendorClaimCount" = COALESCE("vendorClaimCount", 0),
        "vendorRejectionCount" = COALESCE("vendorRejectionCount", 0)
    `);
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS "vendor_evaluations" (
      "_id" varchar(40) PRIMARY KEY,
      "vendorId" varchar(40) NOT NULL,
      "purchaseOrderId" varchar(40),
      "goodsReceiptId" varchar(40),
      "vendorInvoiceId" varchar(40),
      "periodStart" date,
      "periodEnd" date,
      "qualityScore" numeric(5, 2) NOT NULL DEFAULT 0,
      "deliveryScore" numeric(5, 2) NOT NULL DEFAULT 0,
      "priceScore" numeric(5, 2) NOT NULL DEFAULT 0,
      "communicationScore" numeric(5, 2) NOT NULL DEFAULT 80,
      "defectRate" numeric(5, 2) NOT NULL DEFAULT 0,
      "onTimeDeliveryRate" numeric(5, 2) NOT NULL DEFAULT 100,
      "overallScore" numeric(5, 2) NOT NULL DEFAULT 0,
      "grade" varchar NOT NULL DEFAULT 'C',
      "status" varchar NOT NULL DEFAULT 'DRAFT',
      "evaluatedByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "submittedByUsername" varchar,
      "approvedByUsername" varchar,
      "approvedAt" timestamp,
      "note" text,
      "approvalNote" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_vendor_evaluations_vendor_status" ON "vendor_evaluations" ("vendorId", "status")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_vendor_evaluations_score" ON "vendor_evaluations" ("overallScore", "grade")`,
  );
}

async function ensureAccountingProductionWorkflow(client: any) {
  if (await tableExists(client, 'accounting_periods')) {
    await renameColumnIfExists(client, 'accounting_periods', 'closedBy', 'closedByUsername');
    await addColumnIfMissing(client, 'accounting_periods', 'closedByUsername', 'varchar');
    await addColumnIfMissing(client, 'accounting_periods', 'reopenedByUsername', 'varchar');
    await addColumnIfMissing(client, 'accounting_periods', 'reopenedAt', 'timestamp');
    await addColumnIfMissing(client, 'accounting_periods', 'reopenReason', 'text');
    await addColumnIfMissing(client, 'accounting_periods', 'closingJournalEntryId', 'varchar(40)');
    await addColumnIfMissing(client, 'accounting_periods', 'reopenApprovalWorkflowRequest_id', 'varchar(40)');
    await addColumnIfMissing(client, 'accounting_periods', 'lockApprovalWorkflowRequest_id', 'varchar(40)');
    await addColumnIfMissing(client, 'accounting_periods', 'reopenCount', 'integer NOT NULL DEFAULT 0');
    await addColumnIfMissing(client, 'accounting_periods', 'closeReason', 'text');
    await addColumnIfMissing(client, 'accounting_periods', 'lockedByUsername', 'varchar');
    await addColumnIfMissing(client, 'accounting_periods', 'lockedAt', 'timestamp');
    await addColumnIfMissing(client, 'accounting_periods', 'lockReason', 'text');
    await addColumnIfMissing(client, 'accounting_periods', 'periodHash', 'varchar');

    await client.query(`
      UPDATE "accounting_periods"
      SET "status" = COALESCE(NULLIF("status", ''), 'OPEN')
    `);
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS "fx_revaluations" (
      "_id" varchar(40) PRIMARY KEY,
      "runNumber" varchar NOT NULL UNIQUE,
      "periodId" varchar(40),
      "sourceType" varchar NOT NULL,
      "sourceId" varchar(40) NOT NULL,
      "partnerId" varchar(40),
      "currency" varchar NOT NULL DEFAULT 'USD',
      "revaluationDate" date NOT NULL,
      "openAmountForeign" numeric(15, 2) NOT NULL DEFAULT 0,
      "bookRate" numeric(15, 6) NOT NULL DEFAULT 1,
      "closingRate" numeric(15, 6) NOT NULL DEFAULT 1,
      "bookValueVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "revaluedValueVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "gainLossVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "status" varchar NOT NULL DEFAULT 'DRAFT',
      "journalEntryId" varchar(40),
      "createdByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "postedByUsername" varchar,
      "postedAt" timestamp,
      "note" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "vat_refund_dossiers" (
      "_id" varchar(40) PRIMARY KEY,
      "dossierNumber" varchar NOT NULL UNIQUE,
      "periodStart" date NOT NULL,
      "periodEnd" date NOT NULL,
      "exportRevenueVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "inputVatAmount" numeric(15, 2) NOT NULL DEFAULT 0,
      "outputVatAmount" numeric(15, 2) NOT NULL DEFAULT 0,
      "refundAmount" numeric(15, 2) NOT NULL DEFAULT 0,
      "taxReportHash" varchar,
      "taxReportSnapshot" jsonb,
      "status" varchar NOT NULL DEFAULT 'DRAFT',
      "createdByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "submittedByUsername" varchar,
      "submittedAt" timestamp,
      "approvedByUsername" varchar,
      "approvedAt" timestamp,
      "approvalWorkflowRequestId" varchar(40),
      "rejectedByUsername" varchar,
      "rejectedAt" timestamp,
      "paidByUsername" varchar,
      "paidAt" timestamp,
      "receivableJournalEntryId" varchar(40),
      "paymentJournalEntryId" varchar(40),
      "paymentReference" varchar,
      "approvalNote" text,
      "rejectionReason" text,
      "note" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await addColumnIfMissing(client, 'vat_refund_dossiers', 'taxReportHash', 'varchar');
  await addColumnIfMissing(client, 'vat_refund_dossiers', 'taxReportSnapshot', 'jsonb');
  await addColumnIfMissing(client, 'vat_refund_dossiers', 'approvalWorkflowRequestId', 'varchar(40)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS "tax_report_runs" (
      "_id" varchar(40) PRIMARY KEY,
      "runNumber" varchar NOT NULL UNIQUE,
      "periodStart" date NOT NULL,
      "periodEnd" date NOT NULL,
      "accountingPeriod_id" varchar(40),
      "status" varchar NOT NULL DEFAULT 'FROZEN',
      "generatedByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "generatedAt" timestamp NOT NULL DEFAULT NOW(),
      "reportHash" varchar NOT NULL,
      "runHash" varchar NOT NULL,
      "summary" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "accountBreakdown" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "journalLines" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "documentTrace" jsonb,
      "reconciliation" jsonb,
      "warnings" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await addColumnIfMissing(client, 'tax_report_runs', 'documentTrace', 'jsonb');
  await addColumnIfMissing(client, 'tax_report_runs', 'reconciliation', 'jsonb');

  await client.query(`
    CREATE TABLE IF NOT EXISTS "accounting_period_close_packets" (
      "_id" varchar(40) PRIMARY KEY,
      "packetNumber" varchar NOT NULL UNIQUE,
      "period_id" varchar(40) NOT NULL,
      "taxReportRun_id" varchar(40),
      "closingJournalEntry_id" varchar(40),
      "periodStart" date NOT NULL,
      "periodEnd" date NOT NULL,
      "status" varchar NOT NULL DEFAULT 'GENERATED',
      "generatedByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "generatedAt" timestamp NOT NULL DEFAULT NOW(),
      "periodHash" varchar,
      "preCloseTrialBalanceHash" varchar NOT NULL,
      "finalTrialBalanceHash" varchar NOT NULL,
      "taxReportHash" varchar,
      "auditChainHeadHash" varchar,
      "packetHash" varchar NOT NULL,
      "journalCount" integer NOT NULL DEFAULT 0,
      "warningCount" integer NOT NULL DEFAULT 0,
      "failedCheckCount" integer NOT NULL DEFAULT 0,
      "closeChecklist" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "preCloseTrialBalanceSnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "finalTrialBalanceSnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "taxReportSnapshot" jsonb,
      "fxRevaluationSnapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "vatRefundSnapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "journalSummary" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "accounting_audit_events" (
      "_id" varchar(40) PRIMARY KEY,
      "eventType" varchar NOT NULL,
      "entityType" varchar NOT NULL,
      "entityId" varchar(40) NOT NULL,
      "referenceType" varchar,
      "referenceId" varchar(40),
      "username" varchar,
      "eventAt" timestamp NOT NULL,
      "payload" jsonb,
      "previousHash" varchar,
      "eventHash" varchar NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await ensureEntityId(client, 'fx_revaluations', 'fx_reval', `COALESCE("runNumber", '') || ':' || COALESCE("sourceId"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'vat_refund_dossiers', 'vat_refund', `COALESCE("dossierNumber", '') || ':' || COALESCE("periodStart"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'tax_report_runs', 'tax_run', `COALESCE("runNumber", '') || ':' || COALESCE("periodEnd"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'accounting_period_close_packets', 'close_packet', `COALESCE("packetNumber", '') || ':' || COALESCE("period_id"::text, '') || ':' || ctid::text`);
  await ensureEntityId(client, 'accounting_audit_events', 'acct_audit', `COALESCE("eventType", '') || ':' || COALESCE("entityId"::text, '') || ':' || ctid::text`);

  await backfillReferenceToEntityId(client, 'fx_revaluations', 'periodId', 'accounting_periods');
  await backfillReferenceToEntityId(client, 'fx_revaluations', 'journalEntryId', 'journal_entries');
  await backfillReferenceToEntityId(client, 'vat_refund_dossiers', 'receivableJournalEntryId', 'journal_entries');
  await backfillReferenceToEntityId(client, 'vat_refund_dossiers', 'paymentJournalEntryId', 'journal_entries');
  await backfillReferenceToEntityId(client, 'tax_report_runs', 'accountingPeriod_id', 'accounting_periods');
  await backfillReferenceToEntityId(client, 'accounting_period_close_packets', 'period_id', 'accounting_periods');
  await backfillReferenceToEntityId(client, 'accounting_period_close_packets', 'taxReportRun_id', 'tax_report_runs');
  await backfillReferenceToEntityId(client, 'accounting_period_close_packets', 'closingJournalEntry_id', 'journal_entries');
  await backfillReferenceToEntityId(client, 'accounting_periods', 'reopenApprovalWorkflowRequest_id', 'approval_workflow_requests');
  await backfillReferenceToEntityId(client, 'accounting_periods', 'lockApprovalWorkflowRequest_id', 'approval_workflow_requests');

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_fx_revaluations_period_currency" ON "fx_revaluations" ("periodId", "currency")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_fx_revaluations_source" ON "fx_revaluations" ("sourceType", "sourceId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_vat_refund_dossiers_period" ON "vat_refund_dossiers" ("periodStart", "periodEnd")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_vat_refund_dossiers_status" ON "vat_refund_dossiers" ("status")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_vat_refund_dossiers_approval_request" ON "vat_refund_dossiers" ("approvalWorkflowRequestId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_tax_report_runs_period" ON "tax_report_runs" ("periodStart", "periodEnd")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_tax_report_runs_accounting_period" ON "tax_report_runs" ("accountingPeriod_id")`,
  );
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "idx_tax_report_runs_hash" ON "tax_report_runs" ("runHash")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_accounting_close_packets_period" ON "accounting_period_close_packets" ("period_id")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_accounting_periods_reopen_approval" ON "accounting_periods" ("reopenApprovalWorkflowRequest_id")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_accounting_periods_lock_approval" ON "accounting_periods" ("lockApprovalWorkflowRequest_id")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_accounting_close_packets_tax_run" ON "accounting_period_close_packets" ("taxReportRun_id")`,
  );
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "idx_accounting_close_packets_hash" ON "accounting_period_close_packets" ("packetHash")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_accounting_audit_events_entity" ON "accounting_audit_events" ("entityType", "entityId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_accounting_audit_events_reference" ON "accounting_audit_events" ("referenceType", "referenceId")`,
  );
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "idx_accounting_audit_events_hash" ON "accounting_audit_events" ("eventHash")`,
  );
}

async function ensureApprovalMatrixWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "approval_rules" (
      "_id" varchar(40) PRIMARY KEY,
      "code" varchar NOT NULL UNIQUE,
      "name" varchar NOT NULL,
      "documentType" varchar NOT NULL,
      "currency" varchar,
      "minAmountVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "maxAmountVnd" numeric(15, 2),
      "priority" integer NOT NULL DEFAULT 100,
      "isActive" boolean NOT NULL DEFAULT true,
      "description" text,
      "createdByUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "updatedByUsername" varchar,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "approval_rule_steps" (
      "_id" varchar(40) PRIMARY KEY,
      "ruleId" varchar(40) NOT NULL,
      "stepOrder" integer NOT NULL,
      "approverRoleName" varchar NOT NULL,
      "approverUsername" varchar,
      "label" varchar,
      "isRequired" boolean NOT NULL DEFAULT true,
      CONSTRAINT "FK_approval_rule_steps_rule"
        FOREIGN KEY ("ruleId") REFERENCES "approval_rules"("_id") ON DELETE CASCADE
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "approval_workflow_requests" (
      "_id" varchar(40) PRIMARY KEY,
      "ruleId" varchar(40),
      "documentType" varchar NOT NULL,
      "documentId" varchar(40) NOT NULL,
      "documentNumber" varchar,
      "title" varchar NOT NULL,
      "currency" varchar NOT NULL DEFAULT 'VND',
      "amount" numeric(15, 2) NOT NULL DEFAULT 0,
      "amountVnd" numeric(15, 2) NOT NULL DEFAULT 0,
      "status" varchar NOT NULL DEFAULT 'PENDING',
      "currentStepOrder" integer NOT NULL DEFAULT 1,
      "requesterUsername" varchar NOT NULL DEFAULT '${SYSTEM_USERNAME}',
      "completedByUsername" varchar,
      "completedAt" timestamp,
      "rejectionReason" text,
      "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW(),
      CONSTRAINT "FK_approval_requests_rule"
        FOREIGN KEY ("ruleId") REFERENCES "approval_rules"("_id") ON DELETE SET NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "approval_workflow_steps" (
      "_id" varchar(40) PRIMARY KEY,
      "requestId" varchar(40) NOT NULL,
      "stepOrder" integer NOT NULL,
      "approverRoleName" varchar NOT NULL,
      "approverUsername" varchar,
      "status" varchar NOT NULL DEFAULT 'PENDING',
      "actedByUsername" varchar,
      "actedAt" timestamp,
      "note" text,
      CONSTRAINT "FK_approval_workflow_steps_request"
        FOREIGN KEY ("requestId") REFERENCES "approval_workflow_requests"("_id") ON DELETE CASCADE
    )
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_approval_rules_type_active" ON "approval_rules" ("documentType", "isActive")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_approval_rules_amount" ON "approval_rules" ("minAmountVnd", "maxAmountVnd")`,
  );
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "idx_approval_rule_steps_rule_order" ON "approval_rule_steps" ("ruleId", "stepOrder")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_approval_requests_document" ON "approval_workflow_requests" ("documentType", "documentId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_approval_requests_status" ON "approval_workflow_requests" ("status", "currentStepOrder")`,
  );
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "idx_approval_steps_request_order" ON "approval_workflow_steps" ("requestId", "stepOrder")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_approval_steps_assignee" ON "approval_workflow_steps" ("status", "approverRoleName", "approverUsername")`,
  );
}

async function ensurePurchaseOrderApprovalWorkflow(client: any) {
  if (!(await tableExists(client, 'purchase_orders'))) return;

  await client.query(`
    DO $$
    DECLARE
      status_enum_name text;
    BEGIN
      SELECT t.typname INTO status_enum_name
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_type t ON t.oid = a.atttypid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'purchase_orders'
        AND a.attname = 'status'
        AND t.typtype = 'e'
      LIMIT 1;

      IF status_enum_name IS NOT NULL THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum_name, 'PENDING_APPROVAL');
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum_name, 'APPROVED');
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum_name, 'REJECTED');
      END IF;
    END $$;
  `);

  await addColumnIfMissing(client, 'purchase_orders', 'approvalWorkflowRequestId', 'varchar(40)');
  await addColumnIfMissing(client, 'purchase_orders', 'submittedForApprovalByUsername', 'varchar');
  await addColumnIfMissing(client, 'purchase_orders', 'submittedForApprovalAt', 'timestamp');
  await addColumnIfMissing(client, 'purchase_orders', 'approvedByUsername', 'varchar');
  await addColumnIfMissing(client, 'purchase_orders', 'approvedAt', 'timestamp');
  await addColumnIfMissing(client, 'purchase_orders', 'rejectionReason', 'text');
  await addColumnIfMissing(client, 'purchase_orders', 'cancellationReason', 'text');
  await addColumnIfMissing(client, 'purchase_orders', 'cancelledByUsername', 'varchar');
  await addColumnIfMissing(client, 'purchase_orders', 'cancelledAt', 'timestamp');
  await addColumnIfMissing(client, 'purchase_orders', 'auditTrail', 'jsonb');

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_purchase_orders_approval_request" ON "purchase_orders" ("approvalWorkflowRequestId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_purchase_orders_approval_status" ON "purchase_orders" ("status", "submittedForApprovalAt")`,
  );
}

async function addEnumValuesIfColumnUsesEnum(
  client: any,
  tableName: string,
  columnName: string,
  values: string[],
) {
  if (!(await tableExists(client, tableName))) return;
  if (!(await columnExists(client, tableName, columnName))) return;

  const escapedTableName = tableName.replace(/'/g, "''");
  const escapedColumnName = columnName.replace(/'/g, "''");
  const enumStatements = values
    .map(
      (value) =>
        `EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum_name, '${value.replace(/'/g, "''")}');`,
    )
    .join('\n        ');

  await client.query(`
    DO $$
    DECLARE
      status_enum_name text;
    BEGIN
      SELECT t.typname INTO status_enum_name
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_type t ON t.oid = a.atttypid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = '${escapedTableName}'
        AND a.attname = '${escapedColumnName}'
        AND t.typtype = 'e'
      LIMIT 1;

      IF status_enum_name IS NOT NULL THEN
        ${enumStatements}
      END IF;
    END $$;
  `);
}

async function ensureP2PSalesApprovalWorkflowCoverage(client: any) {
  if (await tableExists(client, 'purchase_requests')) {
    await addEnumValuesIfColumnUsesEnum(client, 'purchase_requests', 'status', [
      'PENDING',
      'APPROVED',
      'REJECTED',
    ]);
    await addColumnIfMissing(client, 'purchase_requests', 'approvalWorkflowRequestId', 'varchar(40)');
    await addColumnIfMissing(client, 'purchase_requests', 'submittedForApprovalByUsername', 'varchar');
    await addColumnIfMissing(client, 'purchase_requests', 'submittedForApprovalAt', 'timestamp');
    await addColumnIfMissing(client, 'purchase_requests', 'approvedByUsername', 'varchar');
    await addColumnIfMissing(client, 'purchase_requests', 'approvedAt', 'timestamp');
    await addColumnIfMissing(client, 'purchase_requests', 'rejectionReason', 'text');

    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_purchase_requests_approval_request" ON "purchase_requests" ("approvalWorkflowRequestId")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_purchase_requests_approval_status" ON "purchase_requests" ("status", "submittedForApprovalAt")`,
    );
  }

  if (await tableExists(client, 'quotations')) {
    await addEnumValuesIfColumnUsesEnum(client, 'quotations', 'status', [
      'PENDING_APPROVAL',
      'REJECTED',
    ]);
    await addColumnIfMissing(client, 'quotations', 'approvalWorkflowRequestId', 'varchar(40)');
    await addColumnIfMissing(client, 'quotations', 'submittedForApprovalByUsername', 'varchar');
    await addColumnIfMissing(client, 'quotations', 'submittedForApprovalAt', 'timestamp');
    await addColumnIfMissing(client, 'quotations', 'approvedByUsername', 'varchar');
    await addColumnIfMissing(client, 'quotations', 'approvedAt', 'timestamp');
    await addColumnIfMissing(client, 'quotations', 'rejectedByUsername', 'varchar');
    await addColumnIfMissing(client, 'quotations', 'rejectedAt', 'timestamp');
    await addColumnIfMissing(client, 'quotations', 'rejectionReason', 'text');

    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_quotations_approval_request" ON "quotations" ("approvalWorkflowRequestId")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_quotations_approval_status" ON "quotations" ("status", "submittedForApprovalAt")`,
    );
  }

  if (await tableExists(client, 'proforma_invoices')) {
    await addEnumValuesIfColumnUsesEnum(client, 'proforma_invoices', 'status', [
      'PENDING_APPROVAL',
      'REJECTED',
    ]);
    await addColumnIfMissing(client, 'proforma_invoices', 'approvalWorkflowRequestId', 'varchar(40)');
    await addColumnIfMissing(client, 'proforma_invoices', 'submittedForApprovalByUsername', 'varchar');
    await addColumnIfMissing(client, 'proforma_invoices', 'submittedForApprovalAt', 'timestamp');
    await addColumnIfMissing(client, 'proforma_invoices', 'approvedByUsername', 'varchar');
    await addColumnIfMissing(client, 'proforma_invoices', 'approvedAt', 'timestamp');
    await addColumnIfMissing(client, 'proforma_invoices', 'rejectedByUsername', 'varchar');
    await addColumnIfMissing(client, 'proforma_invoices', 'rejectedAt', 'timestamp');
    await addColumnIfMissing(client, 'proforma_invoices', 'rejectionReason', 'text');

    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_proforma_invoices_approval_request" ON "proforma_invoices" ("approvalWorkflowRequestId")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_proforma_invoices_approval_status" ON "proforma_invoices" ("status", "submittedForApprovalAt")`,
    );
  }
}

async function ensureSalesContractApprovalSignatureWorkflow(client: any) {
  if (await tableExists(client, 'sales_contracts')) {
    await client.query(`
      DO $$
      DECLARE
        status_enum_name text;
      BEGIN
        SELECT t.typname INTO status_enum_name
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_type t ON t.oid = a.atttypid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'sales_contracts'
          AND a.attname = 'status'
          AND t.typtype = 'e'
        LIMIT 1;

        IF status_enum_name IS NOT NULL THEN
          EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum_name, 'PENDING_APPROVAL');
          EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum_name, 'APPROVED');
          EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum_name, 'PENDING_BUYER_SIGNATURE');
          EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum_name, 'BUYER_SIGNED');
          EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum_name, 'PENDING_CANCEL_APPROVAL');
          EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum_name, 'REJECTED');
        END IF;
      END $$;
    `);

    await addColumnIfMissing(client, 'sales_contracts', 'approvalWorkflowRequestId', 'varchar(40)');
    await addColumnIfMissing(client, 'sales_contracts', 'submittedForApprovalByUsername', 'varchar');
    await addColumnIfMissing(client, 'sales_contracts', 'submittedForApprovalAt', 'timestamp');
    await addColumnIfMissing(client, 'sales_contracts', 'approvedByUsername', 'varchar');
    await addColumnIfMissing(client, 'sales_contracts', 'approvedAt', 'timestamp');
    await addColumnIfMissing(client, 'sales_contracts', 'rejectedByUsername', 'varchar');
    await addColumnIfMissing(client, 'sales_contracts', 'rejectedAt', 'timestamp');
    await addColumnIfMissing(client, 'sales_contracts', 'rejectionReason', 'text');
    await addColumnIfMissing(client, 'sales_contracts', 'cancellationReason', 'text');
    await addColumnIfMissing(client, 'sales_contracts', 'cancelledByUsername', 'varchar');
    await addColumnIfMissing(client, 'sales_contracts', 'cancelledAt', 'timestamp');
    await addColumnIfMissing(client, 'sales_contracts', 'signatureStatus', `varchar NOT NULL DEFAULT 'NOT_SENT'`);
    await addColumnIfMissing(client, 'sales_contracts', 'signatureRequestedByUsername', 'varchar');
    await addColumnIfMissing(client, 'sales_contracts', 'signatureRequestedAt', 'timestamp');
    await addColumnIfMissing(client, 'sales_contracts', 'buyerSignedAt', 'timestamp');
    await addColumnIfMissing(client, 'sales_contracts', 'counterSignedAt', 'timestamp');
    await addColumnIfMissing(client, 'sales_contracts', 'signatureDocumentHash', 'varchar');

    await client.query(`
      UPDATE "sales_contracts"
      SET "signatureStatus" = COALESCE(NULLIF("signatureStatus", ''), 'NOT_SENT')
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_contracts_approval_request" ON "sales_contracts" ("approvalWorkflowRequestId")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_contracts_signature_status" ON "sales_contracts" ("status", "signatureStatus")`,
    );
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS "contract_signatures" (
      "_id" varchar(40) PRIMARY KEY,
      "contractId" varchar(40) NOT NULL,
      "signerType" varchar NOT NULL,
      "signerName" varchar NOT NULL,
      "signerTitle" varchar,
      "signerEmail" varchar,
      "signedByUsername" varchar,
      "signatureImageFileId" varchar(40),
      "ipAddress" varchar,
      "userAgent" text,
      "signedAt" timestamp NOT NULL,
      "consentText" text NOT NULL,
      "documentHash" varchar NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await backfillReferenceToEntityId(client, 'contract_signatures', 'contractId', 'sales_contracts');
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_contract_signatures_contract" ON "contract_signatures" ("contractId", "signerType")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_contract_signatures_signed_at" ON "contract_signatures" ("signedAt")`,
  );

  await client.query(`
    CREATE TABLE IF NOT EXISTS "contract_signature_invitations" (
      "_id" varchar(40) PRIMARY KEY,
      "contractId" varchar(40) NOT NULL,
      "signerType" varchar NOT NULL,
      "signerName" varchar NOT NULL,
      "signerTitle" varchar,
      "signerEmail" varchar,
      "status" varchar NOT NULL DEFAULT 'CREATED',
      "tokenHash" varchar NOT NULL,
      "otpHash" varchar NOT NULL,
      "otpExpiresAt" timestamp NOT NULL,
      "otpAttemptCount" integer NOT NULL DEFAULT 0,
      "expiresAt" timestamp NOT NULL,
      "sentByUsername" varchar,
      "sentAt" timestamp,
      "openedAt" timestamp,
      "verifiedAt" timestamp,
      "signedAt" timestamp,
      "revokedAt" timestamp,
      "revokedByUsername" varchar,
      "revokeReason" text,
      "certificateNumber" varchar,
      "certificateHash" varchar,
      "auditTrail" jsonb,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await backfillReferenceToEntityId(client, 'contract_signature_invitations', 'contractId', 'sales_contracts');
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_contract_signature_invitations_contract" ON "contract_signature_invitations" ("contractId", "status")`,
  );
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "idx_contract_signature_invitations_token" ON "contract_signature_invitations" ("tokenHash")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_contract_signature_invitations_status" ON "contract_signature_invitations" ("status", "expiresAt")`,
  );
}

async function ensurePortalProductionWorkflow(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "portal_payment_receipts" (
      "_id" varchar(40) PRIMARY KEY,
      "receiptNumber" varchar NOT NULL UNIQUE,
      "buyerId" varchar(40) NOT NULL,
      "accountReceivableId" varchar(40),
      "salesContractId" varchar(40),
      "receiptType" varchar NOT NULL,
      "amount" numeric(15, 2) NOT NULL,
      "currency" varchar NOT NULL DEFAULT 'USD',
      "exchangeRate" numeric(15, 6) NOT NULL DEFAULT 1,
      "bankReference" varchar,
      "remittingBank" varchar,
      "transactionDate" timestamp,
      "fileAsset_id" varchar(40) NOT NULL,
      "tradeFinanceTransactionId" varchar(40),
      "status" varchar NOT NULL DEFAULT 'SUBMITTED',
      "submittedByUsername" varchar NOT NULL,
      "submittedAt" timestamp NOT NULL DEFAULT NOW(),
      "reviewedByUsername" varchar,
      "reviewedAt" timestamp,
      "rejectionReason" text,
      "note" text,
      "auditTrail" jsonb,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await addColumnIfMissing(client, 'portal_payment_receipts', 'accountReceivableId', 'varchar(40)');
  await addColumnIfMissing(client, 'portal_payment_receipts', 'salesContractId', 'varchar(40)');
  await addColumnIfMissing(client, 'portal_payment_receipts', 'tradeFinanceTransactionId', 'varchar(40)');
  await addColumnIfMissing(client, 'portal_payment_receipts', 'auditTrail', 'jsonb');

  await client.query(`
    CREATE TABLE IF NOT EXISTS "portal_support_tickets" (
      "_id" varchar(40) PRIMARY KEY,
      "ticketNumber" varchar NOT NULL UNIQUE,
      "buyerId" varchar(40) NOT NULL,
      "shipmentId" varchar(40),
      "subject" varchar NOT NULL,
      "category" varchar NOT NULL DEFAULT 'OTHER',
      "priority" varchar NOT NULL DEFAULT 'MEDIUM',
      "status" varchar NOT NULL DEFAULT 'OPEN',
      "createdByUsername" varchar NOT NULL,
      "assignedToUsername" varchar,
      "lastMessageAt" timestamp,
      "closedAt" timestamp,
      "attachments" jsonb,
      "auditTrail" jsonb,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "portal_support_messages" (
      "_id" varchar(40) PRIMARY KEY,
      "ticket_id" varchar(40) NOT NULL,
      "authorUsername" varchar NOT NULL,
      "authorType" varchar NOT NULL,
      "message" text NOT NULL,
      "attachments" jsonb,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "portal_notifications" (
      "_id" varchar(40) PRIMARY KEY,
      "buyerId" varchar(40) NOT NULL,
      "type" varchar NOT NULL,
      "severity" varchar NOT NULL DEFAULT 'INFO',
      "title" varchar NOT NULL,
      "description" text NOT NULL,
      "referenceType" varchar,
      "referenceId" varchar(40),
      "readAt" timestamp,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_portal_payment_receipts_buyer" ON "portal_payment_receipts" ("buyerId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_portal_payment_receipts_ar" ON "portal_payment_receipts" ("accountReceivableId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_portal_payment_receipts_contract" ON "portal_payment_receipts" ("salesContractId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_portal_support_tickets_buyer" ON "portal_support_tickets" ("buyerId")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_portal_support_tickets_status" ON "portal_support_tickets" ("status")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_portal_support_messages_ticket" ON "portal_support_messages" ("ticket_id")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_portal_notifications_buyer_read" ON "portal_notifications" ("buyerId", "readAt")`,
  );
}

export async function runIdentitySchemaPreflight(options: DatabasePreflightOptions) {
  const { Client } = require('pg');
  const client = new Client({
    host: options.host,
    port: options.port,
    user: options.username,
    password: options.password,
    database: options.database,
  });

  await client.connect();

  try {
    await client.query('BEGIN');
    await ensureRoles(client);
    await ensurePermissions(client);
    await ensureUsers(client);
    await ensureRolePermissions(client);
    await ensureBusinessUserReferences(client);
    await ensureAuditLogs(client);
    await ensureSettings(client);
    await ensureAdminCoreEntityIds(client);
    await ensureP2PEntityIds(client);
    await ensureAccountPayableWorkflow(client);
    await ensureInventoryCountWorkflow(client);
    await ensureInventoryReturnWorkflow(client);
    await ensureExportDeliveryAdjustmentWorkflow(client);
    await ensureAccountReceivableWorkflow(client);
    await ensureCommercialInvoiceWorkflow(client);
    await ensurePricingPolicyWorkflow(client);
    await ensureProductChangeWorkflow(client);
    await ensureVendorPriceHistoryWorkflow(client);
    await ensureFilesWorkflow(client);
    await ensureExportDocumentWorkflow(client);
    await ensureTradeFinanceReconciliationWorkflow(client);
    await ensureP2PExceptionWorkflow(client);
    await ensureVendorEvaluationWorkflow(client);
    await ensureAccountingProductionWorkflow(client);
    await ensurePortalProductionWorkflow(client);
    await ensureApprovalMatrixWorkflow(client);
    await ensurePurchaseOrderApprovalWorkflow(client);
    await ensureP2PSalesApprovalWorkflowCoverage(client);
    await ensureSalesContractApprovalSignatureWorkflow(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
