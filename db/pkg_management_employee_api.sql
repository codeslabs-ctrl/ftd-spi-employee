--------------------------------------------------------------------------------
-- PKG_MANAGEMENT_EMPLOYEE — procedimientos del FTD SPI Employee API
-- Esquema: CORSOX | BD: SPI (espejo VE)
-- Contrato estándar FTD: I_JSON CLOB -> O_JSON CLOB / O_COD / O_MESSAGE
--
-- AJUSTAR ANTES DE COMPILAR:
--   1. GC_SEQ: nombre real de la secuencia para INFOCENT.EO_PERSONA.ID
--   2. Verificar valores de UTILITY.PKG_GLOBAL_CONSTANTS (exito / sin registros)
--      y alinear SUCCESS_CODE / NO_RECORDS_CODE en employees.repository.ts
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE CORSOX.PKG_MANAGEMENT_EMPLOYEE AS

  /*=========================================================================
   [PRC_GET_EMPLOYEE]<BR>
    <BR>
    <B>DESCRIPTION:</B> DEVUELVE LOS DATOS BASICOS DE EMPLEADOS (EO_PERSONA)
    <BR/>
    %AUTHOR                              CRODRIGUEZ
    %VERSION                             1.0
    %PARAM  I_JSON                      JSON CON PARAMETROS DE ENTRADA:
                                        {"idNumber":"..."} O {"page":N,"size":N}
    %RETURN O_JSON                      JSON {"employees":[...]}
    %RETURN O_COD                       CODIGO DE RESPUESTA.
    %RETURN O_MESSAGE                   MENSAJE DE RESPUESTA.
  ==========================================================================*/
  PROCEDURE PRC_GET_EMPLOYEE(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2);

  /*=========================================================================
   [PRC_MERGE_EMPLOYEE]<BR>
    <BR>
    <B>DESCRIPTION:</B> INSERTA/ACTUALIZA EMPLEADOS EN EO_PERSONA (MERGE POR NUM_IDEN)
    <BR/>
    %AUTHOR                              CRODRIGUEZ
    %VERSION                             1.0
    %PARAM  I_JSON                      JSON {"employees":[{...}]}
    %RETURN O_COD                       CODIGO DE RESPUESTA.
    %RETURN O_MESSAGE                   MENSAJE DE RESPUESTA.
  ==========================================================================*/
  PROCEDURE PRC_MERGE_EMPLOYEE(I_JSON    IN CLOB,
                               O_COD     OUT VARCHAR2,
                               O_MESSAGE OUT VARCHAR2);

  /*=========================================================================
   [PRC_DELETE_EMPLOYEE]<BR>
    <BR>
    <B>DESCRIPTION:</B> BORRADO LOGICO DEL EMPLEADO (IN_REL_TRAB = 'N')
    <BR/>
    %AUTHOR                              CRODRIGUEZ
    %VERSION                             1.0
    %PARAM  I_JSON                      JSON {"idNumber":"..."}
    %RETURN O_COD                       CODIGO DE RESPUESTA.
    %RETURN O_MESSAGE                   MENSAJE DE RESPUESTA.
  ==========================================================================*/
  PROCEDURE PRC_DELETE_EMPLOYEE(I_JSON    IN CLOB,
                                O_COD     OUT VARCHAR2,
                                O_MESSAGE OUT VARCHAR2);

END PKG_MANAGEMENT_EMPLOYEE;
/

