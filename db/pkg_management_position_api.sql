--------------------------------------------------------------------------------
-- PKG_MANAGEMENT_POSITION — Cargos (position)
-- Esquema destino: people_one | tablas: INFOCENT | Oracle 12.1.0.2
-- Contrato FTD: I_JSON CLOB -> O_JSON? / O_COD / O_MESSAGE
--
-- Tabla confirmada en QA (NOMQAVE): INFOCENT.EO_CARGO
--   ID_EMPRESA VARCHAR2(4), ID VARCHAR2(10), NOMBRE VARCHAR2(50),
--   ID_CLASIFICA/ID_CARGO_SUP VARCHAR2(10), DESCRIP/FUNCION/PROPOSITO/RIESGO VARCHAR2(1024)
--
-- Nota 12.1: V_ROW usa VARCHAR2(32767) porque DESCRIP+FUNCION+PROPOSITO+RIESGO
--   no caben en VARCHAR2(4000).
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_MANAGEMENT_POSITION AS

  PROCEDURE PRC_GET_POSITION(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_MERGE_POSITION(I_JSON    IN CLOB,
                               O_COD     OUT VARCHAR2,
                               O_MESSAGE OUT VARCHAR2);

END PKG_MANAGEMENT_POSITION;
/

CREATE OR REPLACE PACKAGE BODY PKG_MANAGEMENT_POSITION AS

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
                             O_ID         OUT VARCHAR2,
                             O_PAGE       OUT NUMBER,
                             O_SIZE       OUT NUMBER) IS
  BEGIN
    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_COMPANY_ID := NULL;
      O_ID         := NULL;
      O_PAGE       := 1;
      O_SIZE       := 20;
      RETURN;
    END IF;

    SELECT COMPANY_ID, ID, NVL(PG, 1), NVL(SZ, 20)
      INTO O_COMPANY_ID, O_ID, O_PAGE, O_SIZE
      FROM JSON_TABLE(I_JSON,
                      '$'
                      COLUMNS(COMPANY_ID VARCHAR2(4) PATH '$.companyId',
                              ID VARCHAR2(10) PATH '$.id',
                              PG NUMBER PATH '$.page',
                              SZ NUMBER PATH '$.size'));
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COMPANY_ID := NULL;
      O_ID         := NULL;
      O_PAGE       := 1;
      O_SIZE       := 20;
  END PRC_PARSE_FILTER;

  PROCEDURE PRC_GET_POSITION(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2) IS
    V_COMPANY_ID VARCHAR2(4);
    V_ID         VARCHAR2(10);
    V_PAGE       NUMBER;
    V_SIZE       NUMBER;
    V_ARRAY      CLOB;
    V_ROW        VARCHAR2(32767);
    V_COUNT      PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_FILTER(I_JSON, V_COMPANY_ID, V_ID, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT C.ID_EMPRESA,
                     C.ID,
                     C.NOMBRE,
                     C.ID_CLASIFICA,
                     C.ID_CARGO_SUP,
                     C.DESCRIP,
                     C.FUNCION,
                     C.PROPOSITO,
                     C.RIESGO
                FROM INFOCENT.EO_CARGO C
               WHERE (V_COMPANY_ID IS NULL OR C.ID_EMPRESA = V_COMPANY_ID)
                 AND (V_ID IS NULL OR C.ID = V_ID)
               ORDER BY C.ID_EMPRESA, C.ID
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR('companyId', R.ID_EMPRESA) || ','
               || FN_JSON_PAIR('id', R.ID) || ','
               || FN_JSON_PAIR('name', R.NOMBRE) || ','
               || FN_JSON_PAIR('classificationId', R.ID_CLASIFICA) || ','
               || FN_JSON_PAIR('parentPositionId', R.ID_CARGO_SUP) || ','
               || FN_JSON_PAIR('description', R.DESCRIP) || ','
               || FN_JSON_PAIR('functions', R.FUNCION) || ','
               || FN_JSON_PAIR('purpose', R.PROPOSITO) || ','
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
      O_JSON := '{"positions":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA' || SQLCODE;
      O_MESSAGE := 'PRC_GET_POSITION - ' || SUBSTR(SQLERRM, 1, 200);
  END PRC_GET_POSITION;

  PROCEDURE PRC_MERGE_POSITION(I_JSON    IN CLOB,
                               O_COD     OUT VARCHAR2,
                               O_MESSAGE OUT VARCHAR2) IS
    V_USER VARCHAR2(60) := NVL(SYS_CONTEXT('USERENV', 'SESSION_USER'), 'POSITION_API');
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_SIN_REGISTROS;
      O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS;
      RETURN;
    END IF;

    FOR JT IN (SELECT COMPANY_ID,
                      ID,
                      NAME,
                      CLASSIFICATION_ID,
                      PARENT_POSITION_ID,
                      DESCRIPTION,
                      FUNCTIONS,
                      PURPOSE,
                      RISK
                 FROM JSON_TABLE(I_JSON, '$.positions[*]'
                      COLUMNS(COMPANY_ID VARCHAR2(4) PATH '$.companyId',
                              ID VARCHAR2(10) PATH '$.id',
                              NAME VARCHAR2(50) PATH '$.name',
                              CLASSIFICATION_ID VARCHAR2(10) PATH '$.classificationId',
                              PARENT_POSITION_ID VARCHAR2(10) PATH '$.parentPositionId',
                              DESCRIPTION VARCHAR2(1024) PATH '$.description',
                              FUNCTIONS VARCHAR2(1024) PATH '$.functions',
                              PURPOSE VARCHAR2(1024) PATH '$.purpose',
                              RISK VARCHAR2(1024) PATH '$.risk')))
    LOOP
      IF JT.COMPANY_ID IS NULL OR JT.ID IS NULL OR JT.NAME IS NULL THEN
        RAISE_APPLICATION_ERROR(-20001, 'companyId, id and name are required');
      END IF;

      UPDATE INFOCENT.EO_CARGO C
         SET C.NOMBRE       = JT.NAME,
             C.ID_CLASIFICA = JT.CLASSIFICATION_ID,
             C.ID_CARGO_SUP = JT.PARENT_POSITION_ID,
             C.DESCRIP      = JT.DESCRIPTION,
             C.FUNCION      = JT.FUNCTIONS,
             C.PROPOSITO    = JT.PURPOSE,
             C.RIESGO       = JT.RISK,
             C.USRACT       = V_USER,
             C.FECACT       = SYSDATE
       WHERE C.ID_EMPRESA = JT.COMPANY_ID
         AND C.ID = JT.ID;

      IF SQL%ROWCOUNT = 0 THEN
        INSERT INTO INFOCENT.EO_CARGO (
          ID_EMPRESA, ID, NOMBRE, ID_CLASIFICA, ID_CARGO_SUP,
          DESCRIP, FUNCION, PROPOSITO, RIESGO,
          USRCRE, FECCRE, USRACT, FECACT
        ) VALUES (
          JT.COMPANY_ID, JT.ID, JT.NAME, JT.CLASSIFICATION_ID, JT.PARENT_POSITION_ID,
          JT.DESCRIPTION, JT.FUNCTIONS, JT.PURPOSE, JT.RISK,
          V_USER, SYSDATE, V_USER, SYSDATE
        );
      END IF;
    END LOOP;

  EXCEPTION
    WHEN OTHERS THEN
      O_COD     := 'ORA' || SQLCODE;
      O_MESSAGE := 'PRC_MERGE_POSITION - ' || SUBSTR(SQLERRM, 1, 200);
  END PRC_MERGE_POSITION;

END PKG_MANAGEMENT_POSITION;
/
