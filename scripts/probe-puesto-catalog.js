require('dotenv').config();
const oracledb = require('oracledb');

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.DB_VE_USER,
    password: process.env.DB_VE_PASSWORD,
    connectString: process.env.DB_VE_CONNECT_STRING,
  });
  try {
    // Tables that have ID_PUESTO as a column (catalog vs relation)
    const r = await conn.execute(`
      SELECT owner, table_name
        FROM all_tab_columns
       WHERE UPPER(column_name) = 'ID_PUESTO'
       GROUP BY owner, table_name
       ORDER BY 1, 2`);
    console.log('Tables with ID_PUESTO:');
    for (const row of r.rows) console.log(`  ${row[0]}.${row[1]}`);

    // Look for EO_* tables people_one can see
    const eo = await conn.execute(`
      SELECT owner, table_name FROM all_tables
       WHERE UPPER(table_name) LIKE 'EO_%'
         AND owner = 'INFOCENT'
       ORDER BY table_name`);
    console.log('INFOCENT.EO_* tables:');
    for (const row of eo.rows) console.log(`  ${row[0]}.${row[1]}`);

    // Search comments
    const comments = await conn.execute(`
      SELECT owner, table_name, comments
        FROM all_tab_comments
       WHERE owner = 'INFOCENT'
         AND (UPPER(comments) LIKE '%PUESTO%'
           OR UPPER(table_name) LIKE '%PUESTO%')
       ORDER BY table_name`);
    console.log('Comments mentioning puesto:');
    for (const row of comments.rows) {
      console.log(`  ${row[0]}.${row[1]} :: ${row[2]}`);
    }

    // Columns matching API.docx puesto signature pieces
    const match = await conn.execute(`
      SELECT t.owner, t.table_name,
             SUM(CASE WHEN UPPER(c.column_name)='ID_EMPRESA' THEN 1 ELSE 0 END) AS has_emp,
             SUM(CASE WHEN UPPER(c.column_name)='ID_UNIDAD' THEN 1 ELSE 0 END) AS has_uni,
             SUM(CASE WHEN UPPER(c.column_name)='ID_CARGO' THEN 1 ELSE 0 END) AS has_car,
             SUM(CASE WHEN UPPER(c.column_name)='NOMBRE' THEN 1 ELSE 0 END) AS has_nom,
             SUM(CASE WHEN UPPER(c.column_name)='DESCRIP' THEN 1 ELSE 0 END) AS has_des
        FROM all_tables t
        JOIN all_tab_columns c
          ON c.owner = t.owner AND c.table_name = t.table_name
       WHERE t.owner = 'INFOCENT'
       GROUP BY t.owner, t.table_name
      HAVING SUM(CASE WHEN UPPER(c.column_name)='ID_EMPRESA' THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN UPPER(c.column_name)='ID_UNIDAD' THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN UPPER(c.column_name)='NOMBRE' THEN 1 ELSE 0 END) > 0
       ORDER BY 1, 2`);
    console.log('INFOCENT tables with ID_EMPRESA+ID_UNIDAD+NOMBRE:');
    for (const row of match.rows) console.log(`  ${row.join(' | ')}`);
  } finally {
    await conn.close();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