CREATE OR REPLACE PACKAGE BODY CORSOX.PKG_MANAGEMENT_EMPLOYEE AS

  -- // AJUSTAR: secuencia real para EO_PERSONA.ID
  GC_SEQ CONSTANT VARCHAR2(64) := 'INFOCENT.EO_PERSONA_SEQ';

  /*=========================================================================
   [PRC_GET_EMPLOYEE]
  ==========================================================================*/
  PROCEDURE PRC_GET_EMPLOYEE(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2) IS
    V_ID_NUMBER VARCHAR2(20);
    V_PAGE      NUMBER;
    V_SIZE      NUMBER;
  BEGIN

    O_MESSAGE := UTILITY.PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := UTILITY.PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    SELECT ID_NUMBER, NVL(PG, 1), NVL(SZ, 20)
      INTO V_ID_NUMBER, V_PAGE, V_SIZE
      FROM JSON_TABLE(I_JSON,
                      '$'
                      COLUMNS(ID_NUMBER VARCHAR2(20) PATH '$.idNumber',
                              PG NUMBER PATH '$.page',
                              SZ NUMBER PATH '$.size'));

    SELECT JSON_ARRAYAGG(JSON_OBJECT(KEY 'idNumber' VALUE NUM_IDEN,
                                     KEY 'idType' VALUE ID_TIPO_IDEN,
                                     KEY 'nationality' VALUE NACIONAL,
                                     KEY 'passport' VALUE PASAPORTE,
                                     KEY 'firstName' VALUE NOMBRE1,
                                     KEY 'middleName' VALUE NOMBRE2,
                                     KEY 'lastName' VALUE APELLIDO1,
                                     KEY 'secondLastName' VALUE APELLIDO2,
                                     KEY 'birthDate' VALUE
                                     TO_CHAR(FECHA_NA, 'YYYY-MM-DD'),
                                     KEY 'gender' VALUE
                                     DECODE(SEXO, '1', 'M', '2', 'F', SEXO),
                                     KEY 'maritalStatus' VALUE EDO_CIVIL,
                                     KEY 'address' VALUE DIRECCION,
                                     KEY 'city' VALUE CIUDAD,
                                     KEY 'phone' VALUE TELEFONO1,
                                     KEY 'mobile' VALUE CELULAR,
                                     KEY 'email' VALUE E_MAIL1,
                                     KEY 'active' VALUE
                                     DECODE(NVL(IN_REL_TRAB, 'S'), 'N', 'N', 'S')
                                     RETURNING CLOB) RETURNING CLOB)
      INTO O_JSON
      FROM (SELECT P.*
              FROM INFOCENT.EO_PERSONA P
             WHERE (V_ID_NUMBER IS NULL OR P.NUM_IDEN = V_ID_NUMBER)
             ORDER BY P.NUM_IDEN
            OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY);

    IF O_JSON != EMPTY_CLOB() AND O_JSON IS NOT NULL THEN
      O_JSON := '{"employees":' || O_JSON || '}';
    ELSE
      O_COD     := UTILITY.PKG_GLOBAL_CONSTANTS.GC_CODIGO_SIN_REGISTROS;
      O_MESSAGE := UTILITY.PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS;
    END IF;

    -- // MANEJO DE LAS EXCEPCIONES
    -- // ------------------------------------------------
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COD     := UTILITY.PKG_GLOBAL_CONSTANTS.GC_CODIGO_SIN_REGISTROS;
      O_MESSAGE := UTILITY.PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS;
    WHEN OTHERS THEN
      O_COD     := 'ORA-' || SQLCODE;
      O_MESSAGE := 'PRC_GET_EMPLOYEE - ' || SUBSTR(SQLERRM, 1, 200);
  END PRC_GET_EMPLOYEE;

  /*=========================================================================
   [PRC_MERGE_EMPLOYEE]
  ==========================================================================*/
  PROCEDURE PRC_MERGE_EMPLOYEE(I_JSON    IN CLOB,
                               O_COD     OUT VARCHAR2,
                               O_MESSAGE OUT VARCHAR2) IS
    V_USER VARCHAR2(60) := NVL(SYS_CONTEXT('USERENV', 'SESSION_USER'),
                               'EMPLOYEE_API');
  BEGIN

    O_MESSAGE := UTILITY.PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := UTILITY.PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    IF I_JSON != EMPTY_CLOB() AND I_JSON IS NOT NULL THEN
      MERGE INTO INFOCENT.EO_PERSONA T
      USING (SELECT NUM_IDEN,
                    ID_TIPO_IDEN,
                    NACIONAL,
                    PASAPORTE,
                    NOMBRE1,
                    NOMBRE2,
                    APELLIDO1,
                    APELLIDO2,
                    TO_DATE(FECHA_NA, 'YYYY-MM-DD') FECHA_NA,
                    DECODE(SEXO, 'M', '1', 'F', '2', SEXO) SEXO,
                    EDO_CIVIL,
                    DIRECCION,
                    CIUDAD,
                    TELEFONO1,
                    CELULAR,
                    E_MAIL1
               FROM JSON_TABLE(I_JSON,
                               '$.employees[*]'
                               COLUMNS(NUM_IDEN VARCHAR2(20) PATH '$.idNumber',
                                       ID_TIPO_IDEN VARCHAR2(2) PATH '$.idType',
                                       NACIONAL VARCHAR2(50) PATH '$.nationality',
                                       PASAPORTE VARCHAR2(10) PATH '$.passport',
                                       NOMBRE1 VARCHAR2(17) PATH '$.firstName',
                                       NOMBRE2 VARCHAR2(15) PATH '$.middleName',
                                       APELLIDO1 VARCHAR2(17) PATH '$.lastName',
                                       APELLIDO2 VARCHAR2(15) PATH
                                       '$.secondLastName',
                                       FECHA_NA VARCHAR2(10) PATH '$.birthDate',
                                       SEXO VARCHAR2(1) PATH '$.gender',
                                       EDO_CIVIL VARCHAR2(30) PATH
                                       '$.maritalStatus',
                                       DIRECCION VARCHAR2(120) PATH '$.address',
                                       CIUDAD VARCHAR2(30) PATH '$.city',
                                       TELEFONO1 VARCHAR2(15) PATH '$.phone',
                                       CELULAR VARCHAR2(15) PATH '$.mobile',
                                       E_MAIL1 VARCHAR2(60) PATH '$.email'))) JT
      ON (T.NUM_IDEN = JT.NUM_IDEN)
      WHEN MATCHED THEN
        UPDATE
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
      WHEN NOT MATCHED THEN
        INSERT
          (T.ID,
           T.NUM_IDEN,
           T.ID_TIPO_IDEN,
           T.NACIONAL,
           T.PASAPORTE,
           T.NOMBRE1,
           T.NOMBRE2,
           T.APELLIDO1,
           T.APELLIDO2,
           T.FECHA_NA,
           T.SEXO,
           T.EDO_CIVIL,
           T.DIRECCION,
           T.CIUDAD,
           T.TELEFONO1,
           T.CELULAR,
           T.E_MAIL1,
           T.IN_REL_TRAB,
           T.USRCRE,
           T.FECCRE)
        VALUES
          (INFOCENT.EO_PERSONA_SEQ.NEXTVAL, -- // AJUSTAR GC_SEQ
           JT.NUM_IDEN,
           JT.ID_TIPO_IDEN,
           JT.NACIONAL,
           JT.PASAPORTE,
           JT.NOMBRE1,
           JT.NOMBRE2,
           JT.APELLIDO1,
           JT.APELLIDO2,
           JT.FECHA_NA,
           JT.SEXO,
           JT.EDO_CIVIL,
           JT.DIRECCION,
           JT.CIUDAD,
           JT.TELEFONO1,
           JT.CELULAR,
           JT.E_MAIL1,
           'S',
           V_USER,
           SYSDATE);
      COMMIT;

    ELSE
      O_COD     := UTILITY.PKG_GLOBAL_CONSTANTS.GC_CODIGO_SIN_REGISTROS;
      O_MESSAGE := UTILITY.PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS;
    END IF;

    -- // MANEJO DE LAS EXCEPCIONES
    -- // ------------------------------------------------
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      O_COD     := 'ORA-' || SQLCODE;
      O_MESSAGE := 'PRC_MERGE_EMPLOYEE - ' || SUBSTR(SQLERRM, 1, 200);
  END PRC_MERGE_EMPLOYEE;

  /*=========================================================================
   [PRC_DELETE_EMPLOYEE]
  ==========================================================================*/
  PROCEDURE PRC_DELETE_EMPLOYEE(I_JSON    IN CLOB,
                                O_COD     OUT VARCHAR2,
                                O_MESSAGE OUT VARCHAR2) IS
    V_ID_NUMBER VARCHAR2(20);
    V_USER      VARCHAR2(60) := NVL(SYS_CONTEXT('USERENV', 'SESSION_USER'),
                                    'EMPLOYEE_API');
  BEGIN

    O_MESSAGE := UTILITY.PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := UTILITY.PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    SELECT ID_NUMBER
      INTO V_ID_NUMBER
      FROM JSON_TABLE(I_JSON,
                      '$' COLUMNS(ID_NUMBER VARCHAR2(20) PATH '$.idNumber'));

    UPDATE INFOCENT.EO_PERSONA T
       SET T.IN_REL_TRAB = 'N', T.USRACT = V_USER, T.FECACT = SYSDATE
     WHERE T.NUM_IDEN = V_ID_NUMBER;

    IF SQL%ROWCOUNT = 0 THEN
      O_COD     := UTILITY.PKG_GLOBAL_CONSTANTS.GC_CODIGO_SIN_REGISTROS;
      O_MESSAGE := UTILITY.PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS;
    END IF;
    COMMIT;

    -- // MANEJO DE LAS EXCEPCIONES
    -- // ------------------------------------------------
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COD     := UTILITY.PKG_GLOBAL_CONSTANTS.GC_CODIGO_SIN_REGISTROS;
      O_MESSAGE := UTILITY.PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS;
    WHEN OTHERS THEN
      ROLLBACK;
      O_COD     := 'ORA-' || SQLCODE;
      O_MESSAGE := 'PRC_DELETE_EMPLOYEE - ' || SUBSTR(SQLERRM, 1, 200);
  END PRC_DELETE_EMPLOYEE;

END PKG_MANAGEMENT_EMPLOYEE;
/
