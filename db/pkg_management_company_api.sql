--------------------------------------------------------------------------------
-- PKG_MANAGEMENT_COMPANY — Empresas (company)
-- Esquema destino: people_one | tabla confirmada QA: INFOCENT.EO_EMPRESA
-- Contrato FTD: I_JSON CLOB -> O_JSON / O_COD / O_MESSAGE
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_MANAGEMENT_COMPANY AS

  PROCEDURE PRC_GET_COMPANY(I_JSON    IN CLOB,
                            O_JSON    OUT CLOB,
                            O_COD     OUT VARCHAR2,
                            O_MESSAGE OUT VARCHAR2);

END PKG_MANAGEMENT_COMPANY;
/

CREATE OR REPLACE PACKAGE BODY PKG_MANAGEMENT_COMPANY AS

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

  PROCEDURE PRC_GET_COMPANY(I_JSON    IN CLOB,
                            O_JSON    OUT CLOB,
                            O_COD     OUT VARCHAR2,
                            O_MESSAGE OUT VARCHAR2) IS
    V_ID    VARCHAR2(4);
    V_PAGE  NUMBER := 1;
    V_SIZE  NUMBER := 20;
    V_ARRAY CLOB;
    V_ROW   VARCHAR2(32767);
    V_COUNT PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    IF I_JSON IS NOT NULL AND DBMS_LOB.GETLENGTH(I_JSON) > 0 THEN
      BEGIN
        SELECT ID, NVL(PG, 1), NVL(SZ, 20)
          INTO V_ID, V_PAGE, V_SIZE
          FROM JSON_TABLE(I_JSON,
                          '$'
                          COLUMNS(ID VARCHAR2(4) PATH '$.id',
                                  PG NUMBER PATH '$.page',
                                  SZ NUMBER PATH '$.size'));
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          V_ID := NULL; V_PAGE := 1; V_SIZE := 20;
      END;
    END IF;

    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT E.ID,
                     E.NOMBRE,
                     E.NOMBRE_ABREV,
                     E.SECTOR_EMP,
                     E.PUBLICA,
                     E.RIF1,
                     E.RIF2,
                     E.DIRECCION,
                     E.CIUDAD,
                     E.COD_POSTAL,
                     E.TELEFONO1,
                     E.TELEFONO2,
                     E.PAGINA_WEB,
                     E.E_MAIL
                FROM INFOCENT.EO_EMPRESA E
               WHERE (V_ID IS NULL OR E.ID = V_ID)
               ORDER BY E.ID
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN DBMS_LOB.APPEND(V_ARRAY, ','); END IF;

      V_ROW := '{'
               || FN_JSON_PAIR('id', R.ID) || ','
               || FN_JSON_PAIR('name', R.NOMBRE) || ','
               || FN_JSON_PAIR('shortName', R.NOMBRE_ABREV) || ','
               || FN_JSON_PAIR('sector', R.SECTOR_EMP) || ','
               || FN_JSON_PAIR('isPublic', R.PUBLICA) || ','
               || FN_JSON_PAIR('taxId1', R.RIF1) || ','
               || FN_JSON_PAIR('taxId2', R.RIF2) || ','
               || FN_JSON_PAIR('address', R.DIRECCION) || ','
               || FN_JSON_PAIR('city', R.CIUDAD) || ','
               || FN_JSON_PAIR('postalCode', R.COD_POSTAL) || ','
               || FN_JSON_PAIR('phone1', R.TELEFONO1) || ','
               || FN_JSON_PAIR('phone2', R.TELEFONO2) || ','
               || FN_JSON_PAIR('webPage', R.PAGINA_WEB) || ','
               || FN_JSON_PAIR('email', R.E_MAIL)
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
      O_JSON := '{"companies":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA' || SQLCODE;
      O_MESSAGE := 'PRC_GET_COMPANY - ' || SUBSTR(SQLERRM, 1, 200);
  END PRC_GET_COMPANY;

END PKG_MANAGEMENT_COMPANY;
/
