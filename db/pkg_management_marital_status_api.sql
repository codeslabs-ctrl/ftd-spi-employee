--------------------------------------------------------------------------------
-- PKG_MANAGEMENT_MARITAL_STATUS — Estado civil
-- Esquema destino: people_one | tabla confirmada QA: INFOCENT.EO_ESTADO_CIVIL
-- ID VARCHAR2(1), NOMBRE VARCHAR2(30), CODIGO_LEY VARCHAR2(1)
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_MANAGEMENT_MARITAL_STATUS AS

  PROCEDURE PRC_GET_MARITAL_STATUS(I_JSON    IN CLOB,
                                   O_JSON    OUT CLOB,
                                   O_COD     OUT VARCHAR2,
                                   O_MESSAGE OUT VARCHAR2);

END PKG_MANAGEMENT_MARITAL_STATUS;
/

CREATE OR REPLACE PACKAGE BODY PKG_MANAGEMENT_MARITAL_STATUS AS

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

  PROCEDURE PRC_GET_MARITAL_STATUS(I_JSON    IN CLOB,
                                   O_JSON    OUT CLOB,
                                   O_COD     OUT VARCHAR2,
                                   O_MESSAGE OUT VARCHAR2) IS
    V_PAGE  NUMBER := 1;
    V_SIZE  NUMBER := 20;
    V_ARRAY CLOB;
    V_ROW   VARCHAR2(1000);
    V_COUNT PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    IF I_JSON IS NOT NULL AND DBMS_LOB.GETLENGTH(I_JSON) > 0 THEN
      BEGIN
        SELECT NVL(PG, 1), NVL(SZ, 20)
          INTO V_PAGE, V_SIZE
          FROM JSON_TABLE(I_JSON,
                          '$'
                          COLUMNS(PG NUMBER PATH '$.page',
                                  SZ NUMBER PATH '$.size'));
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          V_PAGE := 1; V_SIZE := 20;
      END;
    END IF;

    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT E.ID, E.NOMBRE, E.CODIGO_LEY
                FROM INFOCENT.EO_ESTADO_CIVIL E
               ORDER BY E.ID
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN DBMS_LOB.APPEND(V_ARRAY, ','); END IF;

      V_ROW := '{'
               || FN_JSON_PAIR('id', R.ID) || ','
               || FN_JSON_PAIR('name', R.NOMBRE) || ','
               || FN_JSON_PAIR('legalCode', R.CODIGO_LEY)
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
      O_JSON := '{"maritalStatuses":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA' || SQLCODE;
      O_MESSAGE := 'PRC_GET_MARITAL_STATUS - ' || SUBSTR(SQLERRM, 1, 200);
  END PRC_GET_MARITAL_STATUS;

END PKG_MANAGEMENT_MARITAL_STATUS;
/
