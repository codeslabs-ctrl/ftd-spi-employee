require('dotenv').config();
const oracledb = require('oracledb');

async function dumpTable(conn, owner, table) {
  console.log(`--- ${owner}.${table} ---`);
  const cols = await conn.execute(
    `SELECT column_name, data_type, data_length, data_precision, nullable
       FROM all_tab_columns
      WHERE owner = :o AND table_name = :t
      ORDER BY column_id`,
    { o: owner, t: table },
  );
  for (const col of cols.rows) console.log(`  ${col.join(' | ')}`);
}

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.DB_VE_USER,
    password: process.env.DB_VE_PASSWORD,
    connectString: process.env.DB_VE_CONNECT_STRING,
  });
  try {
    const byCol = await conn.execute(`
      SELECT owner, table_name, column_name
        FROM all_tab_columns
       WHERE UPPER(column_name) IN ('ID_CARGO','ID_UNIDAD','FECHA_INI')
         AND owner IN ('INFOCENT','PEOPLE_ONE','CORSOX')
       ORDER BY column_name, owner, table_name`);
    console.log('COLUMN HITS:');
    for (const row of byCol.rows) console.log(`  ${row.join(' | ')}`);

    for (const t of [
      ['INFOCENT', 'TA_RELACION_PUESTO'],
      ['INFOCENT', 'NMT020'],
      ['INFOCENT', 'NMT022'],
      ['INFOCENT', 'NMT023'],
    ]) {
      await dumpTable(conn, t[0], t[1]);
    }

    // synonym search
    const syn = await conn.execute(`
      SELECT owner, synonym_name, table_owner, table_name
        FROM all_synonyms
       WHERE UPPER(synonym_name) LIKE '%PUEST%'
          OR UPPER(table_name) LIKE '%PUEST%'
       ORDER BY 1, 2`);
    console.log('SYNONYMS:');
    for (const row of syn.rows) console.log(`  ${row.join(' | ')}`);
  } finally {
    await conn.close();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
