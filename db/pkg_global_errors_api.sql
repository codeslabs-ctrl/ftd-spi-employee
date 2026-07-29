--------------------------------------------------------------------------------
-- PKG_GLOBAL_ERRORS — Manejo de errores en español (paquete único, compartido)
-- Esquema destino: people_one | Oracle 12.1.0.2
--
-- Se referencia SIN calificar esquema desde el resto de paquetes
-- (PKG_MANAGEMENT_CATALOGS, PKG_MANAGEMENT_COMPANY, PKG_MANAGEMENT_EMPLOYEE,
-- PKG_MANAGEMENT_JOB_POST, PKG_MANAGEMENT_MARITAL_STATUS,
-- PKG_MANAGEMENT_ORG_UNIT, PKG_MANAGEMENT_POSITION), igual que ya se hace con
-- PKG_GLOBAL_CONSTANTS.GC_MENSAJE_EXITO / GC_CODIGO_EXITO. Compilar este
-- paquete ANTES que cualquiera de los que lo llaman.
--
-- OBJETIVO: antes cada paquete tenía su propia copia de FN_GET_ERROR_MESSAGE
-- (7 copias idénticas). Se centraliza aquí para que agregar/ajustar un
-- mapeo de código Oracle -> mensaje en español se haga en un solo lugar y
-- se replique automáticamente a todos los paquetes que lo llaman, sin tener
-- que tocar cada uno por separado.
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_GLOBAL_ERRORS AS

  /*=========================================================================
   [FN_GET_ERROR_MESSAGE] — Traducción de errores Oracle comunes a español.
   P_CONTEXT identifica la tabla/operación afectada (se incrusta en el
   mensaje para poder diagnosticar sin exponer de más). Para códigos no
   mapeados explícitamente, cae a un mensaje genérico en español con el
   detalle técnico acotado.
  ==========================================================================*/
  FUNCTION FN_GET_ERROR_MESSAGE(P_SQLCODE IN NUMBER,
                                P_SQLERRM IN VARCHAR2,
                                P_CONTEXT IN VARCHAR2) RETURN VARCHAR2;

END PKG_GLOBAL_ERRORS;
/

