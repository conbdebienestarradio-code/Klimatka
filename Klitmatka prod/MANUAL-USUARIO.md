# Manual de usuario de Klimatka

**Guía para el uso de la plataforma de inteligencia ambiental empresarial**  
**Edición:** 1.2 · **Alcance:** funciones disponibles en la aplicación actual

## Índice

- [1. Propósito y alcance](#1-propósito-y-alcance)
- [2. Crear una cuenta e iniciar sesión](#2-crear-una-cuenta-e-iniciar-sesión)
- [3. Administrar empresas y miembros](#3-administrar-empresas-y-miembros)
- [4. Navegar por la herramienta](#4-navegar-por-la-herramienta)
- [5. Consultar el Resumen](#5-consultar-el-resumen)
- [6. Registrar una actividad](#6-registrar-una-actividad)
- [7. Revisar, corregir o eliminar registros](#7-revisar-corregir-o-eliminar-registros)
- [8. Interpretar Calidad](#8-interpretar-calidad)
- [9. Usar el Plan de acción](#9-usar-el-plan-de-acción)
- [10. Exportar información](#10-exportar-información)
- [11. Factores, estados y responsabilidades](#11-factores-estados-y-responsabilidades)
- [12. Resolver problemas frecuentes](#12-resolver-problemas-frecuentes)
- [Glosario](#glosario)

## 1. Propósito y alcance

Klimatka ayuda a organizar datos de actividad ambiental, calcular resultados con los factores disponibles y revisar períodos, calidad y trazabilidad. Incluye módulos para electricidad, combustibles, agua, residuos, materiales, empaques, refrigerantes, emisiones al aire, uso de inteligencia artificial e internet.

Los resultados deben interpretarse junto con la actividad registrada, su fuente, el factor aplicado y las advertencias mostradas. La plataforma no sustituye los documentos de respaldo ni convierte un factor pendiente de validación en un factor oficialmente validado. Este manual describe el uso de las funciones disponibles; algunas opciones dependen de los permisos de la cuenta y de los parámetros cargados.

## 2. Crear una cuenta e iniciar sesión

### Crear un perfil

1. En la pantalla de acceso, selecciona **Crear mi perfil**.
2. Completa nombre, apellidos, cargo profesional, correo electrónico, contraseña y confirmación.
3. La contraseña debe tener entre 12 y 128 caracteres.
4. Selecciona **Crear mi perfil**. Después podrás crear tu primera empresa o aceptar la invitación que recibiste por correo.

El perfil personal puede estar asociado a varias empresas. Usa un correo al que tengas acceso, especialmente para las invitaciones y la recuperación de contraseña.

### Iniciar sesión

1. Abre **Inicia sesión aquí** o la opción **Iniciar sesión**.
2. Escribe el correo asociado a tu perfil y la contraseña.
3. Selecciona **Iniciar sesión**.

### Recuperar el acceso

1. En la pantalla de inicio de sesión, selecciona **¿Olvidaste tu contraseña?**.
2. Ingresa el correo del perfil y selecciona **Enviar enlace**.
3. Revisa tu bandeja de entrada y correo no deseado; abre el enlace recibido.
4. Escribe y confirma una nueva contraseña de al menos 12 caracteres y selecciona **Actualizar contraseña**.

Si la pantalla indica que la recuperación por correo no está disponible, contacta al equipo administrador de Klimatka.

## 3. Administrar empresas y miembros

### Crear o cambiar de empresa

1. Abre el selector del espacio de trabajo situado en la parte superior del menú lateral. También puedes llegar a **Tus empresas** al terminar el registro si aún no tienes una empresa activa.
2. Para crear una, completa **Nombre de la empresa**, **RIF**, **Número de empleados** y **Correo de la empresa**.
3. Selecciona **Crear espacio empresarial**. La persona que crea el espacio queda como administradora de esa empresa.
4. Si tu perfil tiene acceso a varias empresas, elige la empresa que quieres abrir en **Espacios disponibles**.

Cada empresa tiene sus propios miembros y registros. El nombre y el RIF deben ser únicos. El número de empleados del perfil de empresa es informativo; no se usa por sí solo para calcular los indicadores ambientales.

### Invitar a una persona

La función está disponible para administradores de empresa. La invitación se envía al correo indicado; no hace falta copiar ni compartir un enlace desde la pantalla de administración.

1. En el menú lateral, selecciona **Invitar a un usuario** para abrir **Personas y accesos**.
2. Ingresa el correo de la persona y selecciona **Enviar invitación por correo**. La invitación pendiente vence en 7 días.
3. La persona abre el mensaje y crea su perfil o inicia sesión con ese mismo correo para aceptar la invitación.
4. En **Personas y accesos**, la administración puede consultar quién tiene acceso, revisar invitaciones pendientes, cancelar una invitación pendiente o revocar el acceso de un miembro.

Si aparece el aviso **El envío de correos aún no está configurado**, la invitación no se ha enviado. El equipo que administra el despliegue de Klimatka debe configurar el servicio de correo. En la demostración local se muestra **Aún no se envían correos** y la invitación se simula; no se envía un mensaje real.

Una vez aceptada, la membresía no vence: se mantiene hasta que una persona administradora revoque el acceso. El trabajador puede registrar actividades y corregir las propias desde **Mi actividad**; también puede consultar los datos de la empresa y ver los demás registros en modo de solo lectura. No puede modificar registros de otras personas, cambiar la dotación de las sedes ni eliminar sus capturas.

Las actividades de los trabajadores se incluyen en los totales empresariales. Al revocar el acceso se bloquea su entrada a la empresa, pero sus registros, versiones e historial de auditoría se conservan; no se borran ni se restan de los indicadores.

### Cambiar de empresa o cerrar sesión

Selecciona el nombre de la empresa en la parte superior izquierda para volver a **Tus empresas** y cambiar el espacio activo. Para salir de la cuenta, utiliza **Cerrar sesión** junto a tu nombre en el menú lateral.

## 4. Navegar por la herramienta

El menú lateral contiene las vistas principales:

- **Resumen:** indicadores, consulta y comparación de períodos, intensidades por empleado y exportaciones.
- **Registros:** búsqueda y consulta de las actividades de la empresa. Los administradores pueden corregir registros; los trabajadores pueden corregir los propios.
- **Mi actividad:** vista personal de las capturas del trabajador; desde aquí puede registrar actividades y corregir las propias, pero no eliminarlas.
- **Calidad:** consulta el promedio del Índice DQ y sus cinco dimensiones. Las cuentas administradoras la ven en el menú; el botón **Conoce el método** también abre esta vista.
- **Plan de acción:** ruta de mejora de referencia y oportunidades generadas a partir de los registros.

En pantallas pequeñas, utiliza el botón de menú para abrir o cerrar la navegación. El selector superior izquierdo cambia de empresa. El botón de notificaciones informa si hay avisos nuevos; si indica que no hay notificaciones, no es necesario realizar ninguna acción.

La administración de módulos y parámetros metodológicos está reservada a cuentas autorizadas por Klimatka; no forma parte de las tareas de administración ordinaria de una empresa.

## 5. Consultar el Resumen

1. Abre **Resumen**.
2. En **Período de consulta**, elige **Año de gestión** o **Mes específico**.
3. Selecciona el año y, para la vista mensual, el mes.
4. En **Comparar con**, elige el año de comparación. En una consulta mensual, Klimatka compara el mismo mes de ambos años.

La tabla de comparación muestra los dos valores, la diferencia absoluta y la variación porcentual. **Sin datos** significa que no hay registros para ese período; no equivale a cero. Si el valor de comparación es cero, el porcentaje aparece como no aplicable.

El Resumen presenta indicadores ambientales y puede incluir **Indicadores por sede y empleado**. Para calcular intensidades anuales se necesita la dotación de los 12 meses; si faltan datos, la pantalla informa la cobertura disponible y no inventa un promedio. La dotación puede anotarse al registrar una actividad y se guarda por sede y mes. El total declarado al crear la empresa no sustituye ese registro mensual.

Los mosaicos de módulos ambientales permiten abrir el formulario de actividad con el módulo seleccionado. Usa **Añadir actividad** para iniciar una captura sin seleccionar previamente un módulo.

## 6. Registrar una actividad

Puedes comenzar desde **Añadir actividad** en el Resumen, **Añadir actividad** en Registros o Plan de acción, o desde un mosaico de módulo del Resumen.

### Datos generales

Completa los campos obligatorios del formulario:

1. **Módulo** y **Actividad / factor**: selecciona las opciones disponibles. La lista cambia según el módulo y el período.
2. **Cantidad** y **Unidad**: ingresa el dato respaldado por la fuente. Las unidades disponibles dependen del módulo.
3. **Instalación**: indica la sede o planta a la que corresponde la actividad.
4. **Período reportado**: selecciona mes y año.
5. **Geografía**: elige la ubicación que corresponda entre las opciones disponibles: Venezuela (VE), Estados Unidos (CAMX) o Colombia (nacional).
6. **Tipo de fuente**: selecciona factura comercial, medición directa, registro operativo o estimación.
7. **Referencia / documento de respaldo**: escribe una identificación, por ejemplo el número de factura o nombre del informe. Este campo registra la referencia; no carga el archivo.
8. **Calidad y trazabilidad**: asigna una puntuación a cada una de las cinco dimensiones: **0 = baja**, **1 = parcial** o **2 = completa**. Debes completar las cinco para guardar.
9. **Empleados de la sede**: campo opcional. Si lo informas, se conserva para esa sede y ese mes y puede reutilizarse en otra actividad del mismo contexto.
10. Selecciona **Validar y calcular**. Si aparece un mensaje de error, corrige lo indicado y vuelve a intentarlo. Selecciona **Cancelar** para salir sin guardar.

### Datos específicos de cada módulo

- **Electricidad:** elige _Location-based_ para usar el factor de red o _Market-based_ para un factor contractual. La opción contractual requiere ingresar el factor y su fuente.
- **Combustible:** selecciona el combustible disponible; la unidad depende de la opción elegida.
- **Agua:** puedes añadir agua descargada, reutilizada y un denominador productivo si cuentas con esos datos. El balance se presenta como diferencia o agua no contabilizada; no se atribuye automáticamente a una pérdida.
- **Residuos:** clasifica cada actividad como residuo peligroso o no peligroso y selecciona el destino disponible.
- **Materiales:** contenido reciclado, masa recuperada, material elegible para circularidad y datos de producto o subproductos son opcionales y deben estar respaldados. La recuperabilidad potencial no equivale a recuperación real.
- **Empaques:** puedes informar contenido reciclado y masa recuperada. La plataforma no infiere una masa recuperada a partir de que un empaque sea reciclable.
- **Refrigerantes:** selecciona el refrigerante disponible e ingresa la cantidad en una unidad permitida.
- **Emisiones al aire:** selecciona CO₂, CH₄, N₂O, PM10, NOx, SOx o VOC. Para CH₄, especifica el origen solicitado. Los contaminantes criterio no se convierten automáticamente a CO₂e.
- **Uso de IA:** registra el tipo de uso, proveedor y número de solicitudes. Modelo y tokens de entrada y salida son opcionales.
- **Internet:** registra el tipo de conexión, proveedor y tráfico total. Los datos de subida y descarga son opcionales.

En los módulos de IA e internet, ingresa energía, agua o GEI informados solo cuando una medición o el proveedor los documente. Solicitudes, tokens y GB representan actividad, no emisiones. El GEI comunicado por el proveedor se mantiene separado y no se suma automáticamente al inventario corporativo.

## 7. Revisar, corregir o eliminar registros

Abre **Registros** para consultar las actividades guardadas. El campo de búsqueda permite localizar registros por categoría, período o factor. Cada fila muestra el módulo, la instalación, el período, la actividad, el resultado, el Índice DQ y el estado del cálculo.

- **Ver trazabilidad:** despliega el detalle del factor utilizado, su estado y fuente, la fuente de actividad, las puntuaciones de calidad, incertidumbre y advertencias metodológicas. En actividades digitales también aparecen los datos de proveedor y uso que se hayan informado.
- **Modificar:** selecciona **Modificar**, corrige los datos y guarda. Klimatka vuelve a validar y calcular la actividad; la versión anterior permanece en **Historial de versiones**. Un trabajador puede modificar sus propios registros; la administración puede corregir registros de la empresa.
- **Eliminar:** esta opción solo está disponible para registros creados por administración. Las capturas de trabajadores no se pueden eliminar; su historial y su aporte a los totales empresariales se conservan.

Los trabajadores consultan todos los registros empresariales en modo de solo lectura y encuentran sus propias capturas en **Mi actividad**. Revocar el acceso a un trabajador no borra sus mediciones, versiones, ni el historial de auditoría. Revisa la sede y el período antes de corregir, ya que esos datos determinan dónde se reflejará el cálculo.

## 8. Interpretar Calidad

El **Índice DQ** resume la calidad de la evidencia en una escala de 0 a 10 a partir de cinco dimensiones:

1. **Fuente:** calidad y jerarquía de la fuente declarada.
2. **Medición:** dato medido, documentado o estimado.
3. **Representatividad temporal:** cobertura del período reportado.
4. **Representatividad operacional:** cobertura de procesos e instalaciones.
5. **Trazabilidad:** existencia de evidencia y capacidad de revisión.

Cada dimensión se puntúa entre 0 y 2. El nivel general se interpreta así: **9–10 alta**, **7–8 media-alta**, **5–6 media**, **3–4 baja** y **0–2 insuficiente**. Un puntaje alto representa mejor respaldo del dato, no necesariamente un menor impacto ambiental. La puntuación se asigna al registrar o corregir la actividad; la vista Calidad sirve para interpretar los datos guardados.

## 9. Usar el Plan de acción

El **Plan de acción** presenta una ruta de referencia en cuatro horizontes: 0–90 días, 3–6 meses, 6–12 meses y 12–36 meses. También puede mostrar oportunidades priorizadas cuando hay registros y evidencia suficientes.

Cada oportunidad puede incluir una acción, prioridad, causa, oportunidad, plazo, inversión, disponibilidad y recuperación estimada. Si faltan datos para calcular la recuperación, se indica que se requieren valores verificados. Las sugerencias no asignan responsables, no marcan tareas como completadas ni confirman ahorros ejecutados; deben revisarse y validarse por la organización.

## 10. Exportar información

Desde el Resumen puedes descargar:

- **Exportar PDF:** genera `informe-ejecutivo-ambiental.pdf` para el período consultado. Si no hay registros, se muestra un aviso en vez de descargar un informe vacío. Los registros con calidad **Insuficiente** no forman parte de las cifras consolidadas del informe.
- **Datos para Power BI:** genera `datos-ambientales-power-bi.csv` con registros de la empresa para los períodos guardados, no solo el período seleccionado en el Resumen. Incluye período, instalación, módulo, actividad, uso digital reportado, GEI, alcance, fuente, calidad y estado del factor. Si no hay registros, no se genera el archivo.

Al compartir los archivos, verifica que correspondan a la empresa y al período requeridos. Conserva las fuentes originales de los datos para respaldar las cifras exportadas.

## 11. Factores, estados y responsabilidades

Los formularios ofrecen factores y opciones cargados en la biblioteca metodológica. Si la trazabilidad indica un factor pendiente de validación o una regla de respaldo, conserva esa salvedad al interpretar o compartir el resultado; no lo presentes como validado oficialmente ni lo sustituyas por un valor sin fuente.

La creación y actualización de módulos de medición está restringida a cuentas autorizadas por Klimatka. Cada actualización metodológica crea una nueva versión con fuente y fecha de vigencia; las versiones anteriores y los cálculos existentes conservan su trazabilidad. Un factor sin fuente documental no debe tratarse como validado.

## 12. Resolver problemas frecuentes

- **No aparecen resultados:** revisa el año y mes seleccionados y confirma que existan registros para ese período y empresa.
- **No se genera el PDF:** selecciona un período con registros.
- **No se genera el CSV:** verifica que la empresa tenga registros guardados o vuelve a intentar la descarga.
- **No se puede guardar una actividad:** completa los campos obligatorios, selecciona las cinco puntuaciones de calidad y revisa el mensaje de validación.
- **Aparece una advertencia metodológica o un factor pendiente:** consulta **Ver trazabilidad** y conserva la advertencia al interpretar el resultado.
- **No puedes iniciar sesión:** comprueba que uses el correo del perfil. Si no recuerdas la contraseña, utiliza **¿Olvidaste tu contraseña?**.
- **No llega el enlace de recuperación:** revisa el correo no deseado. Si la pantalla informa que la recuperación no está disponible, contacta al equipo administrador.
- **No puedes aceptar una invitación:** verifica que el enlace del correo no haya vencido y que estés usando el mismo correo al que se envió. Solicita una invitación nueva si es necesario.
- **El envío de correos aún no está configurado:** la invitación no se ha enviado. Contacta al equipo que administra el despliegue de Klimatka para habilitar el servicio de correo. En la demostración local las invitaciones son simuladas.
- **No puedes invitar a otra persona o administrar la empresa:** confirma que tu perfil tenga el rol de administradora en esa empresa.
- **No ves una opción metodológica:** la biblioteca y la administración de módulos dependen de los permisos de plataforma.
- **No aparecen intensidades por empleado:** registra la dotación por sede y mes. Para el resultado anual se requiere información de los doce meses.

## Glosario

- **GEI:** gases de efecto invernadero.
- **CO₂e:** unidad equivalente de dióxido de carbono usada para expresar el impacto de gases de efecto invernadero.
- **tCO₂e / kgCO₂e:** toneladas o kilogramos de CO₂ equivalente.
- **Índice DQ:** índice de calidad del dato calculado a partir de cinco dimensiones de evidencia.
- **Factor de emisión:** valor usado junto con una actividad para calcular un resultado ambiental.
- **Regla de respaldo:** alternativa metodológica aplicada cuando corresponde; su uso debe revisarse en la trazabilidad.

---

**Control de actualización:** este manual describe las funciones visibles en la aplicación al momento de su edición. Si cambian las pantallas, los permisos o los procedimientos, actualiza las instrucciones antes de distribuir una nueva edición.
