
# Plan: Nueva pestaña "Ejecutivos 2" (Pendientes sin mes)

## Objetivo

Crear una segunda vista de Ejecutivos que muestre **solo los registros con STATUS = PROGRAMADO y columna MES vacía**. Esta vista tendrá su propia copia de los datos en Firestore (backup independiente) para que las ediciones (PROGRAMADO → ENVIADO) no afecten la base original de Ejecutivos.

## Cómo entiendo el caso

- Hoy "Ejecutivos" muestra todos los registros del Excel (PROGRAMADO + ENVIADO + lo que tengan).
- Quieres una vista paralela "Ejecutivos 2" idéntica visualmente (KPIs, tarjetas de meta, gráficas, tabla editable) pero filtrada únicamente a las **metas pendientes sin mes** (PROGRAMADO + MES vacío).
- Esta vista debe trabajar sobre una **copia separada** en Firestore. Cuando se sincronice desde Google Sheets, copiamos a esa colección **solo los registros PROGRAMADOS sin mes**.
- A medida que el usuario cambie un registro a ENVIADO en esta vista, se actualiza solo en esta copia (no toca la colección original `visitas_ejecutivos`).

## Cambios

### 1. Backend (Firestore)
- Nueva colección: `visitas_ejecutivos_pendientes`.
- En `src/lib/firestoreService.ts`:
  - Agregar `saveEjecPendientesData(data, replace)` y constante `COLLECTION_EJEC_PENDIENTES`.
  - Extender `fetchVisitasData()` para que también devuelva `ejecPendientesData`.
  - Extender `updateRowInFirestore`, `deleteRowFromFirestore`, `deleteRowsBatchFromFirestore` para aceptar el tipo `'ejec_pend'`.

### 2. Estado global (`src/context/AppContext.tsx`)
- Añadir `ejecPendientesData: DataRow[]` al estado.
- En `syncFromGoogleSheets`:
  - Después de traer Supervisores de Google Sheets, filtrar:
    ```
    pendientes = supDataOriginalEjec.filter(r =>
      isProgrammed(r.STATUS) && !String(r.MES || '').trim()
    )
    ```
  - **Origen de la copia**: la vista de Ejecutivos hoy se alimenta de Firestore (decoupled). La copia de "Ejecutivos 2" se generará a partir de **`ejecData` de Firestore** filtrando PROGRAMADO + MES vacío, y se guardará en `visitas_ejecutivos_pendientes` solo si la colección está vacía (primera carga). En cargas posteriores, si ya existe contenido en la colección de pendientes, se respeta (igual que hoy con Ejecutivos) para no perder los cambios PROGRAMADO → ENVIADO.
- Exponer `updateEjecPendienteRow`, `deleteEjecPendienteRow`, `deleteEjecPendientesBulk`.

### 3. UI - Nueva pestaña
- En `src/types/metrics.ts`: agregar `'ejecutivos2'` a `TabName`.
- En `src/components/Header.tsx`: nueva tab "Ejecutivos 2" (icono `ClipboardList`), visible solo si `ejecPendientesData.length > 0`.
- En `src/pages/Index.tsx`: rutear `activeTab === 'ejecutivos2'` a un nuevo componente.

### 4. Componente de dashboard
- Reutilizar `DashboardSection` parametrizado. Hoy acepta `type: 'SUPERVISOR' | 'EJECUTIVO'` y elige `supData`/`ejecData` desde el contexto.
- Agregar un tercer modo `type: 'EJECUTIVO_PENDIENTE'` que tome `ejecPendientesData`. Las gráficas, KPIs y tarjetas de meta funcionan igual (mismo shape de `DataRow`).
- Título: "📋 Ejecutivos - Metas Pendientes (sin mes)".

### 5. Tabla editable
- Extender `DataTableSection` con un tercer modo `'ejec_pend'` (botón en el switch de tipo, junto a Supervisores/Ejecutivos), o crear un componente delgado que reutilice la lógica.
- Reglas de edición iguales a Ejecutivos: solo STATUS editable, opciones `['PROGRAMADO', 'ENVIADO']`.
- Al cambiar a ENVIADO, el registro permanece en la colección de pendientes (queda como histórico de "ya enviado") — o se puede mover/eliminar. **Decisión propuesta**: mantenerlo visible para que se vea el progreso; el filtro PROGRAMADO/ENVIADO ya existe en la tabla.

## Detalle técnico

**Filtro de copia (regla única):**
```typescript
const esPendiente = (r: DataRow) =>
  isProgrammed(r.STATUS) &&
  !String(r.MES || '').trim();
```

**Flujo de sincronización:**
```
Google Sheets → supData (Firestore)
Firestore visitas_ejecutivos → ejecData (sin tocar)
Firestore visitas_ejecutivos_pendientes → ejecPendientesData
  ↳ si está vacío en primera ejecución: poblar desde ejecData.filter(esPendiente)
```

**Independencia**: editar un registro en "Ejecutivos 2" actualiza solo `visitas_ejecutivos_pendientes`. La colección `visitas_ejecutivos` original queda intacta.

## Archivos a modificar
- `src/types/metrics.ts`
- `src/lib/firestoreService.ts`
- `src/context/AppContext.tsx`
- `src/components/Header.tsx`
- `src/pages/Index.tsx`
- `src/components/DashboardSection.tsx`
- `src/components/DataTableSection.tsx`

## Pregunta antes de implementar

Cuando un registro pasa de **PROGRAMADO → ENVIADO** en "Ejecutivos 2", ¿qué prefieres?
- (A) Que se quede visible en Ejecutivos 2 (marcado ENVIADO) para ver el avance.
- (B) Que desaparezca de Ejecutivos 2 (se elimine de esa colección) ya que dejó de ser "pendiente".

Si no respondes, asumo **(A)** por defecto.
