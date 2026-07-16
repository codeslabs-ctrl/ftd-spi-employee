require('dotenv').config();
const oracledb = require('oracledb');

async function main() {
  const user = process.env.DB_VE_USER;
  const password = process.env.DB_VE_PASSWORD;
  const connectString = process.env.DB_VE_CONNECT_STRING;
  if (!user || !password || !connectString) {
    console.log('NO_DB_CREDS');
    return;
  }
  console.log('Connecting as', user, '@', connectString);
  let conn;
  try {
    conn = await oracledb.getConnection({ user, password, connectString });
    const tables = await conn.execute(`
      SELECT owner, table_name FROM all_tables
       WHERE UPPER(table_name) IN (
         'EO_CARGO','EO_CARGOS','CARGO','CARGOS',
         'EO_EMPRESA','EO_ESTADO_CIVIL','ESTADO_CIVIL',
         'EO_PUESTO','EO_PUESTOS','PUESTO','PUESTOS',
         'EO_UNIDAD','EO_UNIDADES','UNIDAD','UNIDADES','NMT002'
       )
       ORDER BY owner, table_name`);
    console.log('TABLES:');
    for (const row of tables.rows) console.log(`  ${row[0]}.${row[1]}`);

    for (const t of [
      'EO_CARGO',
      'EO_EMPRESA',
      'EO_ESTADO_CIVIL',
      'EO_PUESTO',
      'EO_UNIDAD',
    ]) {
      const cols = await conn.execute(
        `SELECT owner, column_name, data_type, data_length, data_precision, nullable
           FROM all_tab_columns
          WHERE UPPER(table_name) = :t
          ORDER BY owner, column_id`,
        { t },
      );
      if (!cols.rows.length) {
        console.log(`--- NO COLS for ${t} ---`);
        continue;
      }
      console.log(`--- COLS ${t} ---`);
      for (const row of cols.rows) console.log(`  ${row.join(' | ')}`);
    }
  } catch (e) {
    console.error('ORACLE_ERR', e.message);
  } finally {
    if (conn) await conn.close();
  }
}

main();
