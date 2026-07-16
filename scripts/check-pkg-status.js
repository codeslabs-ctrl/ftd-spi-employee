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
      SELECT object_name, object_type, status
        FROM user_objects
       WHERE object_name LIKE 'PKG_MANAGEMENT_%'
       ORDER BY object_name, object_type`);
    for (const row of r.rows) console.log(row.join(' | '));

    // Smoke call company list
    const result = await conn.execute(
      `BEGIN
         pkg_management_company.prc_get_company(
           :i, :o_json, :o_cod, :o_msg);
       END;`,
      {
        i: { val: JSON.stringify({ page: 1, size: 5 }), type: oracledb.STRING },
        o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB },
        o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32 },
        o_msg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 400 },
      },
    );
    console.log('company call:', result.outBinds.o_cod, result.outBinds.o_msg);
    if (result.outBinds.o_json) {
      const lob = result.outBinds.o_json;
      const text = await lob.getData();
      console.log('company json sample:', String(text).slice(0, 200));
    }

    const pos = await conn.execute(
      `BEGIN
         pkg_management_position.prc_get_position(
           :i, :o_json, :o_cod, :o_msg);
       END;`,
      {
        i: { val: JSON.stringify({ page: 1, size: 3 }), type: oracledb.STRING },
        o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB },
        o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32 },
        o_msg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 400 },
      },
    );
    console.log('position call:', pos.outBinds.o_cod, pos.outBinds.o_msg);

    const ms = await conn.execute(
      `BEGIN
         pkg_management_marital_status.prc_get_marital_status(
           :i, :o_json, :o_cod, :o_msg);
       END;`,
      {
        i: { val: '{}', type: oracledb.STRING },
        o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB },
        o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32 },
        o_msg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 400 },
      },
    );
    console.log('marital call:', ms.outBinds.o_cod, ms.outBinds.o_msg);
    if (ms.outBinds.o_json) {
      console.log(
        'marital json:',
        String(await ms.outBinds.o_json.getData()).slice(0, 200),
      );
    }

    const ou = await conn.execute(
      `BEGIN
         pkg_management_org_unit.prc_get_org_unit(
           :i, :o_json, :o_cod, :o_msg);
       END;`,
      {
        i: { val: JSON.stringify({ page: 1, size: 2 }), type: oracledb.STRING },
        o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB },
        o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32 },
        o_msg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 400 },
      },
    );
    console.log('org-unit call:', ou.outBinds.o_cod, ou.outBinds.o_msg);

    const jp = await conn.execute(
      `BEGIN
         pkg_management_job_post.prc_get_job_post(
           :i, :o_json, :o_cod, :o_msg);
       END;`,
      {
        i: { val: JSON.stringify({ page: 1, size: 2 }), type: oracledb.STRING },
        o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB },
        o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32 },
        o_msg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 400 },
      },
    );
    console.log('job-post call:', jp.outBinds.o_cod, jp.outBinds.o_msg);
  } finally {
    await conn.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
