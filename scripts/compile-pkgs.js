require('dotenv').config();
const fs = require('fs');
const path = require('path');
const oracledb = require('oracledb');

const FILES = [
  'pkg_management_position_api.sql',
  'pkg_management_company_api.sql',
  'pkg_management_marital_status_api.sql',
  'pkg_management_job_post_api.sql',
  'pkg_management_org_unit_api.sql',
];

function splitStatements(sql) {
  // Split on bare "/" lines (SQL*Plus style), keep PL/SQL bodies intact.
  return sql
    .split(/\r?\n/)
    .reduce(
      (acc, line) => {
        if (/^\s*\/\s*$/.test(line)) {
          acc.push('');
          return acc;
        }
        acc[acc.length - 1] += line + '\n';
        return acc;
      },
      [''],
    )
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--') || s.includes('CREATE'));
}

async function showErrors(conn, name) {
  const r = await conn.execute(
    `SELECT line, position, text FROM user_errors
      WHERE name = UPPER(:n) ORDER BY sequence`,
    { n: name },
  );
  if (!r.rows.length) {
    console.log(`  OK (no user_errors for ${name})`);
    return;
  }
  console.log(`  ERRORS for ${name}:`);
  for (const row of r.rows) {
    console.log(`    L${row[0]}:${row[1]} ${row[2]}`);
  }
}

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.DB_VE_USER,
    password: process.env.DB_VE_PASSWORD,
    connectString: process.env.DB_VE_CONNECT_STRING,
  });
  try {
    const consts = await conn.execute(
      `SELECT object_name, object_type, status FROM all_objects
        WHERE UPPER(object_name)='PKG_GLOBAL_CONSTANTS'
        ORDER BY 1,2`,
    );
    console.log('PKG_GLOBAL_CONSTANTS:');
    for (const row of consts.rows) console.log(`  ${row.join(' | ')}`);

    for (const file of FILES) {
      const full = path.join(__dirname, '..', 'db', file);
      console.log('\n===', file, '===');
      const sql = fs.readFileSync(full, 'utf8');
      const parts = sql
        .split(/\r?\n\/\s*\r?\n/)
        .map((s) => {
          const idx = s.search(/CREATE\s+OR\s+REPLACE/i);
          return idx >= 0 ? s.slice(idx).trim() : '';
        })
        .filter(Boolean);
      for (const stmt of parts) {
        const kind = /PACKAGE\s+BODY/i.test(stmt) ? 'BODY' : 'SPEC';
        const m = stmt.match(/PACKAGE(?:\s+BODY)?\s+(\w+)/i);
        const name = m ? m[1] : '?';
        try {
          await conn.execute(stmt);
          console.log(`  compiled ${kind} ${name}`);
        } catch (e) {
          console.log(`  FAIL ${kind} ${name}: ${e.message}`);
        }
        if (name !== '?') await showErrors(conn, name);
      }
    }
  } finally {
    await conn.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