CREATE OR REPLACE PACKAGE BODY PKG_GLOBAL_ERRORS AS

  FUNCTION FN_GET_ERROR_MESSAGE(P_SQLCODE IN NUMBER,
                                P_SQLERRM IN VARCHAR2,
                                P_CONTEXT IN VARCHAR2) RETURN VARCHAR2 IS
    -- Para -20000..-20999 (RAISE_APPLICATION_ERROR): P_SQLERRM viene como
    -- "ORA-20001: <mensaje de negocio>\nORA-06512: at ...". Se limpia el
    -- prefijo "ORA-#####:" y se corta en el primer salto de línea para
    -- devolver solo el mensaje de negocio, tal como lo escribió el
    -- procedimiento que lo lanzó.
    V_APP_MSG VARCHAR2(300) :=
      REGEXP_SUBSTR(REGEXP_REPLACE(P_SQLERRM, '^ORA-[0-9]+:\s*'),
                    '^[^' || CHR(10) || ']+');
  BEGIN
    CASE
      -- Objeto / privilegios
      WHEN P_SQLCODE = -942 THEN
        RETURN 'La tabla "' || P_CONTEXT || '" no existe o el usuario de ' ||
               'conexión no tiene permisos para consultarla (verificar ' ||
               'GRANT SELECT directo, no por rol).';
      WHEN P_SQLCODE = -1031 THEN
        RETURN 'No se tienen privilegios suficientes para acceder a "' ||
               P_CONTEXT || '".';
      WHEN P_SQLCODE = -904 THEN
        RETURN 'Una columna referenciada en "' || P_CONTEXT || '" no existe ' ||
               '(nombre de columna inválido) — revisar el SELECT contra el ' ||
               'DESCRIBE real de la tabla.';
      WHEN P_SQLCODE = -911 THEN
        RETURN 'Carácter inválido en la sentencia SQL ejecutada sobre "' ||
               P_CONTEXT || '".';
      -- Conexión
      WHEN P_SQLCODE = -12154 THEN
        RETURN 'No se pudo resolver el identificador de conexión (TNS) a ' ||
               'la base de datos.';
      WHEN P_SQLCODE = -1017 THEN
        RETURN 'Usuario o contraseña de conexión a la base de datos ' ||
               'inválidos.';
      WHEN P_SQLCODE IN (-12170, -12535) THEN
        RETURN 'Tiempo de espera agotado al conectar con la base de datos.';
      WHEN P_SQLCODE IN (-3113, -3114) THEN
        RETURN 'Se perdió la conexión con la base de datos durante la ' ||
               'operación sobre "' || P_CONTEXT || '".';
      WHEN P_SQLCODE = -25408 THEN
        RETURN 'No se pudo reintentar la operación de forma segura tras un ' ||
               'corte de conexión — reintentar la solicitud.';
      -- Concurrencia / bloqueos
      WHEN P_SQLCODE = -54 THEN
        RETURN 'El registro en "' || P_CONTEXT || '" está bloqueado por ' ||
               'otra sesión — reintentar en unos segundos.';
      WHEN P_SQLCODE = -60 THEN
        RETURN 'Se detectó un interbloqueo (deadlock) al operar sobre "' ||
               P_CONTEXT || '" — reintentar la solicitud.';
      WHEN P_SQLCODE = -1013 THEN
        RETURN 'La operación sobre "' || P_CONTEXT || '" fue cancelada.';
      -- Integridad de datos
      WHEN P_SQLCODE = -1 THEN
        RETURN 'Ya existe un registro con esa clave en "' || P_CONTEXT || '".';
      WHEN P_SQLCODE = -2291 THEN
        RETURN 'El registro hace referencia a una clave que no existe en ' ||
               '"' || P_CONTEXT || '" (violación de llave foránea al ' ||
               'insertar/actualizar).';
      WHEN P_SQLCODE = -2292 THEN
        RETURN 'No se puede eliminar/actualizar el registro en "' ||
               P_CONTEXT || '" porque tiene registros relacionados que ' ||
               'dependen de él.';
      WHEN P_SQLCODE = -1400 THEN
        RETURN 'Falta un valor obligatorio (NOT NULL) al guardar en "' ||
               P_CONTEXT || '".';
      WHEN P_SQLCODE = -1722 THEN
        RETURN 'Un valor enviado no es un número válido para "' ||
               P_CONTEXT || '".';
      WHEN P_SQLCODE IN (-1830, -1858, -1861) THEN
        RETURN 'Una fecha enviada no tiene el formato esperado para "' ||
               P_CONTEXT || '".';
      WHEN P_SQLCODE = -12899 THEN
        RETURN 'Un valor enviado es demasiado largo para el campo ' ||
               'correspondiente en "' || P_CONTEXT || '".';
      WHEN P_SQLCODE = -6502 THEN
        RETURN 'Error de datos/numérico interno al procesar "' || P_CONTEXT ||
               '" (valor fuera de rango o buffer insuficiente).';
      -- Aplicación (RAISE_APPLICATION_ERROR, -20000..-20999) y sin datos
      WHEN P_SQLCODE BETWEEN -20999 AND -20000 THEN
        RETURN NVL(V_APP_MSG, SUBSTR(P_SQLERRM, 1, 300));
      WHEN P_SQLCODE IN (100, -1403) THEN
        RETURN 'No se encontraron registros para el criterio de consulta.';
      ELSE
        RETURN 'Error al procesar "' || P_CONTEXT || '": ' ||
               SUBSTR(P_SQLERRM, 1, 300);
    END CASE;
  END FN_GET_ERROR_MESSAGE;

END PKG_GLOBAL_ERRORS;
/
