import * as oracledb from 'oracledb';

export interface OraclePkgResult {
  json: string | null;
  cod: string;
  message: string;
}

export interface CallOraclePkgOptions {
  packageName: string;
  procedure: string;
  inJson: Record<string, unknown>;
  withOutJson: boolean;
  callTimeoutMs?: number;
}

async function readLob(value: unknown): Promise<string | null> {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return (value as oracledb.Lob).getData() as Promise<string>;
}

export async function withOracleConnection<T>(
  pool: oracledb.Pool,
  fn: (conn: oracledb.Connection) => Promise<T>,
  mapError: (e: unknown) => Error = (e) =>
    e instanceof Error ? e : new Error(String(e)),
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    return await fn(conn);
  } catch (e) {
    throw mapError(e);
  } finally {
    await conn.close();
  }
}

export async function callOraclePkg(
  conn: oracledb.Connection,
  options: CallOraclePkgOptions,
): Promise<OraclePkgResult> {
  const { packageName, procedure, inJson, withOutJson, callTimeoutMs } =
    options;
  const outJsonArg = withOutJson ? 'o_json => :o_json, ' : '';
  const binds: oracledb.BindParameters = {
    i_json: JSON.stringify(inJson),
    o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
    o_message: {
      dir: oracledb.BIND_OUT,
      type: oracledb.STRING,
      maxSize: 4000,
    },
    ...(withOutJson
      ? { o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB } }
      : {}),
  };
  const executeOpts: oracledb.ExecuteOptions & { callTimeout?: number } = {
    autoCommit: true,
  };
  if (callTimeoutMs != null && callTimeoutMs > 0) {
    executeOpts.callTimeout = callTimeoutMs;
  }
  const result = await conn.execute(
    `BEGIN ${packageName}.${procedure}(i_json => :i_json, ${outJsonArg}o_cod => :o_cod, o_message => :o_message); END;`,
    binds,
    executeOpts,
  );
  const out = result.outBinds as {
    o_json?: unknown;
    o_cod: string;
    o_message: string;
  };
  return {
    json: withOutJson ? await readLob(out.o_json) : null,
    cod: String(out.o_cod),
    message: out.o_message,
  };
}
