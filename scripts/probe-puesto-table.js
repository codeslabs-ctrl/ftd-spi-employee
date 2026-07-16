require('dotenv').config();
const oracledb = require('oracledb');

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.DB_VE_USER,
    password: process.env.DB_VE_PASSWORD,
    connectString: process.env.DB_VE_CONNECT_STRING,
  });
  try {
    const r = await conn.execute(`
      SELECT owner, table_name FROM all_tables
       WHERE UPPER(table_name) LIKE '%PUEST%'
          OR UPPER(table_name) LIKE '%NMT0%'
       ORDER BY 1, 2`);
    console.log('CANDIDATES:');
    for (const row of r.rows) console.log(`  ${row[0]}.${row[1]}`);

    // Look for tables with ID_CARGO + ID_UNIDAD (puesto signature)
    const sig = await conn.execute(`
      SELECT c.owner, c.table_name
        FROM all_tab_columns c
       WHERE UPPER(c.column_name) = 'ID_CARGO'
         AND EXISTS (
               SELECT 1 FROM all_tab_columns u
                WHERE u.owner = c.owner
                  AND u.table_name = c.table_name
                  AND UPPER(u.column_name) = 'ID_UNIDAD'
             )
       ORDER BY 1, 2`);
    console.log('TABLES WITH ID_CARGO + ID_UNIDAD:');
    for (const row of sig.rows) {
      console.log(`  ${row[0]}.${row[1]}`);
      const cols = await conn.execute(
        `SELECT column_name, data_type, data_length, data_precision, nullable
           FROM all_tab_columns
          WHERE owner = :o AND table_name = :t
          ORDER BY column_id`,
        { o: row[0], t: row[1] },
      );
      for (const col of cols.rows) console.log(`    ${col.join(' | ')}`);
    }
  } finally {
    await conn.close();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
