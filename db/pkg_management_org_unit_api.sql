--------------------------------------------------------------------------------
-- PKG_MANAGEMENT_ORG_UNIT — Unidades organizativas (org-unit)
-- Esquema destino: people_one | tabla confirmada QA: INFOCENT.EO_UNIDAD
-- ID_EMPRESA VARCHAR2(4), ID VARCHAR2(16), NOMBRE VARCHAR2(40),
-- FUNCIONES VARCHAR2(1024), UBICA_ADMIN VARCHAR2(16), FECHA_INI NOT NULL,
-- MAX_PUESTO NUMBER(10)
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_MANAGEMENT_ORG_UNIT AS

  PROCEDURE PRC_GET_ORG_UNIT(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2);

END PKG_MANAGEMENT_ORG_UNIT;
/

CREATE OR REPLACE PACKAGE BODY PKG_MANAGEMENT_ORG_UNIT AS

  FUNCTION FN_JSON_ESCAPE(P_VAL IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    IF P_VAL IS NULL THEN RETURN NULL; END IF;
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

  PROCEDURE PRC_GET_ORG_UNIT(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2) IS
    V_COMPANY_ID VARCHAR2(4);
    V_ID         VARCHAR2(16);
    V_PAGE       NUMBER := 1;
    V_SIZE       NUMBER := 20;
    V_ARRAY      CLOB;
    V_ROW        VARCHAR2(32767);
    V_COUNT      PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    IF I_JSON IS NOT NULL AND DBMS_LOB.GETLENGTH(I_JSON) > 0 THEN
      BEGIN
        SELECT COMPANY_ID, ID, NVL(PG, 1), NVL(SZ, 20)
          INTO V_COMPANY_ID, V_ID, V_PAGE, V_SIZE
          FROM JSON_TABLE(I_JSON,
                          '$'
                          COLUMNS(COMPANY_ID VARCHAR2(4) PATH '$.companyId',
                                  ID VARCHAR2(16) PATH '$.id',
                                  PG NUMBER PATH '$.page',
                                  SZ NUMBER PATH '$.size'));
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          V_COMPANY_ID := NULL; V_ID := NULL; V_PAGE := 1; V_SIZE := 20;
      END;
    END IF;

    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT U.ID_EMPRESA,
                     U.ID,
                     U.NOMBRE,
                     U.FUNCIONES,
                     U.UBICA_ADMIN,
                     U.FECHA_INI,
                     U.FECHA_FIN,
                     U.ID_UNIDAD_SUP,
                     U.MAX_PUESTO
                FROM INFOCENT.EO_UNIDAD U
               WHERE (V_COMPANY_ID IS NULL OR U.ID_EMPRESA = V_COMPANY_ID)
                 AND (V_ID IS NULL OR U.ID = V_ID)
               ORDER BY U.ID_EMPRESA, U.ID
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN DBMS_LOB.APPEND(V_ARRAY, ','); END IF;

      V_ROW := '{'
               || FN_JSON_PAIR('companyId', R.ID_EMPRESA) || ','
               || FN_JSON_PAIR('id', R.ID) || ','
               || FN_JSON_PAIR('name', R.NOMBRE) || ','
               || FN_JSON_PAIR('functions', R.FUNCIONES) || ','
               || FN_JSON_PAIR('adminLocation', R.UBICA_ADMIN) || ','
               || FN_JSON_PAIR('startDate', TO_CHAR(R.FECHA_INI, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR('endDate', TO_CHAR(R.FECHA_FIN, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR('parentUnitId', R.ID_UNIDAD_SUP) || ','
               || FN_JSON_PAIR('maxPosts', TO_CHAR(R.MAX_PUESTO))
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
      O_JSON := '{"orgUnits":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA' || SQLCODE;
      O_MESSAGE := 'PRC_GET_ORG_UNIT - ' || SUBSTR(SQLERRM, 1, 200);
  END PRC_GET_ORG_UNIT;

END PKG_MANAGEMENT_ORG_UNIT;
/
