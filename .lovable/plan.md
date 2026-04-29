## Objetivo

Cambiar el comportamiento de los datos de **Ejecutivos**:

1. **Dejar de sobrescribir** Ejecutivos desde Google Sheets. La fuente de verdad es Firestore.
2. **Restringir la edición** de Ejecutivos: los usuarios solo pueden cambiar el STATUS de `PROGRAMADO` a `ENVIADO` (no editar nombres, clientes, fechas, etc.). Esto evita errores tipográficos que descuadran las metas.
3. **Eliminación inteligente con propagación a meses futuros**: cuando se elimina un registro (cliente dado de baja), poder eliminarlo del mes actual, de un rango de meses, o de "todos los meses futuros" para esa persona/cliente/sucursal.

Los datos de **Supervisores** se quedan igual que hoy (siguen sincronizando desde Google Sheets).

---

## Cambios planeados

### 1. Sincronización: Ejecutivos ya no se trae de Google Sheets

Archivo: `src/context/AppContext.tsx` → `syncFromGoogleSheets`

- Seguir trayendo `supData` desde Google Sheets (igual que ahora).
- Para `ejecData`: **no** llamar a Google Sheets ni hacer `saveEjecData(..., true)`. En su lugar, leer siempre desde Firestore con `fetchVisitasData()` y usar solo el `ejecData` que viene de allí.
- Resultado: cualquier edición/borrado en el sistema se conserva y no se sobrescribe en el siguiente refresh.
- En `googleSheetsService.ts` se puede dejar `fetchCSV(GID_EJECUTIVOS)` sin uso, o eliminar la llamada para ahorrar la descarga.

Nota: la primera vez que se aplique este cambio, los Ejecutivos que ya están en Firestore (gracias a las sincronizaciones previas) se mantienen como base. No se pierde información.

### 2. Edición restringida en la Base de Datos para Ejecutivos

Archivo: `src/components/DataTableSection.tsx`

Cuando `dataType === 'ejec'`:

- **Solo la columna STATUS es editable**, y únicamente con dos opciones en el dropdown: `PROGRAMADO` y `ENVIADO`.
- El resto de columnas (Mes, Ejecutivo, Cliente, Sucursal, Tipo de Visita, Observaciones) se muestran como **solo lectura** (sin cursor de editar, sin lápiz).
- La columna FECHA ya es solo lectura — se queda igual.
- El botón de eliminar (papelera) se reemplaza por el nuevo flujo del punto 3.

Para Supervisores se mantiene la edición libre actual.

### 3. Eliminación con rango de meses (solo Ejecutivos)

Reemplazar el `window.confirm` actual por un **diálogo modal** (componente `Dialog` de shadcn ya disponible) que pregunte al usuario qué quiere eliminar.

Opciones del diálogo:

```text
Eliminar registro de [CLIENTE] – [SUCURSAL] – [EJECUTIVO]

¿De qué meses deseas eliminarlo?
  ( ) Solo este mes ([MES actual del registro])
  ( ) Desde este mes en adelante (todos los meses futuros del año)
  ( ) Rango personalizado:  [Desde: select mes]  [Hasta: select mes]
  ( ) Todo el año

[Cancelar]   [Eliminar]
```

Lógica de borrado:

- Identificar todos los registros en `ejecData` que coincidan en `EJECUTIVO + CLIENTE + SUCURSAL` (normalizados) dentro del año seleccionado y del rango de meses elegido.
- Eliminarlos en lote de Firestore (reusando `deleteRowFromFirestore` por cada uno) y del estado local.
- Mostrar toast con el conteo: `"N registros eliminados de [MES1] a [MES2] ✅"`.

### 4. Servicio de borrado en lote

Archivo: `src/lib/firestoreService.ts`

Añadir `deleteRowsBatchFromFirestore(type, rows[])` que use `writeBatch` y borre hasta 500 docs por batch (igual que `clearCollection`). Esto evita N llamadas individuales cuando el rango cubre varios meses.

Archivo: `src/context/AppContext.tsx`

Añadir `deleteRowsBulk(type, indices[])` que actualiza el estado local (filtra por índice) y llama a la nueva función batch.

### 5. UX y consistencia

- En el botón de cambio de pestaña Ejecutivos en la tabla, añadir un texto pequeño debajo: *"Solo se puede modificar el STATUS (Programado → Enviado). Para eliminar usa el ícono de papelera."*
- Añadir un badge/aviso en la sección Ejecutivos del Dashboard indicando que la fuente es Firestore (opcional).

---

## Detalles técnicos

- `STATUS_OPTIONS` para Ejecutivos se reduce a `['PROGRAMADO', 'ENVIADO']` (constante separada `EJEC_STATUS_OPTIONS`).
- Reusar el helper `cleanString` y `normalizeText` ya existentes para emparejar CLIENTE/SUCURSAL/EJECUTIVO al borrar por rango (evita falsos negativos por mayúsculas/acentos).
- El año del rango es el `yearFilter` activo del contexto.
- El orden de meses se obtiene de `MONTH_NAMES` (ya exportado en `dataProcessing.ts`).
- No se tocan permisos por rol todavía (todos los usuarios autenticados pueden eliminar). Si más adelante quieres restringirlo a admin/supervisor, se puede agregar fácilmente.

## Archivos a modificar

- `src/context/AppContext.tsx` – cortar sync de ejec desde Sheets, añadir `deleteRowsBulk`.
- `src/lib/googleSheetsService.ts` – exportar solo `supData` (o seguir devolviendo ambos pero sin usar ejec).
- `src/lib/firestoreService.ts` – añadir borrado en lote.
- `src/components/DataTableSection.tsx` – edición restringida + nuevo diálogo de borrado por rango.

## Confirmación que necesito antes de implementar

¿La opción "Desde este mes en adelante" debe limitarse al **año actualmente filtrado**, o debe propagarse también a años futuros si existen registros? (Por defecto asumiré: solo el año filtrado.)
