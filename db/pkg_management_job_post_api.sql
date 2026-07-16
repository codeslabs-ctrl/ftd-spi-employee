--------------------------------------------------------------------------------
-- PKG_MANAGEMENT_JOB_POST — Puestos (job-post)
-- Esquema destino: people_one | Oracle 12.1.0.2
--
-- BLOQUEADOR QA (NOMQAVE / people_one @ 2026-07-16):
--   NO existe INFOCENT.EO_PUESTO ni otra tabla con el layout del API.docx
--   (ID_EMPRESA + ID_UNIDAD + ID NUMBER + ID_CARGO + NOMBRE + DESCRIP...).
--   Solo aparece INFOCENT.TA_RELACION_PUESTO (relación empleado↔puesto),
--   que NO es el catálogo de puestos.
--
-- Este script queda listo para cuando el DBA confirme / cree la tabla.
-- Hasta entonces: el BODY no compilará (ORA-00942) o hay que apuntar
-- GC_TABLE a la tabla real.
--
-- Columnas esperadas (API.docx):
--   ID_EMPRESA VARCHAR2(4), ID_UNIDAD VARCHAR2(16), ID NUMBER(10),
--   NOMBRE VARCHAR2(40), ID_CARGO VARCHAR2(10), DESCRIP/FUNCION/RIESGO VARCHAR2(1024),
--   FECHA_INI DATE NOT NULL, FECHA_FIN DATE
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_MANAGEMENT_JOB_POST AS

  PROCEDURE PRC_GET_JOB_POST(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2);

END PKG_MANAGEMENT_JOB_POST;
/

CREATE OR REPLACE PACKAGE BODY PKG_MANAGEMENT_JOB_POST AS

  -- Cambiar aquí cuando el DBA confirme el nombre real de la tabla.
  GC_TABLE CONSTANT VARCHAR2(60) := 'INFOCENT.EO_PUESTO';

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

  PROCEDURE PRC_GET_JOB_POST(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2) IS
    V_COMPANY_ID  VARCHAR2(4);
    V_UNIT_ID     VARCHAR2(16);
    V_POSITION_ID VARCHAR2(10);
    V_ID          NUMBER;
    V_PAGE        NUMBER := 1;
    V_SIZE        NUMBER := 20;
    V_ARRAY       CLOB;
    V_ROW         VARCHAR2(32767);
    V_COUNT       PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    IF I_JSON IS NOT NULL AND DBMS_LOB.GETLENGTH(I_JSON) > 0 THEN
      BEGIN
        SELECT COMPANY_ID, UNIT_ID, POSITION_ID, ID, NVL(PG, 1), NVL(SZ, 20)
          INTO V_COMPANY_ID, V_UNIT_ID, V_POSITION_ID, V_ID, V_PAGE, V_SIZE
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
          V_COMPANY_ID := NULL; V_UNIT_ID := NULL; V_POSITION_ID := NULL;
          V_ID := NULL; V_PAGE := 1; V_SIZE := 20;
      END;
    END IF;

    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    -- Dynamic SQL evita fallo de compilación si la tabla aún no existe;
    -- en runtime devolverá ORA-00942 con mensaje claro vía O_COD/O_MESSAGE.
    DECLARE
      V_SQL   VARCHAR2(4000);
      V_CUR   SYS_REFCURSOR;
      V_CEMP  VARCHAR2(4);
      V_CUNI  VARCHAR2(16);
      V_CID   NUMBER;
      V_CNOM  VARCHAR2(40);
      V_CCAR  VARCHAR2(10);
      V_CDES  VARCHAR2(1024);
      V_CFUN  VARCHAR2(1024);
      V_FINI  DATE;
      V_FFIN  DATE;
      V_CRIE  VARCHAR2(1024);
    BEGIN
      V_SQL :=
        'SELECT P.ID_EMPRESA, P.ID_UNIDAD, P.ID, P.NOMBRE, P.ID_CARGO,' ||
        '       P.DESCRIP, P.FUNCION, P.FECHA_INI, P.FECHA_FIN, P.RIESGO' ||
        '  FROM ' || GC_TABLE || ' P' ||
        ' WHERE (:companyId IS NULL OR P.ID_EMPRESA = :companyId)' ||
        '   AND (:unitId IS NULL OR P.ID_UNIDAD = :unitId)' ||
        '   AND (:positionId IS NULL OR P.ID_CARGO = :positionId)' ||
        '   AND (:id IS NULL OR P.ID = :id)' ||
        ' ORDER BY P.ID_EMPRESA, P.ID_UNIDAD, P.ID' ||
        ' OFFSET (:page - 1) * :pageSize ROWS FETCH NEXT :pageSize ROWS ONLY';

      OPEN V_CUR FOR V_SQL
        USING V_COMPANY_ID, V_COMPANY_ID,
              V_UNIT_ID, V_UNIT_ID,
              V_POSITION_ID, V_POSITION_ID,
              V_ID, V_ID,
              V_PAGE, V_SIZE, V_SIZE;

      LOOP
        FETCH V_CUR INTO V_CEMP, V_CUNI, V_CID, V_CNOM, V_CCAR,
                         V_CDES, V_CFUN, V_FINI, V_FFIN, V_CRIE;
        EXIT WHEN V_CUR%NOTFOUND;

        IF V_COUNT > 0 THEN DBMS_LOB.APPEND(V_ARRAY, ','); END IF;

        V_ROW := '{'
                 || FN_JSON_PAIR('companyId', V_CEMP) || ','
                 || FN_JSON_PAIR('unitId', V_CUNI) || ','
                 || FN_JSON_PAIR('id', TO_CHAR(V_CID)) || ','
                 || FN_JSON_PAIR('name', V_CNOM) || ','
                 || FN_JSON_PAIR('positionId', V_CCAR) || ','
                 || FN_JSON_PAIR('description', V_CDES) || ','
                 || FN_JSON_PAIR('functions', V_CFUN) || ','
                 || FN_JSON_PAIR('startDate', TO_CHAR(V_FINI, 'YYYY-MM-DD')) || ','
                 || FN_JSON_PAIR('endDate', TO_CHAR(V_FFIN, 'YYYY-MM-DD')) || ','
                 || FN_JSON_PAIR('risk', V_CRIE)
                 || '}';

        DBMS_LOB.APPEND(V_ARRAY, V_ROW);
        V_COUNT := V_COUNT + 1;
      END LOOP;
      CLOSE V_CUR;
    END;

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
    WHEN OTHERS THEN
      IF DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA' || SQLCODE;
      O_MESSAGE := 'PRC_GET_JOB_POST - ' || SUBSTR(SQLERRM, 1, 200)
                   || ' (tabla esperada: ' || GC_TABLE || ')';
  END PRC_GET_JOB_POST;

END PKG_MANAGEMENT_JOB_POST;
/
