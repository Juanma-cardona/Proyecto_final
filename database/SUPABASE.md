# Desplegar el backend con Supabase

El backend admite `DB_DRIVER=postgres` para usar PostgreSQL de Supabase. La conexión debe usar el **Transaction pooler** porque Vercel ejecuta el backend como funciones serverless.

## Crear el esquema y migrar los datos

1. Crea un proyecto de Supabase.
2. En **SQL Editor**, ejecuta el contenido de [`schema.supabase.sql`](./schema.supabase.sql). El script crea las cuatro tablas y agrega las bodegas BOG, MED y CAL.
3. Si quieres conservar los datos de SQL Server, expórtalos a CSV e impórtalos en Supabase en este orden: `products`, `stock`, `movements`. Las bodegas ya quedan creadas por el script. Importa `products` antes porque `stock` y `movements` tienen claves foráneas.
4. Verifica las cantidades con:

   ```sql
   SELECT warehouse_id, COUNT(*) AS products, SUM(quantity) AS units
   FROM stock
   GROUP BY warehouse_id;
   ```

## Configurar Vercel

1. En Supabase, abre **Connect** y copia la cadena de **Transaction pooler** (puerto `6543`). No uses la conexión directa para las funciones de Vercel.
2. En Vercel, agrega estas variables para **Production**:

   ```text
   DB_DRIVER=postgres
   DATABASE_URL=<cadena Transaction pooler de Supabase>
   ```

3. Si la contraseña contiene caracteres especiales, codifícala para URL antes de insertarla en `DATABASE_URL`. Mantén esa cadena secreta.
4. Haz un nuevo despliegue después de guardar las variables.

El pool local de PostgreSQL usa una conexión por instancia (`PG_POOL_MAX=1`) para no multiplicar conexiones desde Vercel. Supabase recomienda el pooler de transacciones para serverless y advierte que sus proyectos gratuitos pueden pausarse tras una semana de poca actividad; consulta sus límites actuales en el dashboard.
