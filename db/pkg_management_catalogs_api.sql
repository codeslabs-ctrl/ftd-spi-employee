--------------------------------------------------------------------------------
-- PKG_MANAGEMENT_CATALOGS — Catálogos de solo lectura (un solo paquete)
-- Esquema destino: people_one | Oracle 12.1.0.2
-- Contrato FTD: I_JSON CLOB -> O_JSON CLOB / O_COD / O_MESSAGE
--
-- MANEJO DE ERRORES EN ESPAÑOL (reutilizable): FN_GET_ERROR_MESSAGE traduce
-- los códigos Oracle más comunes (tabla no existe, sin privilegios, timeout
-- de conexión, conexión perdida) a un mensaje claro en español; cualquier
-- otro error cae a un mensaje genérico en español con el detalle técnico
-- acotado. Este helper es independiente del resto de paquetes (que siguen
-- devolviendo sus mensajes tal cual) para no romper contratos ya probados.
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_MANAGEMENT_CATALOGS AS

  PROCEDURE PRC_GET_MUNICIPALITIES(I_JSON    IN CLOB,
                                   O_JSON    OUT CLOB,
                                   O_COD     OUT VARCHAR2,
                                   O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_GET_COUNTRIES(I_JSON    IN CLOB,
                              O_JSON    OUT CLOB,
                              O_COD     OUT VARCHAR2,
                              O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_GET_PARISHES(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_GET_LOCALITIES(I_JSON    IN CLOB,
                               O_JSON    OUT CLOB,
                               O_COD     OUT VARCHAR2,
                               O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_GET_CITIES(I_JSON    IN CLOB,
                           O_JSON    OUT CLOB,
                           O_COD     OUT VARCHAR2,
                           O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_GET_STATES(I_JSON    IN CLOB,
                           O_JSON    OUT CLOB,
                           O_COD     OUT VARCHAR2,
                           O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_GET_PAYROLL_TYPES(I_JSON    IN CLOB,
                                  O_JSON    OUT CLOB,
                                  O_COD     OUT VARCHAR2,
                                  O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_GET_GROUPS(I_JSON    IN CLOB,
                           O_JSON    OUT CLOB,
                           O_COD     OUT VARCHAR2,
                           O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_GET_BRANCHES(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_GET_BANKS(I_JSON    IN CLOB,
                          O_JSON    OUT CLOB,
                          O_COD     OUT VARCHAR2,
                          O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_GET_ACCOUNT_TYPES(I_JSON    IN CLOB,
                                  O_JSON    OUT CLOB,
                                  O_COD     OUT VARCHAR2,
                                  O_MESSAGE OUT VARCHAR2);

  PROCEDURE PRC_GET_ID_TYPES(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2);

END PKG_MANAGEMENT_CATALOGS;
/

CREATE OR REPLACE PACKAGE BODY PKG_MANAGEMENT_CATALOGS AS

  /*=========================================================================
   [FN_JSON_ESCAPE] — mismo helper que el resto de paquetes FTD (12.1.0.2:
   JSON_OBJECT/JSON_ARRAYAGG RETURNING CLOB no existe).
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
   [FN_JSON_PAIR_CC] — usado por los SELECT estáticos: preserva el
   camelCase de la clave tal cual se pasa (ej. "companyId"), igual que el
   FN_JSON_PAIR de PKG_MANAGEMENT_JOB_POST / PKG_MANAGEMENT_POSITION.
  ==========================================================================*/
  FUNCTION FN_JSON_PAIR_CC(P_KEY IN VARCHAR2, P_VAL IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    IF P_VAL IS NULL THEN
      RETURN '"' || P_KEY || '":null';
    ELSE
      RETURN '"' || P_KEY || '":"' || FN_JSON_ESCAPE(P_VAL) || '"';
    END IF;
  END FN_JSON_PAIR_CC;

  /*=========================================================================
   [FN_GET_ERROR_MESSAGE] — Traducción de errores Oracle comunes a español,
   reutilizable por cualquier procedimiento de este paquete. Para códigos no
   mapeados explícitamente, cae a un mensaje genérico en español con el
   detalle técnico acotado (para poder diagnosticar sin exponer de más).
  ==========================================================================*/
  FUNCTION FN_GET_ERROR_MESSAGE(P_SQLCODE  IN NUMBER,
                                P_SQLERRM  IN VARCHAR2,
                                P_CONTEXT  IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    CASE
      WHEN P_SQLCODE = -942 THEN
        RETURN 'La tabla del catálogo "' || P_CONTEXT ||
               '" no existe o el usuario de conexión no tiene permisos ' ||
               'para consultarla (verificar GRANT SELECT directo, no por rol).';
      WHEN P_SQLCODE = -1031 THEN
        RETURN 'No se tienen privilegios suficientes para consultar el ' ||
               'catálogo "' || P_CONTEXT || '".';
      WHEN P_SQLCODE = -12154 THEN
        RETURN 'No se pudo resolver el identificador de conexión (TNS) a ' ||
               'la base de datos.';
      WHEN P_SQLCODE IN (-12170, -12535) THEN
        RETURN 'Tiempo de espera agotado al conectar con la base de datos.';
      WHEN P_SQLCODE IN (-3113, -3114) THEN
        RETURN 'Se perdió la conexión con la base de datos durante la ' ||
               'consulta del catálogo "' || P_CONTEXT || '".';
      WHEN P_SQLCODE = -1 THEN
        RETURN 'Ya existe un registro con esa clave en "' || P_CONTEXT || '".';
      WHEN P_SQLCODE IN (100, -1403) THEN
        RETURN 'No se encontraron registros para el criterio de consulta.';
      ELSE
        RETURN 'Error al consultar el catálogo "' || P_CONTEXT || '": ' ||
               SUBSTR(P_SQLERRM, 1, 300);
    END CASE;
  END FN_GET_ERROR_MESSAGE;

  /*=========================================================================
   [PRC_PARSE_PAGE] — parseo compartido de page/size para catálogos sin
   ningún otro filtro (COUNTRIES, LOCALITIES).
  ==========================================================================*/
  PROCEDURE PRC_PARSE_PAGE(I_JSON IN CLOB,
                          O_PAGE OUT NUMBER,
                          O_SIZE OUT NUMBER) IS
  BEGIN
    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_PAGE := 1;
      O_SIZE := 20;
      RETURN;
    END IF;

    SELECT NVL(PG, 1), NVL(SZ, 20)
      INTO O_PAGE, O_SIZE
      FROM JSON_TABLE(I_JSON, '$'
           COLUMNS(PG NUMBER PATH '$.page', SZ NUMBER PATH '$.size'));
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_PAGE := 1;
      O_SIZE := 20;
  END PRC_PARSE_PAGE;

  /*=========================================================================
   CITIES — INFOCENT.SPI_REF (confirmada, SELECT estático — 2026-07-27).
   Columnas: DOMAIN, L_VALUE, H_VALUE, MEANING, MEAN_LABEL. Es una tabla de
   dominios genéricos compartida (se revisaron ~50 dominios: nacionalidades,
   monedas, áreas administrativas, config. de nómina...) y NO se pudo ubicar
   un dominio de ciudades por nombre (búsquedas por "Caracas"/"Bogotá"/
   "Medellín"/"Maracaibo"/"Valencia" en MEANING y L_VALUE no dieron
   resultado). PENDIENTE: confirmar con la persona que dio la info si el
   mapeo "Validar ciudad" -> SPI_REF es correcto, o si las ciudades viven en
   otra tabla (candidato: la que referencia CDAD_CODCIU, visto en
   INFOCENT.NMT020/banks). Mientras tanto, SIN FILTRO por DOMAIN — devuelve
   todos los dominios mezclados (mismo comportamiento que tenía con el motor
   genérico). Agregar WHERE DOMAIN = '<valor>' en cuanto se confirme.
  ==========================================================================*/
  PROCEDURE PRC_GET_CITIES(I_JSON    IN CLOB,
                           O_JSON    OUT CLOB,
                           O_COD     OUT VARCHAR2,
                           O_MESSAGE OUT VARCHAR2) IS
    V_PAGE  NUMBER;
    V_SIZE  NUMBER;
    V_ARRAY CLOB;
    V_ROW   VARCHAR2(32767);
    V_COUNT PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_PAGE(I_JSON, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    -- TODO: agregar "WHERE R.DOMAIN = '<valor confirmado>'" cuando se sepa
    -- cuál dominio corresponde a ciudades.
    FOR R IN (SELECT S.DOMAIN, S.L_VALUE, S.H_VALUE, S.MEANING, S.MEAN_LABEL
                FROM INFOCENT.SPI_REF S
               ORDER BY S.DOMAIN, S.L_VALUE
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('domain', R.DOMAIN) || ','
               || FN_JSON_PAIR_CC('lValue', R.L_VALUE) || ','
               || FN_JSON_PAIR_CC('hValue', R.H_VALUE) || ','
               || FN_JSON_PAIR_CC('meaning', R.MEANING) || ','
               || FN_JSON_PAIR_CC('meanLabel', R.MEAN_LABEL)
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
      O_JSON := '{"cities":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM, 'INFOCENT.SPI_REF');
  END PRC_GET_CITIES;

  /*=========================================================================
   PAYROLL TYPES — INFOCENT.EO_TIPO_NOMINA (confirmada, SELECT estático).
   Se exponen TODAS las columnas de negocio de la tabla (23), solo se
   excluyen USRCRE/FECCRE/USRACT/FECACT (auditoría, igual que el resto del
   API). Tabla scoped por compañía (ID_EMPRESA) — companyId es filtro
   OPCIONAL, igual que groups/branches. Nombres de campo ambiguos
   (CLANOM, ASIGNA_FON, DEDUC_FON, FACTOR_FON, TIPO_FECHA_IN, REGRESO_HABIL,
   ANO_360, PGM_RECIBO, FRE_SALARIO) se exponen tal cual en camelCase, sin
   traducir, porque no se confirmó su significado de negocio exacto.
  ==========================================================================*/
  PROCEDURE PRC_PARSE_PAYROLL_FILTER(I_JSON      IN CLOB,
                                     O_COMPANY_ID OUT VARCHAR2,
                                     O_PAGE       OUT NUMBER,
                                     O_SIZE       OUT NUMBER) IS
  BEGIN
    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_COMPANY_ID := NULL;
      O_PAGE       := 1;
      O_SIZE       := 20;
      RETURN;
    END IF;

    SELECT COMPANY_ID, NVL(PG, 1), NVL(SZ, 20)
      INTO O_COMPANY_ID, O_PAGE, O_SIZE
      FROM JSON_TABLE(I_JSON, '$'
           COLUMNS(COMPANY_ID VARCHAR2(4) PATH '$.companyId',
                   PG NUMBER PATH '$.page',
                   SZ NUMBER PATH '$.size'));
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COMPANY_ID := NULL;
      O_PAGE       := 1;
      O_SIZE       := 20;
  END PRC_PARSE_PAYROLL_FILTER;

  PROCEDURE PRC_GET_PAYROLL_TYPES(I_JSON    IN CLOB,
                                  O_JSON    OUT CLOB,
                                  O_COD     OUT VARCHAR2,
                                  O_MESSAGE OUT VARCHAR2) IS
    V_COMPANY_ID VARCHAR2(4);
    V_PAGE       NUMBER;
    V_SIZE       NUMBER;
    V_ARRAY      CLOB;
    V_ROW        VARCHAR2(32767);
    V_COUNT      PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_PAYROLL_FILTER(I_JSON, V_COMPANY_ID, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT N.ID_EMPRESA, N.ID, N.NOMBRE, N.CLANOM, N.FRECUENCIA,
                     N.FECHA_TOPE1, N.FECHA_TOPE2, N.FECHA_TOPE3,
                     N.FECHA_TOPE4, N.FECHA_TOPE5, N.SALARIO_GUAR,
                     N.CANTI_SALARIO, N.FACTOR_GUAR, N.ASIGNA_FON,
                     N.DEDUC_FON, N.FACTOR_FON, N.FECHA_ABONO, N.REDONDEO,
                     N.TIPO_FECHA_IN, N.REGRESO_HABIL, N.ANO_360,
                     N.PGM_RECIBO, N.FRE_SALARIO,
                     N.USRCRE, N.FECCRE, N.USRACT, N.FECACT
                FROM INFOCENT.EO_TIPO_NOMINA N
               WHERE (V_COMPANY_ID IS NULL OR N.ID_EMPRESA = V_COMPANY_ID)
               ORDER BY N.ID_EMPRESA, N.ID
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('companyId', R.ID_EMPRESA) || ','
               || FN_JSON_PAIR_CC('code', R.ID) || ','
               || FN_JSON_PAIR_CC('name', R.NOMBRE) || ','
               || FN_JSON_PAIR_CC('clanom', R.CLANOM) || ','
               || FN_JSON_PAIR_CC('frequency', TO_CHAR(R.FRECUENCIA)) || ','
               || FN_JSON_PAIR_CC('cutoffDate1', TO_CHAR(R.FECHA_TOPE1, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('cutoffDate2', TO_CHAR(R.FECHA_TOPE2, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('cutoffDate3', TO_CHAR(R.FECHA_TOPE3, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('cutoffDate4', TO_CHAR(R.FECHA_TOPE4, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('cutoffDate5', TO_CHAR(R.FECHA_TOPE5, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('guaranteedSalary', TO_CHAR(R.SALARIO_GUAR)) || ','
               || FN_JSON_PAIR_CC('salaryQuantity', TO_CHAR(R.CANTI_SALARIO)) || ','
               || FN_JSON_PAIR_CC('guaranteedFactor', TO_CHAR(R.FACTOR_GUAR)) || ','
               || FN_JSON_PAIR_CC('asignaFon', TO_CHAR(R.ASIGNA_FON)) || ','
               || FN_JSON_PAIR_CC('deducFon', TO_CHAR(R.DEDUC_FON)) || ','
               || FN_JSON_PAIR_CC('factorFon', TO_CHAR(R.FACTOR_FON)) || ','
               || FN_JSON_PAIR_CC('paymentDate', TO_CHAR(R.FECHA_ABONO, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('rounding', TO_CHAR(R.REDONDEO)) || ','
               || FN_JSON_PAIR_CC('dateTypeIn', TO_CHAR(R.TIPO_FECHA_IN)) || ','
               || FN_JSON_PAIR_CC('regresoHabil', R.REGRESO_HABIL) || ','
               || FN_JSON_PAIR_CC('ano360', R.ANO_360) || ','
               || FN_JSON_PAIR_CC('pgmRecibo', R.PGM_RECIBO) || ','
               || FN_JSON_PAIR_CC('freSalario', R.FRE_SALARIO) || ','
               || FN_JSON_PAIR_CC('createdBy', R.USRCRE) || ','
               || FN_JSON_PAIR_CC('createdAt', TO_CHAR(R.FECCRE, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('updatedBy', R.USRACT) || ','
               || FN_JSON_PAIR_CC('updatedAt', TO_CHAR(R.FECACT, 'YYYY-MM-DD'))
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
      O_JSON := '{"payrollTypes":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM,
                                        'INFOCENT.EO_TIPO_NOMINA');
  END PRC_GET_PAYROLL_TYPES;

  /*=========================================================================
   ACCOUNT TYPES — INFOCENT.NMT022 (confirmada, SELECT estático).
   Columnas: TIPCTA, DESCTA. Tabla plana, sin filtros (solo 2 filas en QA:
   1=CUENTA CORRIENTE, 2=CUENTA AHORRO).
  ==========================================================================*/
  PROCEDURE PRC_GET_ACCOUNT_TYPES(I_JSON    IN CLOB,
                                  O_JSON    OUT CLOB,
                                  O_COD     OUT VARCHAR2,
                                  O_MESSAGE OUT VARCHAR2) IS
    V_PAGE  NUMBER;
    V_SIZE  NUMBER;
    V_ARRAY CLOB;
    V_ROW   VARCHAR2(32767);
    V_COUNT PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_PAGE(I_JSON, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT A.TIPCTA, A.DESCTA, A.USRCRE, A.FECCRE, A.USRACT, A.FECACT
                FROM INFOCENT.NMT022 A
               ORDER BY A.TIPCTA
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('code', R.TIPCTA) || ','
               || FN_JSON_PAIR_CC('name', R.DESCTA) || ','
               || FN_JSON_PAIR_CC('createdBy', R.USRCRE) || ','
               || FN_JSON_PAIR_CC('createdAt', TO_CHAR(R.FECCRE, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('updatedBy', R.USRACT) || ','
               || FN_JSON_PAIR_CC('updatedAt', TO_CHAR(R.FECACT, 'YYYY-MM-DD'))
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
      O_JSON := '{"accountTypes":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM, 'INFOCENT.NMT022');
  END PRC_GET_ACCOUNT_TYPES;

  /*=========================================================================
   ID TYPES — INFOCENT.EO_TIPO_IDENTIFICACION (confirmada, SELECT estático).
   Columnas: ID, DESCRIP. Tabla plana, sin filtros (algunas entradas legacy
   redundantes en QA, ej. '4'/'CC' ambos "cédula de ciudadanía" — se expone
   tal cual, sin deduplicar).
  ==========================================================================*/
  PROCEDURE PRC_GET_ID_TYPES(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2) IS
    V_PAGE  NUMBER;
    V_SIZE  NUMBER;
    V_ARRAY CLOB;
    V_ROW   VARCHAR2(32767);
    V_COUNT PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_PAGE(I_JSON, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT T.ID, T.DESCRIP
                FROM INFOCENT.EO_TIPO_IDENTIFICACION T
               ORDER BY T.ID
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('code', R.ID) || ','
               || FN_JSON_PAIR_CC('name', R.DESCRIP)
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
      O_JSON := '{"idTypes":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM,
                                        'INFOCENT.EO_TIPO_IDENTIFICACION');
  END PRC_GET_ID_TYPES;

  /*=========================================================================
   COUNTRIES — INFOCENT.SPI_PAISES (confirmada, SELECT estático).
   Columnas: CODIGO, NOMBRE. Sin filtros (catálogo plano).
  ==========================================================================*/
  PROCEDURE PRC_GET_COUNTRIES(I_JSON    IN CLOB,
                              O_JSON    OUT CLOB,
                              O_COD     OUT VARCHAR2,
                              O_MESSAGE OUT VARCHAR2) IS
    V_PAGE  NUMBER;
    V_SIZE  NUMBER;
    V_ARRAY CLOB;
    V_ROW   VARCHAR2(32767);
    V_COUNT PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_PAGE(I_JSON, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT P.CODIGO, P.NOMBRE
                FROM INFOCENT.SPI_PAISES P
               ORDER BY P.NOMBRE
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('code', R.CODIGO) || ','
               || FN_JSON_PAIR_CC('name', R.NOMBRE)
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
      O_JSON := '{"countries":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM, 'INFOCENT.SPI_PAISES');
  END PRC_GET_COUNTRIES;

  /*=========================================================================
   LOCALITIES — INFOCENT.NMT002 (RE-CONFIRMADA 2026-07-28, DESCRIBE completo
   contra QA Colombia). CORRECCIÓN: la versión anterior de este wrapper
   usaba solo IDEPRO/CODPOS/NACIONAL/FECSSO/RIESSO/REGSSO/OBSSSO, que
   resultaron ser columnas LEGACY al final de la tabla, casi siempre NULL
   en filas reales — esas 7 columnas eran la "cola" de un DESCRIBE con
   scroll, no la tabla completa. La tabla real tiene ~57 columnas de
   negocio (localidad/sucursal física de una compañía: nombre, dirección,
   jerarquía geográfica, actividad económica, horarios, contacto...).
   Se exponen todas menos auditoría (USRCRE/FECCRE/USRACT/FECACT), igual
   que el resto del paquete. companyId es filtro OPCIONAL (tabla scoped por
   CIA_CODCIA, igual que groups/branches/payroll-types).
   Nombres de campo ambiguos (caploc, nrosso, nroord, regmin, proloc,
   hefeob/hefeem/defeob/defeem, ntrao1-3/ntrae1-3, ideinf, nilcia, idepro,
   nacional) se exponen en camelCase literal del nombre de columna, sin
   traducir, porque no se confirmó su significado de negocio exacto.
  ==========================================================================*/
  PROCEDURE PRC_PARSE_LOCALITIES_FILTER(I_JSON      IN CLOB,
                                        O_COMPANY_ID OUT VARCHAR2,
                                        O_PAGE       OUT NUMBER,
                                        O_SIZE       OUT NUMBER) IS
  BEGIN
    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_COMPANY_ID := NULL;
      O_PAGE       := 1;
      O_SIZE       := 20;
      RETURN;
    END IF;

    SELECT COMPANY_ID, NVL(PG, 1), NVL(SZ, 20)
      INTO O_COMPANY_ID, O_PAGE, O_SIZE
      FROM JSON_TABLE(I_JSON, '$'
           COLUMNS(COMPANY_ID VARCHAR2(4) PATH '$.companyId',
                   PG NUMBER PATH '$.page',
                   SZ NUMBER PATH '$.size'));
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COMPANY_ID := NULL;
      O_PAGE       := 1;
      O_SIZE       := 20;
  END PRC_PARSE_LOCALITIES_FILTER;

  PROCEDURE PRC_GET_LOCALITIES(I_JSON    IN CLOB,
                               O_JSON    OUT CLOB,
                               O_COD     OUT VARCHAR2,
                               O_MESSAGE OUT VARCHAR2) IS
    V_COMPANY_ID VARCHAR2(4);
    V_PAGE       NUMBER;
    V_SIZE       NUMBER;
    V_ARRAY      CLOB;
    V_ROW        VARCHAR2(32767);
    V_COUNT      PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_LOCALITIES_FILTER(I_JSON, V_COMPANY_ID, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT N.CIA_CODCIA, N.CODLOC, N.DESLO1, N.DESLO2,
                     N.DIREC1, N.DIREC2, N.DIREC3, N.PARLOC, N.MUNLOC,
                     N.NONMUN, N.ENTFED, N.NOMFED, N.DISLOC, N.NOMDIS,
                     N.SECLOC, N.CDAD_CODCIU, N.EDO_CODEDO, N.PAI_CODPAI,
                     N.ACTECO, N.DESACT, N.CAPLOC, N.NOMANT, N.DIRANT,
                     N.FECFUN, N.NROSSO, N.NROORD, N.REGMIN, N.PROLOC,
                     N.HEFEOB, N.HEFEEM, N.DEFEOB, N.DEFEEM,
                     N.NTRAO1, N.NTRAE1, N.NTRAO2, N.NTRAE2,
                     N.NTRAO3, N.NTRAE3, N.SIGLAS, N.NUMRIF, N.NUMNIT,
                     N.NUMTLF, N.NUMFAX, N.E_MAIL, N.HORSEM, N.TURNOS,
                     N.NOMINF, N.CGOINF,
                     N.USRCRE, N.FECCRE, N.USRACT, N.FECACT,
                     N.IDEINF, N.NILCIA, N.IDEPRO,
                     N.CODPOS, N.NACIONAL, N.FECSSO, N.RIESSO, N.REGSSO,
                     N.OBSSSO
                FROM INFOCENT.NMT002 N
               WHERE (V_COMPANY_ID IS NULL OR N.CIA_CODCIA = V_COMPANY_ID)
               ORDER BY N.CIA_CODCIA, N.CODLOC
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('companyId', R.CIA_CODCIA) || ','
               || FN_JSON_PAIR_CC('code', R.CODLOC) || ','
               || FN_JSON_PAIR_CC('name', R.DESLO1) || ','
               || FN_JSON_PAIR_CC('name2', R.DESLO2) || ','
               || FN_JSON_PAIR_CC('address1', R.DIREC1) || ','
               || FN_JSON_PAIR_CC('address2', R.DIREC2) || ','
               || FN_JSON_PAIR_CC('address3', R.DIREC3) || ','
               || FN_JSON_PAIR_CC('parishCode', R.PARLOC) || ','
               || FN_JSON_PAIR_CC('municipalityCode', R.MUNLOC) || ','
               || FN_JSON_PAIR_CC('municipalityName', R.NONMUN) || ','
               || FN_JSON_PAIR_CC('stateCode', R.ENTFED) || ','
               || FN_JSON_PAIR_CC('stateName', R.NOMFED) || ','
               || FN_JSON_PAIR_CC('districtCode', R.DISLOC) || ','
               || FN_JSON_PAIR_CC('districtName', R.NOMDIS) || ','
               || FN_JSON_PAIR_CC('sectionCode', R.SECLOC) || ','
               || FN_JSON_PAIR_CC('cityCode', R.CDAD_CODCIU) || ','
               || FN_JSON_PAIR_CC('edoCodedo', R.EDO_CODEDO) || ','
               || FN_JSON_PAIR_CC('countryCode', R.PAI_CODPAI) || ','
               || FN_JSON_PAIR_CC('economicActivityCode', R.ACTECO) || ','
               || FN_JSON_PAIR_CC('economicActivityName', R.DESACT) || ','
               || FN_JSON_PAIR_CC('caploc', TO_CHAR(R.CAPLOC)) || ','
               || FN_JSON_PAIR_CC('previousName', R.NOMANT) || ','
               || FN_JSON_PAIR_CC('previousAddress', R.DIRANT) || ','
               || FN_JSON_PAIR_CC('foundationDate', TO_CHAR(R.FECFUN, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('nrosso', R.NROSSO) || ','
               || FN_JSON_PAIR_CC('nroord', R.NROORD) || ','
               || FN_JSON_PAIR_CC('regmin', R.REGMIN) || ','
               || FN_JSON_PAIR_CC('proloc', R.PROLOC) || ','
               || FN_JSON_PAIR_CC('hefeob', TO_CHAR(R.HEFEOB)) || ','
               || FN_JSON_PAIR_CC('hefeem', TO_CHAR(R.HEFEEM)) || ','
               || FN_JSON_PAIR_CC('defeob', TO_CHAR(R.DEFEOB)) || ','
               || FN_JSON_PAIR_CC('defeem', TO_CHAR(R.DEFEEM)) || ','
               || FN_JSON_PAIR_CC('ntrao1', TO_CHAR(R.NTRAO1)) || ','
               || FN_JSON_PAIR_CC('ntrae1', TO_CHAR(R.NTRAE1)) || ','
               || FN_JSON_PAIR_CC('ntrao2', TO_CHAR(R.NTRAO2)) || ','
               || FN_JSON_PAIR_CC('ntrae2', TO_CHAR(R.NTRAE2)) || ','
               || FN_JSON_PAIR_CC('ntrao3', TO_CHAR(R.NTRAO3)) || ','
               || FN_JSON_PAIR_CC('ntrae3', TO_CHAR(R.NTRAE3)) || ','
               || FN_JSON_PAIR_CC('abbreviation', R.SIGLAS) || ','
               || FN_JSON_PAIR_CC('taxIdRif', R.NUMRIF) || ','
               || FN_JSON_PAIR_CC('taxIdNit', R.NUMNIT) || ','
               || FN_JSON_PAIR_CC('phone', R.NUMTLF) || ','
               || FN_JSON_PAIR_CC('fax', R.NUMFAX) || ','
               || FN_JSON_PAIR_CC('email', R.E_MAIL) || ','
               || FN_JSON_PAIR_CC('weeklyHours', TO_CHAR(R.HORSEM)) || ','
               || FN_JSON_PAIR_CC('shifts', TO_CHAR(R.TURNOS)) || ','
               || FN_JSON_PAIR_CC('contactName', R.NOMINF) || ','
               || FN_JSON_PAIR_CC('contactPosition', R.CGOINF) || ','
               || FN_JSON_PAIR_CC('createdBy', R.USRCRE) || ','
               || FN_JSON_PAIR_CC('createdAt', TO_CHAR(R.FECCRE, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('updatedBy', R.USRACT) || ','
               || FN_JSON_PAIR_CC('updatedAt', TO_CHAR(R.FECACT, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('contactIdType', R.IDEINF) || ','
               || FN_JSON_PAIR_CC('nilcia', R.NILCIA) || ','
               || FN_JSON_PAIR_CC('idepro', R.IDEPRO) || ','
               || FN_JSON_PAIR_CC('postalCode', R.CODPOS) || ','
               || FN_JSON_PAIR_CC('nacional', R.NACIONAL) || ','
               || FN_JSON_PAIR_CC('socialSecurityDate', TO_CHAR(R.FECSSO, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('socialSecurityRisk', TO_CHAR(R.RIESSO)) || ','
               || FN_JSON_PAIR_CC('socialSecurityRegistration', R.REGSSO) || ','
               || FN_JSON_PAIR_CC('socialSecurityObservations', R.OBSSSO)
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
      O_JSON := '{"localities":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM, 'INFOCENT.NMT002');
  END PRC_GET_LOCALITIES;

  /*=========================================================================
   STATES — INFOCENT.SPI_ENTIDAD_FEDERAL (confirmada, SELECT estático).
   Columnas: CODIGO_PAIS, CODIGO, NOMBRE. Tabla multi-país — countryCode es
   un filtro OPCIONAL (si no se manda, devuelve todos los países).
  ==========================================================================*/
  PROCEDURE PRC_PARSE_STATES_FILTER(I_JSON        IN CLOB,
                                    O_COUNTRY_CODE OUT VARCHAR2,
                                    O_PAGE        OUT NUMBER,
                                    O_SIZE        OUT NUMBER) IS
  BEGIN
    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_COUNTRY_CODE := NULL;
      O_PAGE         := 1;
      O_SIZE         := 20;
      RETURN;
    END IF;

    SELECT COUNTRY_CODE, NVL(PG, 1), NVL(SZ, 20)
      INTO O_COUNTRY_CODE, O_PAGE, O_SIZE
      FROM JSON_TABLE(I_JSON, '$'
           COLUMNS(COUNTRY_CODE VARCHAR2(4) PATH '$.countryCode',
                   PG NUMBER PATH '$.page',
                   SZ NUMBER PATH '$.size'));
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COUNTRY_CODE := NULL;
      O_PAGE         := 1;
      O_SIZE         := 20;
  END PRC_PARSE_STATES_FILTER;

  PROCEDURE PRC_GET_STATES(I_JSON    IN CLOB,
                           O_JSON    OUT CLOB,
                           O_COD     OUT VARCHAR2,
                           O_MESSAGE OUT VARCHAR2) IS
    V_COUNTRY_CODE VARCHAR2(4);
    V_PAGE         NUMBER;
    V_SIZE         NUMBER;
    V_ARRAY        CLOB;
    V_ROW          VARCHAR2(32767);
    V_COUNT        PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_STATES_FILTER(I_JSON, V_COUNTRY_CODE, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT E.CODIGO_PAIS, E.CODIGO, E.NOMBRE
                FROM INFOCENT.SPI_ENTIDAD_FEDERAL E
               WHERE (V_COUNTRY_CODE IS NULL OR E.CODIGO_PAIS = V_COUNTRY_CODE)
               ORDER BY E.CODIGO_PAIS, E.CODIGO
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('countryCode', R.CODIGO_PAIS) || ','
               || FN_JSON_PAIR_CC('code', R.CODIGO) || ','
               || FN_JSON_PAIR_CC('name', R.NOMBRE)
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
      O_JSON := '{"states":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM,
                                        'INFOCENT.SPI_ENTIDAD_FEDERAL');
  END PRC_GET_STATES;

  /*=========================================================================
   MUNICIPALITIES — INFOCENT.SPI_MUNICIPIOS (confirmada, SELECT estático).
   Columnas: ID, NOMBRE, ID_PAIS, ID_ENTIDAD. Tabla dedicada, scoped por
   país + entidad (mismo patrón que STATES) — countryCode/stateCode son
   filtros OPCIONALES.
  ==========================================================================*/
  PROCEDURE PRC_PARSE_MUNIC_FILTER(I_JSON        IN CLOB,
                                            O_COUNTRY_CODE OUT VARCHAR2,
                                            O_STATE_CODE   OUT VARCHAR2,
                                            O_PAGE         OUT NUMBER,
                                            O_SIZE         OUT NUMBER) IS
  BEGIN
    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_COUNTRY_CODE := NULL;
      O_STATE_CODE   := NULL;
      O_PAGE         := 1;
      O_SIZE         := 20;
      RETURN;
    END IF;

    SELECT COUNTRY_CODE, STATE_CODE, NVL(PG, 1), NVL(SZ, 20)
      INTO O_COUNTRY_CODE, O_STATE_CODE, O_PAGE, O_SIZE
      FROM JSON_TABLE(I_JSON, '$'
           COLUMNS(COUNTRY_CODE VARCHAR2(4) PATH '$.countryCode',
                   STATE_CODE VARCHAR2(4) PATH '$.stateCode',
                   PG NUMBER PATH '$.page',
                   SZ NUMBER PATH '$.size'));
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COUNTRY_CODE := NULL;
      O_STATE_CODE   := NULL;
      O_PAGE         := 1;
      O_SIZE         := 20;
  END PRC_PARSE_MUNIC_FILTER;

  PROCEDURE PRC_GET_MUNICIPALITIES(I_JSON    IN CLOB,
                                   O_JSON    OUT CLOB,
                                   O_COD     OUT VARCHAR2,
                                   O_MESSAGE OUT VARCHAR2) IS
    V_COUNTRY_CODE VARCHAR2(4);
    V_STATE_CODE   VARCHAR2(4);
    V_PAGE         NUMBER;
    V_SIZE         NUMBER;
    V_ARRAY        CLOB;
    V_ROW          VARCHAR2(32767);
    V_COUNT        PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_MUNIC_FILTER(I_JSON, V_COUNTRY_CODE, V_STATE_CODE,
                          V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT M.ID, M.NOMBRE, M.ID_PAIS, M.ID_ENTIDAD
                FROM INFOCENT.SPI_MUNICIPIOS M
               WHERE (V_COUNTRY_CODE IS NULL OR M.ID_PAIS = V_COUNTRY_CODE)
                 AND (V_STATE_CODE IS NULL OR M.ID_ENTIDAD = V_STATE_CODE)
               ORDER BY M.ID_PAIS, M.ID_ENTIDAD, M.NOMBRE
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('id', TO_CHAR(R.ID)) || ','
               || FN_JSON_PAIR_CC('name', R.NOMBRE) || ','
               || FN_JSON_PAIR_CC('countryCode', R.ID_PAIS) || ','
               || FN_JSON_PAIR_CC('stateCode', R.ID_ENTIDAD)
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
      O_JSON := '{"municipalities":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM,
                                        'INFOCENT.SPI_MUNICIPIOS');
  END PRC_GET_MUNICIPALITIES;

  /*=========================================================================
   PARISHES — INFOCENT.SPI_PARROQUIAS (confirmada, SELECT estático).
   Columnas: ID, NOMBRE, ID_MUNICIPIO. Tabla dedicada, scoped por municipio —
   municipalityId es un filtro OPCIONAL.
  ==========================================================================*/
  PROCEDURE PRC_PARSE_PARISHES_FILTER(I_JSON          IN CLOB,
                                      O_MUNICIPALITY_ID OUT NUMBER,
                                      O_PAGE            OUT NUMBER,
                                      O_SIZE            OUT NUMBER) IS
  BEGIN
    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_MUNICIPALITY_ID := NULL;
      O_PAGE            := 1;
      O_SIZE            := 20;
      RETURN;
    END IF;

    SELECT MUNICIPALITY_ID, NVL(PG, 1), NVL(SZ, 20)
      INTO O_MUNICIPALITY_ID, O_PAGE, O_SIZE
      FROM JSON_TABLE(I_JSON, '$'
           COLUMNS(MUNICIPALITY_ID NUMBER PATH '$.municipalityId',
                   PG NUMBER PATH '$.page',
                   SZ NUMBER PATH '$.size'));
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_MUNICIPALITY_ID := NULL;
      O_PAGE            := 1;
      O_SIZE            := 20;
  END PRC_PARSE_PARISHES_FILTER;

  PROCEDURE PRC_GET_PARISHES(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2) IS
    V_MUNICIPALITY_ID NUMBER;
    V_PAGE            NUMBER;
    V_SIZE            NUMBER;
    V_ARRAY           CLOB;
    V_ROW             VARCHAR2(32767);
    V_COUNT           PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_PARISHES_FILTER(I_JSON, V_MUNICIPALITY_ID, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT P.ID, P.NOMBRE, P.ID_MUNICIPIO
                FROM INFOCENT.SPI_PARROQUIAS P
               WHERE (V_MUNICIPALITY_ID IS NULL
                      OR P.ID_MUNICIPIO = V_MUNICIPALITY_ID)
               ORDER BY P.ID_MUNICIPIO, P.NOMBRE
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('id', TO_CHAR(R.ID)) || ','
               || FN_JSON_PAIR_CC('name', R.NOMBRE) || ','
               || FN_JSON_PAIR_CC('municipalityId', TO_CHAR(R.ID_MUNICIPIO))
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
      O_JSON := '{"parishes":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM,
                                        'INFOCENT.SPI_PARROQUIAS');
  END PRC_GET_PARISHES;

  /*=========================================================================
   GROUPS — INFOCENT.NMT023 (confirmada, SELECT estático).
   Columnas: CIA_CODCIA, TNOM_TIPNOM, CODGRU, DESGRU, TIPJORN, LABDOM (todos
   los campos de negocio de la tabla; se excluyen solo las columnas de
   auditoría USRCRE/FECCRE/USRACT/FECACT, igual que en el resto del API).
   CODGRU NO es único global: depende de CIA_CODCIA + TNOM_TIPNOM. companyId
   y payrollTypeCode son filtros OPCIONALES (si no se mandan, devuelve todo
   mezclado, igual que hoy).
  ==========================================================================*/
  PROCEDURE PRC_PARSE_GROUPS_FILTER(I_JSON            IN CLOB,
                                    O_COMPANY_ID       OUT VARCHAR2,
                                    O_PAYROLL_TYPE_CODE OUT VARCHAR2,
                                    O_PAGE             OUT NUMBER,
                                    O_SIZE             OUT NUMBER) IS
  BEGIN
    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_COMPANY_ID        := NULL;
      O_PAYROLL_TYPE_CODE := NULL;
      O_PAGE              := 1;
      O_SIZE              := 20;
      RETURN;
    END IF;

    SELECT COMPANY_ID, PAYROLL_TYPE_CODE, NVL(PG, 1), NVL(SZ, 20)
      INTO O_COMPANY_ID, O_PAYROLL_TYPE_CODE, O_PAGE, O_SIZE
      FROM JSON_TABLE(I_JSON, '$'
           COLUMNS(COMPANY_ID VARCHAR2(4) PATH '$.companyId',
                   PAYROLL_TYPE_CODE VARCHAR2(4) PATH '$.payrollTypeCode',
                   PG NUMBER PATH '$.page',
                   SZ NUMBER PATH '$.size'));
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COMPANY_ID        := NULL;
      O_PAYROLL_TYPE_CODE := NULL;
      O_PAGE              := 1;
      O_SIZE              := 20;
  END PRC_PARSE_GROUPS_FILTER;

  PROCEDURE PRC_GET_GROUPS(I_JSON    IN CLOB,
                           O_JSON    OUT CLOB,
                           O_COD     OUT VARCHAR2,
                           O_MESSAGE OUT VARCHAR2) IS
    V_COMPANY_ID       VARCHAR2(4);
    V_PAYROLL_TYPE_CODE VARCHAR2(4);
    V_PAGE             NUMBER;
    V_SIZE             NUMBER;
    V_ARRAY            CLOB;
    V_ROW              VARCHAR2(32767);
    V_COUNT            PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_GROUPS_FILTER(I_JSON, V_COMPANY_ID, V_PAYROLL_TYPE_CODE,
                            V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT G.CIA_CODCIA, G.TNOM_TIPNOM, G.CODGRU, G.DESGRU,
                     G.USRCRE, G.FECCRE, G.USRACT, G.FECACT,
                     G.TIPJORN, G.LABDOM
                FROM INFOCENT.NMT023 G
               WHERE (V_COMPANY_ID IS NULL OR G.CIA_CODCIA = V_COMPANY_ID)
                 AND (V_PAYROLL_TYPE_CODE IS NULL
                      OR G.TNOM_TIPNOM = V_PAYROLL_TYPE_CODE)
               ORDER BY G.CIA_CODCIA, G.TNOM_TIPNOM, G.CODGRU
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('companyId', R.CIA_CODCIA) || ','
               || FN_JSON_PAIR_CC('payrollTypeCode', R.TNOM_TIPNOM) || ','
               || FN_JSON_PAIR_CC('code', R.CODGRU) || ','
               || FN_JSON_PAIR_CC('description', R.DESGRU) || ','
               || FN_JSON_PAIR_CC('createdBy', R.USRCRE) || ','
               || FN_JSON_PAIR_CC('createdAt', TO_CHAR(R.FECCRE, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('updatedBy', R.USRACT) || ','
               || FN_JSON_PAIR_CC('updatedAt', TO_CHAR(R.FECACT, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('workdayTypeCode', R.TIPJORN) || ','
               || FN_JSON_PAIR_CC('sundayWorkFlag', R.LABDOM)
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
      O_JSON := '{"groups":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM, 'INFOCENT.NMT023');
  END PRC_GET_GROUPS;

  /*=========================================================================
   BRANCHES — INFOCENT.NMT038 (confirmada, SELECT estático).
   Columnas: CIA_CODCIA, CODSUC, DESSUC, CODCTB, CODUBI. CODSUC está scoped
   a CIA_CODCIA — companyId es un filtro OPCIONAL.
  ==========================================================================*/
  PROCEDURE PRC_PARSE_BRANCHES_FILTER(I_JSON      IN CLOB,
                                      O_COMPANY_ID OUT VARCHAR2,
                                      O_PAGE       OUT NUMBER,
                                      O_SIZE       OUT NUMBER) IS
  BEGIN
    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_COMPANY_ID := NULL;
      O_PAGE       := 1;
      O_SIZE       := 20;
      RETURN;
    END IF;

    SELECT COMPANY_ID, NVL(PG, 1), NVL(SZ, 20)
      INTO O_COMPANY_ID, O_PAGE, O_SIZE
      FROM JSON_TABLE(I_JSON, '$'
           COLUMNS(COMPANY_ID VARCHAR2(4) PATH '$.companyId',
                   PG NUMBER PATH '$.page',
                   SZ NUMBER PATH '$.size'));
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COMPANY_ID := NULL;
      O_PAGE       := 1;
      O_SIZE       := 20;
  END PRC_PARSE_BRANCHES_FILTER;

  PROCEDURE PRC_GET_BRANCHES(I_JSON    IN CLOB,
                             O_JSON    OUT CLOB,
                             O_COD     OUT VARCHAR2,
                             O_MESSAGE OUT VARCHAR2) IS
    V_COMPANY_ID VARCHAR2(4);
    V_PAGE       NUMBER;
    V_SIZE       NUMBER;
    V_ARRAY      CLOB;
    V_ROW        VARCHAR2(32767);
    V_COUNT      PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_BRANCHES_FILTER(I_JSON, V_COMPANY_ID, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT B.CIA_CODCIA, B.CODSUC, B.DESSUC, B.CODCTB,
                     B.USRCRE, B.FECCRE, B.USRACT, B.FECACT, B.CODUBI
                FROM INFOCENT.NMT038 B
               WHERE (V_COMPANY_ID IS NULL OR B.CIA_CODCIA = V_COMPANY_ID)
               ORDER BY B.CIA_CODCIA, B.CODSUC
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('companyId', R.CIA_CODCIA) || ','
               || FN_JSON_PAIR_CC('code', R.CODSUC) || ','
               || FN_JSON_PAIR_CC('name', R.DESSUC) || ','
               || FN_JSON_PAIR_CC('accountingCode', R.CODCTB) || ','
               || FN_JSON_PAIR_CC('createdBy', R.USRCRE) || ','
               || FN_JSON_PAIR_CC('createdAt', TO_CHAR(R.FECCRE, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('updatedBy', R.USRACT) || ','
               || FN_JSON_PAIR_CC('updatedAt', TO_CHAR(R.FECACT, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('locationCode', R.CODUBI)
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
      O_JSON := '{"branches":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM, 'INFOCENT.NMT038');
  END PRC_GET_BRANCHES;

  /*=========================================================================
   BANKS — INFOCENT.NMT020 (confirmada, SELECT estático).
   Tabla mixta de instituciones (bancos/aseguradoras/fondos de pensión),
   distinguidas por TIPI_CODTIP. Se filtra TIPI_CODTIP = '01' (asumido como
   "banco" según la muestra: DAVIVIENDA/BANCOLOMBIA; PENDIENTE confirmar).
   companyId es un filtro OPCIONAL adicional. NOCTTO se expone como
   "contractNumber" — nombre no confirmado semánticamente.
  ==========================================================================*/
  PROCEDURE PRC_PARSE_BANKS_FILTER(I_JSON      IN CLOB,
                                   O_COMPANY_ID OUT VARCHAR2,
                                   O_PAGE       OUT NUMBER,
                                   O_SIZE       OUT NUMBER) IS
  BEGIN
    IF I_JSON IS NULL OR DBMS_LOB.GETLENGTH(I_JSON) = 0 THEN
      O_COMPANY_ID := NULL;
      O_PAGE       := 1;
      O_SIZE       := 20;
      RETURN;
    END IF;

    SELECT COMPANY_ID, NVL(PG, 1), NVL(SZ, 20)
      INTO O_COMPANY_ID, O_PAGE, O_SIZE
      FROM JSON_TABLE(I_JSON, '$'
           COLUMNS(COMPANY_ID VARCHAR2(4) PATH '$.companyId',
                   PG NUMBER PATH '$.page',
                   SZ NUMBER PATH '$.size'));
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      O_COMPANY_ID := NULL;
      O_PAGE       := 1;
      O_SIZE       := 20;
  END PRC_PARSE_BANKS_FILTER;

  PROCEDURE PRC_GET_BANKS(I_JSON    IN CLOB,
                          O_JSON    OUT CLOB,
                          O_COD     OUT VARCHAR2,
                          O_MESSAGE OUT VARCHAR2) IS
    C_BANK_TYPE_CODE CONSTANT VARCHAR2(2) := '01'; -- asumido, ver comentario arriba
    V_COMPANY_ID VARCHAR2(4);
    V_PAGE       NUMBER;
    V_SIZE       NUMBER;
    V_ARRAY      CLOB;
    V_ROW        VARCHAR2(32767);
    V_COUNT      PLS_INTEGER := 0;
  BEGIN
    O_MESSAGE := PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO;
    O_COD     := PKG_GLOBAL_CONSTANTS.GC_CODIGO_EXITO;

    PRC_PARSE_BANKS_FILTER(I_JSON, V_COMPANY_ID, V_PAGE, V_SIZE);
    IF V_PAGE < 1 THEN V_PAGE := 1; END IF;
    IF V_SIZE < 1 THEN V_SIZE := 20; END IF;
    IF V_SIZE > 100 THEN V_SIZE := 100; END IF;

    DBMS_LOB.CREATETEMPORARY(V_ARRAY, TRUE);
    DBMS_LOB.APPEND(V_ARRAY, '[');

    FOR R IN (SELECT K.CIA_CODCIA, K.TIPI_CODTIP, K.CODINS, K.DESINS,
                     K.NRORIF, K.DIREC1, K.DIREC2, K.DIREC3,
                     K.CDAD_CODCIU, K.EDO_CODEDO, K.PAI_CODPAI,
                     K.NROTL1, K.NROTL2, K.NROFAX, K.NROCTA, K.CTACON,
                     K.NOMCON, K.TCTA_TIPCTA, K.NOCTTO,
                     K.USRCRE, K.FECCRE, K.USRACT, K.FECACT, K.CODRIE
                FROM INFOCENT.NMT020 K
               WHERE K.TIPI_CODTIP = C_BANK_TYPE_CODE
                 AND (V_COMPANY_ID IS NULL OR K.CIA_CODCIA = V_COMPANY_ID)
               ORDER BY K.DESINS
              OFFSET (V_PAGE - 1) * V_SIZE ROWS FETCH NEXT V_SIZE ROWS ONLY)
    LOOP
      IF V_COUNT > 0 THEN
        DBMS_LOB.APPEND(V_ARRAY, ',');
      END IF;

      V_ROW := '{'
               || FN_JSON_PAIR_CC('companyId', R.CIA_CODCIA) || ','
               || FN_JSON_PAIR_CC('institutionTypeCode', R.TIPI_CODTIP) || ','
               || FN_JSON_PAIR_CC('code', R.CODINS) || ','
               || FN_JSON_PAIR_CC('name', R.DESINS) || ','
               || FN_JSON_PAIR_CC('taxId', R.NRORIF) || ','
               || FN_JSON_PAIR_CC('address1', R.DIREC1) || ','
               || FN_JSON_PAIR_CC('address2', R.DIREC2) || ','
               || FN_JSON_PAIR_CC('address3', R.DIREC3) || ','
               || FN_JSON_PAIR_CC('cityCode', R.CDAD_CODCIU) || ','
               || FN_JSON_PAIR_CC('stateCode', R.EDO_CODEDO) || ','
               || FN_JSON_PAIR_CC('countryCode', R.PAI_CODPAI) || ','
               || FN_JSON_PAIR_CC('phone1', R.NROTL1) || ','
               || FN_JSON_PAIR_CC('phone2', R.NROTL2) || ','
               || FN_JSON_PAIR_CC('fax', R.NROFAX) || ','
               || FN_JSON_PAIR_CC('accountNumber', R.NROCTA) || ','
               || FN_JSON_PAIR_CC('accountControl', R.CTACON) || ','
               || FN_JSON_PAIR_CC('accountHolderName', R.NOMCON) || ','
               || FN_JSON_PAIR_CC('accountTypeCode', R.TCTA_TIPCTA) || ','
               || FN_JSON_PAIR_CC('contractNumber', R.NOCTTO) || ','
               || FN_JSON_PAIR_CC('createdBy', R.USRCRE) || ','
               || FN_JSON_PAIR_CC('createdAt', TO_CHAR(R.FECCRE, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('updatedBy', R.USRACT) || ','
               || FN_JSON_PAIR_CC('updatedAt', TO_CHAR(R.FECACT, 'YYYY-MM-DD')) || ','
               || FN_JSON_PAIR_CC('riskCode', R.CODRIE)
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
      O_JSON := '{"banks":' || V_ARRAY || '}';
    END IF;

    DBMS_LOB.FREETEMPORARY(V_ARRAY);

  EXCEPTION
    WHEN OTHERS THEN
      IF V_ARRAY IS NOT NULL AND DBMS_LOB.ISTEMPORARY(V_ARRAY) = 1 THEN
        DBMS_LOB.FREETEMPORARY(V_ARRAY);
      END IF;
      O_COD     := 'ORA-' || TO_CHAR(ABS(SQLCODE));
      O_MESSAGE := FN_GET_ERROR_MESSAGE(SQLCODE, SQLERRM, 'INFOCENT.NMT020');
  END PRC_GET_BANKS;

END PKG_MANAGEMENT_CATALOGS;
/
