--------------------------------------------------------------------------------
-- PKG_MANAGEMENT_JOB_POST — Puestos (job-post)
-- Esquema destino: people_one | tabla: INFOCENT.EO_PUESTO | Oracle 12.1.0.2
-- Contrato FTD: I_JSON CLOB -> O_JSON CLOB / O_COD / O_MESSAGE
--
-- Tabla confirmada (DESCRIBE INFOCENT.EO_PUESTO):
--   ID_EMPRESA VARCHAR2(4)  NOT NULL, ID_UNIDAD VARCHAR2(16) NOT NULL,
--   ID NUMBER(10) NOT NULL, NOMBRE VARCHAR2(40) NOT NULL,
--   ID_CARGO VARCHAR2(10) NOT NULL, DESCRIP/FUNCION/RIESGO VARCHAR2(1024),
--   FECHA_INI DATE NOT NULL, FECHA_FIN DATE,
--   USRCRE/USRACT VARCHAR2(60), FECCRE/FECACT DATE (no usadas por este API, solo lectura)
--
-- Reescrito en el mismo estilo que PKG_MANAGEMENT_POSITION (SELECT estático con
-- PRC_PARSE_FILTER + FOR loop) ahora que la tabla ya está confirmada — se retira
-- el SQL dinámico que se usaba como salvaguarda mientras no se sabía si existía.
-- Solo lectura (get/list); el API no expone create/update para este recurso.
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_MANAGEMENT_JOB_POST AS

  PROCEDURE PRC_GET_JOB_POST(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2);

END PKG_MANAGEMENT_JOB_POST;
/

CREATE OR REPLACE PACKAGE BODY PKG_MANAGEMENT_JOB_POST AS

  FUNCTION FN_JSON_ESCAPE(P_VAL IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    IF P_VAL IS NULL THEN
      RETURN NULL;
    END IF;
    RETURN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
             P_VAL, '\', '\\'), '"', '\"'),
             CHR(10), '\n'), CHR(13), '\r'), CHR(9), '\t');
  END FN_JSON_ESCAPE;

  FUNCTION FN_JSON_PAIR(P_KEY IN VARCHAR2, P_VAL IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    IF P_VAL IS NULL THEN
      RETURN '"' || P_KEY || '":null';
    ELSE
      RETURN '"' || P_KEY || '":"' || FN_JSON_ESCAPE(P_VAL) || '"';
    END IF;
  END FN_JSON_PAIR;

  PROCEDURE PRC_PARSE_FILTER(I_JSON       IN CLOB,
                             O_COMPANY_ID OUT VARCHAR2,
                             O_UNIT_ID    OUT VARCHAR2,
                             O_POSITION_ID OUT VARCHAR2,
                             O_ID         OUT NUMBER,
                             O_PAGE       OUT NUMBER,
                             O_SIZE       OUT NUMBER) IS
  BEGIN
    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_COMPANY_ID  := NULL;
      O_UNIT_ID     := NULL;
      O_POSITION_ID := NULL;
      O_ID          := NULL;
      O_PAGE        := 1;
      O_SIZE        := 20;
      RETURN;
    END IF;

    SELECT COMPANY_ID, UNIT_ID, POSITION_ID, ID, NVL(PG, 1), NVL(SZ, 20)
      INTO O_COMPANY_ID, O_UNIT_ID, O_POSITION_ID, O_ID, O_PAGE, O_SIZE
      FROM JSON_TABLE(I_JSON,
                      '$'
                      COLUMNS(COMPANY_ID VARCHAR2(4) PATH '$.companyId',
                              UNIT_ID VARCHAR2(16) PATH '$.unitId',
                              POSITION_ID VARCHAR2(10) PATH '$.positionId',
                              ID NUMBER PATH '$.id',
                              PG NUMBER PATH '$.page',
                              SZ NUMBER PATH '$.size'));
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COMPANY_ID  := NULL;
      O_UNIT_ID     := NULL;
      O_POSITION_ID := NULL;
      O_ID          := NULL;
      O_PAGE        := 1;
      O_SIZE        := 20;
  END PRC_PARSE_FILTER;

  PROCEDURE PRC_GET_JOB_POST(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2) IS
    V_COMPANY_ID  VARCHAR2(4);
    V_UNIT_ID     VARCHAR2(16);
    V_POSITION_ID VARCHAR2(10);
    V_ID          NUMBER;
    V_PAGE        NUMBER;
    V_SIZE        NUMBER;
    V_ARRAY       CLOB;
    V_ROW         VARCHAR2(32767);
    V_COUNT       PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_FILTER(I_JSON, V_COMPANY_ID, V_UNIT_ID, V_POSITION_ID,
                      V_ID, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT P.ID_EMPRESA,
                     P.ID_UNIDAD,
                     P.ID,
                     P.NOMBRE,
                     P.ID_CARGO,
                     P.DESCRIP,
                     P.FUNCION,
                     P.FECHA_INI,
                     P.FECHA_FIN,
                     P.RIESGO
                FROM INFOCENT.EO_PUESTO P
               WHERE (V_COMPANY_ID IS NULL OR P.ID_EMPRESA = V_COMPANY_ID)
                 AND (V_UNIT_ID IS NULL OR P.ID_UNIDAD = V_UNIT_ID)
                 AND (V_POSITION_ID IS NULL OR P.ID_CARGO = V_POSITION_ID)
                 AND (V_ID IS NULL OR P.ID = V_ID)
               ORDER BY P.ID_EMPRESA, P.ID_UNIDAD, P.ID
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR('companyId', R.ID_EMPRESA) || ','
               || FN_JSON_PAIR('unitId', R.ID_UNIDAD) || ','
               || FN_JSON_PAIR('id', TO_CHAR(R.ID)) || ','
               || FN_JSON_PAIR('name', R.NOMBRE) || ','
               || FN_JSON_PAIR('positionId', R.ID_CARGO) || ','
               || FN_JSON_PAIR('description', R.DESCRIP) || ','
               || FN_JSON_PAIR('functions', R.FUNCION) || ','
               || FN_JSON_PAIR('startDate', TO_CHAR(R.FECHA_INI, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR('endDate', TO_CHAR(R.FECHA_FIN, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR('risk', R.RIESGO)
               || '}';

      DBMS_LOB.APPEND(V_ARRAY, V_ROW);
      V_COUNT := V_COUNT + 1;
    END LOOP;

    DBMS_LOB.APPEND(V_ARRAY, ']');

    IF V_COUNT = 0 THEN
      O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_SIN_REGISTROS;
      O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS;
      O_JSON    := NULL;
    ELSE
      O_JSON := '{"jobPosts":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_SIN_REGISTROS;
      O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS;
    WHEN OTHERS THEN
      IF DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := PKG_GLOBAL_ERRORS.FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM, 'INFOCENT.EO_PUESTO');
  END PRC_GET_JOB_POST;

END PKG_MANAGEMENT_JOB_POST;
/
