# Plan: Vistas restringidas + Plan de Llamadas mensual

## Parte 1 — Restringir datos visibles para EJECUTIVO

Hoy en `AppContext.restrictDataByRole` ya se filtran `ejecData` y `ejecPendientesData` por su nombre, pero `supData` se deja pasar completo. La pestaña "Base de Datos" entonces les muestra registros de otros.

Cambios:
- En `restrictDataByRole`: para rol `EJECUTIVO` (no super-admin) devolver `restrictedSup: []` para que no vean nada de supervisores en ninguna vista (Base de Datos incluida).
- En `DataTableSection`: cuando el usuario es EJECUTIVO, ocultar el selector de tipo "Supervisores" y forzar el tipo a `ejec_pend` (sus pendientes / plan de llamadas). Dejar solo edición sobre sus propias filas.
- Confirmar que las pestañas visibles para EJECUTIVO siguen siendo solo `ejecutivos2` y `datos` (ya hecho).

## Parte 2 — Plan de Llamadas mensual

Objetivo: cada ejecutivo ve a sus ~45+ clientes pendientes del mes y el sistema le arma un calendario de llamadas (lunes a viernes), editable.

### 2.1 Modelo de datos

Extender los registros de `visitas_ejecutivos_pendientes` con campos nuevos (no rompe nada existente, son opcionales):

- `FECHA_LLAMADA` (string `YYYY-MM-DD`) — día asignado para llamar.
- `FECHA_LLAMADA_ORIGINAL` (string) — primera fecha auto-asignada, para auditoría.
- `MOTIVO_CAMBIO_FECHA` (string) — obligatorio cuando se modifica `FECHA_LLAMADA`.
- `PLAGA` (boolean), `MEJORA_MANTENIMIENTO` (boolean), `MEJORA_LIMPIEZA` (boolean).
- `OBSERVACIONES_LLAMADA` (string) — texto libre adicional, separado de `OBSERVACIONES` original.
- `LLAMADA_REALIZADA` (boolean) — para marcar cuando ya se contactó.
- `FECHA_LLAMADA_REALIZADA` (string) — se autocompleta cuando marcan "realizada".

Agregar estos campos al `interface DataRow` en `src/types/metrics.ts`.

### 2.2 Auto-asignación de días

Nueva utilidad `src/lib/callPlanScheduler.ts`:
- Función `assignCallDates(clients, year, month)` que toma los clientes pendientes del ejecutivo y reparte uniformemente entre los días hábiles (Lun-Vie) del mes seleccionado.
- Estrategia: `clientsPerDay = ceil(total / businessDays)`; ordena clientes alfabéticamente por CLIENTE/SUCURSAL para reparto estable; respeta `FECHA_LLAMADA` ya existente (no la sobrescribe).
- Solo asigna a registros sin `FECHA_LLAMADA`. La función devuelve `{ row, newDate }[]` para persistir solo las que cambiaron.

### 2.3 Nueva vista "Plan de Llamadas"

Componente `src/components/CallPlanSection.tsx`:

- Vista por defecto para ejecutivos (reemplaza `ejecutivos2` como pestaña principal o se agrega al lado — ver sección "Decisiones" abajo).
- Filtra `ejecPendientesData` por el ejecutivo logueado y por el mes/año del filtro global.
- Botón "Generar plan del mes" → corre `assignCallDates` y persiste con `updateRow` por cada cambio.
- Render por **semana** (Lun-Vie), tarjetas/lista agrupadas por `FECHA_LLAMADA`. Cada tarjeta muestra: cliente, sucursal, status actual, checkboxes (Plaga / Mantenimiento / Limpieza), textarea de observaciones, y botón "Marcar llamada realizada".
- Cambio de fecha: botón con `Popover` + `Calendar` (shadcn datepicker, restringido a Lun-Vie del mes actual). Al confirmar nueva fecha pide en un `Dialog` el **motivo** (textarea obligatoria, mínimo 5 caracteres) → guarda `FECHA_LLAMADA`, `MOTIVO_CAMBIO_FECHA` y deja `FECHA_LLAMADA_ORIGINAL` intacta.
- Indicadores rápidos arriba: total de clientes, llamadas pendientes hoy, pendientes esta semana, % avance del mes.

### 2.4 Persistencia

- Reusar `updateRow('ejec_pend', index, field, value)` en `AppContext`. Ya escribe a `visitas_ejecutivos_pendientes` y mantiene `_docId` estable, así que sirve para todos los nuevos campos sin tocar `firestoreService` salvo extender la lista de campos editables si hay validaciones.
- Para guardar varios campos a la vez (ej. nueva fecha + motivo) hacer dos `updateRow` consecutivos o agregar un helper `updateRowFields(type, index, partial)` en `AppContext` + `updateRowFieldsInFirestore` en `firestoreService` que haga un único `updateDoc` con varios campos.

### 2.5 Pestañas / navegación

- Agregar pestaña `'plan'` (label: "Plan de Llamadas", icono `Phone` o `CalendarDays`).
- Para EJECUTIVO, las pestañas visibles pasan a: `plan` (default), `ejecutivos2`, `datos`.
- Para SUPERVISOR/admin la pestaña también queda disponible para revisar planes.

## Decisiones a confirmar antes de codear

1. ¿La nueva pestaña **Plan de Llamadas** reemplaza a "Ejecutivos 2" para los ejecutivos o conviven? (Mi propuesta: conviven; "Ejecutivos 2" sigue siendo la tabla cruda y "Plan de Llamadas" la vista calendario.)
2. ¿La auto-asignación debe distribuir uniformemente por mes o concentrarse en la primera quincena (dejando margen al final para reagendar)?
3. ¿Las casillas Plaga / Mantenimiento / Limpieza son **excluyentes** o se pueden marcar varias al mismo tiempo? (Mi propuesta: múltiples.)
4. ¿Los supervisores deben poder editar los planes de sus ejecutivos o solo verlos en modo lectura?

## Archivos a tocar

- `src/types/metrics.ts` — campos nuevos en `DataRow` y `TabName`.
- `src/context/AppContext.tsx` — `restrictDataByRole` (vaciar sup), default tab, opcional `updateRowFields`.
- `src/lib/firestoreService.ts` — opcional helper multi-campo.
- `src/lib/callPlanScheduler.ts` — **nuevo**.
- `src/components/CallPlanSection.tsx` — **nuevo**.
- `src/components/Header.tsx` — nueva pestaña + filtro de visibilidad por rol.
- `src/components/DataTableSection.tsx` — ocultar tipo Supervisores para EJECUTIVO.
- `src/pages/Index.tsx` — render de `CallPlanSection` cuando `activeTab === 'plan'`.
