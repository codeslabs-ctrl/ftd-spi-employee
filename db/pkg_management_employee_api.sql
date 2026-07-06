--------------------------------------------------------------------------------
-- PKG_MANAGEMENT_EMPLOYEE — procedimientos del FTD SPI Employee API
-- Esquema: CORSOX | BD: SPI (espejo VE) | Oracle 12.1.0.2
-- Contrato estándar FTD: I_JSON CLOB -> O_JSON CLOB / O_COD / O_MESSAGE
--
-- COMPATIBILIDAD 12.1.0.2:
--   * JSON_OBJECT / JSON_ARRAYAGG con RETURNING CLOB NO existe (llegó en 12.2).
--     -> el JSON de salida se arma a mano con FN_JSON_ESCAPE / FN_JSON_PAIR + DBMS_LOB.
--   * JSON_TABLE SÍ está soportado (se usa para parsear la entrada).
--   * OFFSET/FETCH SÍ está soportado (row limiting desde 12.1).
--
-- IDENTIFICADOR (EO_PERSONA.ID): no hay secuencia. Se obtiene de la tabla
--   INFOCENT.SPI_KEY (name_key = 'EOPERSONA') incrementando current_key.
--
-- AJUSTAR ANTES DE COMPILAR:
--   * Verificar valores de PKG_GLOBAL_CONSTANTS (éxito / sin registros) y alinear
--     SUCCESS_CODE / NO_RECORDS_CODE en src/employees/employees.repository.ts.
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE CORSOX.PKG_MANAGEMENT_EMPLOYEE AS

  PROCEDURE PRC_GET_EMPLOYEE(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_MERGE_EMPLOYEE(I_JSON    IN CLOB,
                               O_COD     OUT VARCHAR2,
                               O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_DELETE_EMPLOYEE(I_JSON    IN CLOB,
                                O_COD     OUT VARCHAR2,
                                O_MESSAGE OUT VARCHAR2);

END PKG_MANAGEMENT_EMPLOYEE;
/

CREATE OR REPLACE PACKAGE BODY CORSOX.PKG_MANAGEMENT_EMPLOYEE AS

  -- Nombre de la llave en INFOCENT.SPI_KEY para EO_PERSONA.ID
  GC_KEY_NAME CONSTANT VARCHAR2(30) := 'EOPERSONA';

  /*=========================================================================
   [FN_JSON_ESCAPE] - Escapa caracteres especiales para JSON válido.
   (12.1.0.2: JSON_OBJECT/JSON_ARRAYAGG solo soportan RETURNING VARCHAR2.)
  ==========================================================================*/
  FUNCTION FN_JSON_ESCAPE(P_VAL IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    IF P_VAL IS NULL THEN
      RETURN NULL;
    END IF;
    RETURN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
             P_VAL, '\', '\\'), '"', '\"'),
             CHR(10), '\n'), CHR(13), '\r'), CHR(9), '\t');
  END FN_JSON_ESCAPE;

  /*=========================================================================
   [FN_JSON_PAIR] - Devuelve "key":"value" o "key":null.
  ==========================================================================*/
  FUNCTION FN_JSON_PAIR(P_KEY IN VARCHAR2, P_VAL IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    IF P_VAL IS NULL THEN
      RETURN '"' || P_KEY || '":null';
    ELSE
      RETURN '"' || P_KEY || '":"' || FN_JSON_ESCAPE(P_VAL) || '"';
    END IF;
  END FN_JSON_PAIR;

  /*=========================================================================
   [FN_NEXT_KEY] - Siguiente ID de EO_PERSONA desde INFOCENT.SPI_KEY.
   FOR UPDATE bloquea la fila para evitar carreras entre sesiones.
  ==========================================================================*/
  FUNCTION FN_NEXT_KEY RETURN NUMBER IS
    V_KEY NUMBER;
  BEGIN
    SELECT CURRENT_KEY INTO V_KEY
      FROM INFOCENT.SPI_KEY
     WHERE NAME_KEY = GC_KEY_NAME
       FOR UPDATE;
    V_KEY := V_KEY + 1;
    UPDATE INFOCENT.SPI_KEY SET CURRENT_KEY = V_KEY WHERE NAME_KEY = GC_KEY_NAME;
    RETURN V_KEY;
  END FN_NEXT_KEY;

  /*=========================================================================
   [PRC_GET_EMPLOYEE]
   Arma el CLOB manualmente (sin JSON_OBJECT/JSON_ARRAYAGG RETURNING CLOB).
  ==========================================================================*/
  PROCEDURE PRC_GET_EMPLOYEE(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2) IS
    V_ID_NUMBER VARCHAR2(20);
    V_PAGE      NUMBER;
    V_SIZE      NUMBER;
    V_ARRAY     CLOB;
    V_ROW       VARCHAR2(4000);
    V_COUNT     PLS_INTEGER := 0;
  BEGIN

    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    SELECT ID_NUMBER, NVL(PG, 1), NVL(SZ, 20)
      INTO V_ID_NUMBER, V_PAGE, V_SIZE
      FROM JSON_TABLE(I_JSON,
                      '$'
                      COLUMNS(ID_NUMBER VARCHAR2(20) PATH '$.idNumber',
                              PG NUMBER PATH '$.page',
                              SZ NUMBER PATH '$.size'));

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT P.*
                FROM INFOCENT.EO_PERSONA P
               WHERE (V_ID_NUMBER IS NULL OR P.NUM_IDEN = V_ID_NUMBER)
               ORDER BY P.NUM_IDEN
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR('idNumber', R.NUM_IDEN) || ','
               || FN_JSON_PAIR('idType', R.ID_TIPO_IDEN) || ','
               || FN_JSON_PAIR('nationality', R.NACIONAL) || ','
               || FN_JSON_PAIR('passport', R.PASAPORTE) || ','
               || FN_JSON_PAIR('firstName', R.NOMBRE1) || ','
               || FN_JSON_PAIR('middleName', R.NOMBRE2) || ','
               || FN_JSON_PAIR('lastName', R.APELLIDO1) || ','
               || FN_JSON_PAIR('secondLastName', R.APELLIDO2) || ','
               || FN_JSON_PAIR('birthDate', TO_CHAR(R.FECHA_NA, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR('gender', DECODE(R.SEXO, '1', 'M', '2', 'F', R.SEXO)) || ','
               || FN_JSON_PAIR('maritalStatus', R.EDO_CIVIL) || ','
               || FN_JSON_PAIR('address', R.DIRECCION) || ','
               || FN_JSON_PAIR('city', R.CIUDAD) || ','
               || FN_JSON_PAIR('phone', R.TELEFONO1) || ','
               || FN_JSON_PAIR('mobile', R.CELULAR) || ','
               || FN_JSON_PAIR('email', R.E_MAIL1) || ','
               || FN_JSON_PAIR('active', DECODE(NVL(R.IN_REL_TRAB, 'S'), 'N', 'N', 'S'))
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
      O_JSON := '{"employees":' || V_ARRAY || '}';
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
      O_COD     := 'ORA-' || SQLCODE;
      O_MESSAGE := 'PRC_GET_EMPLOYEE - ' || SUBSTR(SQLERRM, 1, 200);
  END PRC_GET_EMPLOYEE;

  /*=========================================================================
   [PRC_MERGE_EMPLOYEE]
   12.1.0.2 + SPI_KEY: no se usa MERGE (no se puede llamar FN_NEXT_KEY, que
   hace DML, dentro del VALUES). Por cada empleado: UPDATE; si no afectó filas,
   se obtiene el ID de SPI_KEY y se hace INSERT. gender M/F -> SEXO 1/2.
  ==========================================================================*/
  PROCEDURE PRC_MERGE_EMPLOYEE(I_JSON    IN CLOB,
                               O_COD     OUT VARCHAR2,
                               O_MESSAGE OUT VARCHAR2) IS
    V_USER VARCHAR2(60) := NVL(SYS_CONTEXT('USERENV', 'SESSION_USER'), 'EMPLOYEE_API');
    V_KEY  NUMBER;
  BEGIN

    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    IF I_JSON IS NULL OR I_JSON = EMPTY_CLOB() THEN
      O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_SIN_REGISTROS;
      O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS;
      RETURN;
    END IF;

    FOR JT IN (SELECT NUM_IDEN, ID_TIPO_IDEN, NACIONAL, PASAPORTE,
                      NOMBRE1, NOMBRE2, APELLIDO1, APELLIDO2,
                      TO_DATE(FECHA_NA, 'YYYY-MM-DD') FECHA_NA,
                      DECODE(SEXO, 'M', '1', 'F', '2', SEXO) SEXO,
                      EDO_CIVIL, DIRECCION, CIUDAD, TELEFONO1, CELULAR, E_MAIL1
                 FROM JSON_TABLE(I_JSON, '$.employees[*]'
                        COLUMNS(NUM_IDEN VARCHAR2(20) PATH '$.idNumber',
                                ID_TIPO_IDEN VARCHAR2(2) PATH '$.idType',
                                NACIONAL VARCHAR2(50) PATH '$.nationality',
                                PASAPORTE VARCHAR2(10) PATH '$.passport',
                                NOMBRE1 VARCHAR2(17) PATH '$.firstName',
                                NOMBRE2 VARCHAR2(15) PATH '$.middleName',
                                APELLIDO1 VARCHAR2(17) PATH '$.lastName',
                                APELLIDO2 VARCHAR2(15) PATH '$.secondLastName',
                                FECHA_NA VARCHAR2(10) PATH '$.birthDate',
                                SEXO VARCHAR2(1) PATH '$.gender',
                                EDO_CIVIL VARCHAR2(30) PATH '$.maritalStatus',
                                DIRECCION VARCHAR2(120) PATH '$.address',
                                CIUDAD VARCHAR2(30) PATH '$.city',
                                TELEFONO1 VARCHAR2(15) PATH '$.phone',
                                CELULAR VARCHAR2(15) PATH '$.mobile',
                                E_MAIL1 VARCHAR2(60) PATH '$.email')))
    LOOP
      UPDATE INFOCENT.EO_PERSONA T
         SET T.ID_TIPO_IDEN = NVL(JT.ID_TIPO_IDEN, T.ID_TIPO_IDEN),
             T.NACIONAL     = NVL(JT.NACIONAL, T.NACIONAL),
             T.PASAPORTE    = NVL(JT.PASAPORTE, T.PASAPORTE),
             T.NOMBRE1      = NVL(JT.NOMBRE1, T.NOMBRE1),
             T.NOMBRE2      = NVL(JT.NOMBRE2, T.NOMBRE2),
             T.APELLIDO1    = NVL(JT.APELLIDO1, T.APELLIDO1),
             T.APELLIDO2    = NVL(JT.APELLIDO2, T.APELLIDO2),
             T.FECHA_NA     = NVL(JT.FECHA_NA, T.FECHA_NA),
             T.SEXO         = NVL(JT.SEXO, T.SEXO),
             T.EDO_CIVIL    = NVL(JT.EDO_CIVIL, T.EDO_CIVIL),
             T.DIRECCION    = NVL(JT.DIRECCION, T.DIRECCION),
             T.CIUDAD       = NVL(JT.CIUDAD, T.CIUDAD),
             T.TELEFONO1    = NVL(JT.TELEFONO1, T.TELEFONO1),
             T.CELULAR      = NVL(JT.CELULAR, T.CELULAR),
             T.E_MAIL1      = NVL(JT.E_MAIL1, T.E_MAIL1),
             T.USRACT       = V_USER,
             T.FECACT       = SYSDATE
       WHERE T.NUM_IDEN = JT.NUM_IDEN;

      IF SQL%ROWCOUNT = 0 THEN
        V_KEY := FN_NEXT_KEY;
        INSERT INTO INFOCENT.EO_PERSONA
          (ID, NUM_IDEN, ID_TIPO_IDEN, NACIONAL, PASAPORTE,
           NOMBRE1, NOMBRE2, APELLIDO1, APELLIDO2, FECHA_NA, SEXO,
           EDO_CIVIL, DIRECCION, CIUDAD, TELEFONO1, CELULAR, E_MAIL1,
           IN_REL_TRAB, USRCRE, FECCRE)
        VALUES
          (V_KEY, JT.NUM_IDEN, JT.ID_TIPO_IDEN, JT.NACIONAL, JT.PASAPORTE,
           JT.NOMBRE1, JT.NOMBRE2, JT.APELLIDO1, JT.APELLIDO2, JT.FECHA_NA, JT.SEXO,
           JT.EDO_CIVIL, JT.DIRECCION, JT.CIUDAD, JT.TELEFONO1, JT.CELULAR, JT.E_MAIL1,
           'S', V_USER, SYSDATE);
      END IF;
    END LOOP;

    COMMIT;

  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      O_COD     := 'ORA-' || SQLCODE;
      O_MESSAGE := 'PRC_MERGE_EMPLOYEE - ' || SUBSTR(SQLERRM, 1, 200);
  END PRC_MERGE_EMPLOYEE;

  /*=========================================================================
   [PRC_DELETE_EMPLOYEE] - Borrado lógico (IN_REL_TRAB = 'N').
  ==========================================================================*/
  PROCEDURE PRC_DELETE_EMPLOYEE(I_JSON    IN CLOB,
                                O_COD     OUT VARCHAR2,
                                O_MESSAGE OUT VARCHAR2) IS
    V_ID_NUMBER VARCHAR2(20);
    V_USER      VARCHAR2(60) := NVL(SYS_CONTEXT('USERENV', 'SESSION_USER'), 'EMPLOYEE_API');
  BEGIN

    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    SELECT ID_NUMBER INTO V_ID_NUMBER
      FROM JSON_TABLE(I_JSON, '$' COLUMNS(ID_NUMBER VARCHAR2(20) PATH '$.idNumber'));

    UPDATE INFOCENT.EO_PERSONA T
       SET T.IN_REL_TRAB = 'N', T.USRACT = V_USER, T.FECACT = SYSDATE
     WHERE T.NUM_IDEN = V_ID_NUMBER;

    IF SQL%ROWCOUNT = 0 THEN
      O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_SIN_REGISTROS;
      O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS;
    END IF;
    COMMIT;

  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_SIN_REGISTROS;
      O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS;
    WHEN OTHERS THEN
      ROLLBACK;
      O_COD     := 'ORA-' || SQLCODE;
      O_MESSAGE := 'PRC_DELETE_EMPLOYEE - ' || SUBSTR(SQLERRM, 1, 200);
  END PRC_DELETE_EMPLOYEE;

END PKG_MANAGEMENT_EMPLOYEE;
/
