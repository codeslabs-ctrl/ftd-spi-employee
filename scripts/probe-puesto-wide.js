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
      SELECT owner, table_name,
             LISTAGG(column_name, ',') WITHIN GROUP (ORDER BY column_id) AS cols
        FROM all_tab_columns
       WHERE UPPER(column_name) IN (
              'ID_CARGO','ID_UNIDAD','FUNCION','FUNCIONES','RIESGO','PROPOSITO','MAX_PUESTO'
            )
       GROUP BY owner, table_name
      HAVING SUM(CASE WHEN UPPER(column_name)='ID_CARGO' THEN 1 ELSE 0 END) > 0
          OR (
               SUM(CASE WHEN UPPER(column_name)='RIESGO' THEN 1 ELSE 0 END) > 0
           AND SUM(CASE WHEN UPPER(column_name)='FUNCION' THEN 1 ELSE 0 END) > 0
           AND SUM(CASE WHEN UPPER(column_name)='ID_EMPRESA' THEN 1 ELSE 0 END) = 0
             )
       ORDER BY 1, 2`);
    // Simpler: any table with ID_CARGO
    const cargo = await conn.execute(`
      SELECT owner, table_name FROM all_tab_columns
       WHERE UPPER(column_name) = 'ID_CARGO'
       GROUP BY owner, table_name ORDER BY 1,2`);
    console.log('Any table with ID_CARGO:');
    for (const row of cargo.rows) console.log(`  ${row[0]}.${row[1]}`);

    const riesgo = await conn.execute(`
      SELECT c.owner, c.table_name
        FROM all_tab_columns c
       WHERE UPPER(c.column_name) = 'RIESGO'
         AND EXISTS (
           SELECT 1 FROM all_tab_columns x
            WHERE x.owner=c.owner AND x.table_name=c.table_name
              AND UPPER(x.column_name)='FUNCION'
         )
         AND EXISTS (
           SELECT 1 FROM all_tab_columns x
            WHERE x.owner=c.owner AND x.table_name=c.table_name
              AND UPPER(x.column_name)='ID_EMPRESA'
         )
       GROUP BY c.owner, c.table_name
       ORDER BY 1,2`);
    console.log('Tables with RIESGO+FUNCION+ID_EMPRESA:');
    for (const row of riesgo.rows) {
      console.log(`  ${row[0]}.${row[1]}`);
      const cols = await conn.execute(
        `SELECT column_name, data_type, data_length, data_precision
           FROM all_tab_columns WHERE owner=:o AND table_name=:t ORDER BY column_id`,
        { o: row[0], t: row[1] },
      );
      for (const col of cols.rows) console.log(`    ${col.join(' | ')}`);
    }

    // grants for people_one on missing tables?
    const priv = await conn.execute(`
      SELECT table_schema, table_name, privilege
        FROM all_tab_privs
       WHERE grantee = USER
         AND UPPER(table_name) LIKE '%PUEST%'
       ORDER BY 1,2`);
    console.log('Privileges on %PUEST%:');
    for (const row of priv.rows) console.log(`  ${row.join(' | ')}`);
  } finally {
    await conn.close();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
