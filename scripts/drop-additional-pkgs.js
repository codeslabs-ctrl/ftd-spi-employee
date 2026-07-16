require('dotenv').config();
const oracledb = require('oracledb');

const PKGS = [
  'PKG_MANAGEMENT_POSITION',
  'PKG_MANAGEMENT_COMPANY',
  'PKG_MANAGEMENT_MARITAL_STATUS',
  'PKG_MANAGEMENT_JOB_POST',
  'PKG_MANAGEMENT_ORG_UNIT',
];

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.DB_VE_USER,
    password: process.env.DB_VE_PASSWORD,
    connectString: process.env.DB_VE_CONNECT_STRING,
  });
  try {
    for (const p of PKGS) {
      try {
        await conn.execute(`DROP PACKAGE ${p}`);
        console.log('DROPPED', p);
      } catch (e) {
        console.log('FAIL', p, e.message);
      }
    }
    const r = await conn.execute(`
      SELECT object_name, object_type, status
        FROM user_objects
       WHERE object_name LIKE 'PKG_MANAGEMENT_%'
       ORDER BY 1, 2`);
    console.log('REMAINING:');
    for (const row of r.rows) console.log(' ', row.join(' | '));
  } finally {
    await conn.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
