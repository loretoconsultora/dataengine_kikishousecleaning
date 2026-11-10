# Data Engine · Kiki's House Cleaning

Tablero de inteligencia de negocio de Kiki's House Cleaning (Victoranza Agency × Loreto Consultora).
Next.js en Vercel, datos en Supabase.

## Variables de entorno (Vercel)
| Variable | Tipo |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Config |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Config |
| `SUPABASE_SECRET_KEY` | Secret (todavía no se usa) |

## Base de datos
1. Ejecutar `supabase/schema.sql` una vez en Supabase → SQL Editor.
2. Cargar los datos (ver abajo).
3. Crear usuarios en Authentication → Users y desactivar los registros públicos.

Todas las tablas tienen RLS: solo usuarios con sesión pueden leer y nadie puede escribir desde la app.

## Actualizar los datos
El Excel operativo **no se sube al repositorio**.

```bash
python scripts/etl/build_dataset.py "<ruta al Excel>" data/ 2026-11-10
```

Genera en `data/` (ignorada por git): `visits.csv`, `weekly_marketing.csv`, `meta.csv` y `seed.sql`.

**Privacidad:** no se exportan nombres, teléfonos, direcciones, correos, notas libres (contienen códigos de acceso) ni datos de nómina.
Cada cliente se identifica con un hash de su teléfono.

## Reglas provisionales
Familias de servicio, frecuencia "DND" y fuente del cliente dependen de validaciones pendientes con Kiki's
(documento "Consultas y validaciones"). Están marcadas como PROVISIONAL en el ETL.
