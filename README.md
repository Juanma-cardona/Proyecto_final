# Documentación del proyecto final

[![CI](https://github.com/Juanma-cardona/Proyecto_final/actions/workflows/ci.yml/badge.svg)](https://github.com/Juanma-cardona/Proyecto_final/actions/workflows/ci.yml)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=Juanma-cardona_Proyecto_final&metric=alert_status)](https://sonarcloud.io/summary/overall?id=Juanma-cardona_Proyecto_final)

## Enlaces

| Recurso | Enlace / estado |
|---|---|
| Repositorio GitHub | [Juanma-cardona/Proyecto_final](https://github.com/Juanma-cardona/Proyecto_final) |
| Aplicación web | [Abrir BodegasApp](https://proyecto-final-two-beige.vercel.app/) |
| Análisis SonarCloud | [Resumen del proyecto](https://sonarcloud.io/summary/overall?id=Juanma-cardona_Proyecto_final) |
| Pipeline CI | [GitHub Actions](https://github.com/Juanma-cardona/Proyecto_final/actions/workflows/ci.yml) |

## Estado actual de SonarCloud

La captura más reciente muestra **2 condiciones fallidas en New Code**. La imagen resume esas métricas; el [panel de SonarCloud](https://sonarcloud.io/summary/overall?id=Juanma-cardona_Proyecto_final) refleja el análisis publicado más reciente.

| Métrica | Resultado de la captura |
|---|---:|
| Condición | Resultado | Requisito |
|---|---:|---:|
| Cobertura de código nuevo | 55.77% (368 líneas) | ≥ 80.0% |
| Líneas duplicadas nuevas | 8.96% (3k líneas) | ≤ 3.0% |
| Issues nuevos / aceptados | 0 / 0 | — |
| Security hotspots | 0 | — |

Estos valores provienen de la captura más reciente compartida y pueden cambiar después del siguiente análisis.

## Componentes del proyecto

- **API** (`src/`): servicio REST con Express y TypeScript para productos, existencias, ajustes y transferencias entre las bodegas BOG, MED y CAL.
- **Interfaz web** (`frontend/`): aplicación React y Vite para consultar existencias y gestionar productos y movimientos.
- **Pruebas de API** (`automation/`): pruebas de integración con Playwright. Requieren una API accesible y una base de datos configurada.
- **Base de datos** (`database/`): scripts y configuración de persistencia.

## Pipeline de integración continua

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) se ejecuta en pushes a `main` o `master` y en Pull Requests. Compila la API, ejecuta sus pruebas con cobertura, valida los tipos y el estilo del frontend, compila la interfaz y corre sus pruebas unitarias. También envía el análisis a SonarCloud mediante el secreto `SONAR_TOKEN` del repositorio.

Las pruebas Playwright de `automation/` no se ejecutan en CI porque requieren una API y una base de datos de integración. Sus instrucciones están en [`automation/README.md`](automation/README.md).

## Ejecución local

Instala las dependencias de la API y del frontend:

```bash
npm ci
cd frontend
npm ci
npm run dev
```

En otra terminal, desde la raíz del repositorio, ejecuta `npm run dev` para iniciar la API. La interfaz queda en `http://localhost:5173` y la API en `http://localhost:3000`. Revisa [`.env.example`](.env.example) y [`frontend/.env.example`](frontend/.env.example) para los valores locales; no publiques credenciales.

# API de Gestión de Bodegas (3 bodegas)

API REST para controlar el inventario de una distribuidora con **tres bodegas físicas** (propuesta 2 del curso de Pruebas de Software). Permite crear productos, consultar el stock por bodega, hacer ajustes manuales con justificación y transferir mercancía entre bodegas, garantizando que **el stock nunca quede negativo** y dejando registro de cada movimiento.

> **Alcance de esta entrega:** 5 endpoints + pruebas unitarias con Vitest. El backend puede usar almacenamiento en memoria, SQL Server o PostgreSQL/Supabase según `DB_DRIVER`.

---

## Contenido
1. [Tecnologías](#tecnologías)
2. [Requisitos previos](#requisitos-previos)
3. [Instalación y ejecución](#instalación-y-ejecución)
4. [Endpoints](#endpoints)
5. [Reglas de negocio](#reglas-de-negocio)
6. [Formato de errores y códigos](#formato-de-errores-y-códigos)
7. [Pruebas unitarias](#pruebas-unitarias)
8. [Arquitectura y estructura del proyecto](#arquitectura-y-estructura-del-proyecto)
9. [Flujo de trabajo con Git](#flujo-de-trabajo-con-git)
10. [Limitaciones conocidas](#limitaciones-conocidas)

---

## Tecnologías

| Herramienta | Uso |
|---|---|
| Node.js + TypeScript | Lenguaje y entorno de ejecución |
| Express 5 | Servidor HTTP y rutas |
| Awilix | Inyección de dependencias |
| Vitest | Pruebas unitarias y cobertura |
| tsx | Ejecución en desarrollo (recarga automática) |

## Requisitos previos
- Node.js 20 o superior
- npm

## Instalación y ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar el servidor en modo desarrollo
npm run dev
```

El servidor queda disponible en `http://localhost:3000`. Para usar otro puerto, defina la variable de entorno `PORT`.

### Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor en desarrollo con recarga automática |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Ejecuta la versión compilada (`dist/main.js`) |
| `npm test` | Corre todas las pruebas una vez |
| `npm run test:watch` | Pruebas en modo observador |
| `npm run test:coverage` | Pruebas con reporte de cobertura (`coverage/index.html`) |

---

## Endpoints

URL base: `http://localhost:3000/api/v1`

| # | Método | Ruta | Descripción |
|---|--------|------|-------------|
| 1 | POST | `/products` | Crear producto |
| 2 | PATCH | `/products/:id/status` | Activar o desactivar un producto |
| 3 | GET | `/warehouses/:warehouseId/stock` | Consultar el stock de una bodega (paginado) |
| 4 | POST | `/stock/adjustments` | Ajuste manual de stock con justificación |
| 5 | POST | `/transfers` | Transferir stock entre bodegas |

**Bodegas precargadas:** `BOG` (Bogotá), `MED` (Medellín) y `CAL` (Cali). Pueden cambiarse en `src/repositories/in-memory/warehouse.repository.ts`.

### 1. Crear producto — `POST /products`

Crea un producto activo. El código es obligatorio y único; se normaliza (se quitan espacios y se pasa a mayúsculas).

**Body**
```json
{ "code": "TOR-001", "name": "Tornillo 1/4", "description": "Caja x100" }
```
`description` es opcional.

**Respuesta `201 Created`**
```json
{
  "id": "4b95fbfa-e9e8-4230-bde8-c0528ac37f19",
  "code": "TOR-001",
  "name": "Tornillo 1/4",
  "description": "Caja x100",
  "active": true,
  "createdAt": "2026-10-14T15:30:00.000Z"
}
```

### 2. Activar / desactivar producto — `PATCH /products/:id/status`

**Body**
```json
{ "active": false }
```

**Respuesta `200 OK`:** el producto con el campo `active` actualizado.

### 3. Stock por bodega — `GET /warehouses/:warehouseId/stock`

Parámetros de consulta opcionales:

| Parámetro | Por defecto | Regla |
|---|---|---|
| `page` | `1` | Entero ≥ 1 |
| `limit` | `10` | Entero entre 1 y 100 |

Ejemplo: `GET /warehouses/BOG/stock?page=1&limit=10`

**Respuesta `200 OK`**
```json
{
  "warehouseId": "BOG",
  "warehouseName": "Bodega Bogotá",
  "data": [
    { "productId": "4b95fbfa-...", "productCode": "TOR-001", "productName": "Tornillo 1/4", "quantity": 30 }
  ],
  "page": 1,
  "limit": 10,
  "total": 1,
  "totalPages": 1
}
```

### 4. Ajuste manual — `POST /stock/adjustments`

`quantity` es un **delta con signo**: positivo suma al stock y negativo resta. No puede ser 0.

**Body**
```json
{
  "warehouseId": "BOG",
  "productId": "4b95fbfa-e9e8-4230-bde8-c0528ac37f19",
  "quantity": 50,
  "reason": "Carga inicial",
  "responsibleId": "u1"
}
```

**Respuesta `201 Created`**
```json
{
  "movementId": "9f1c...",
  "warehouseId": "BOG",
  "productId": "4b95fbfa-...",
  "type": "ADJUSTMENT_IN",
  "quantity": 50,
  "previousBalance": 0,
  "newBalance": 50,
  "reason": "Carga inicial",
  "responsibleId": "u1",
  "createdAt": "2026-10-14T15:31:00.000Z"
}
```
`type` es `ADJUSTMENT_IN` si se sumó y `ADJUSTMENT_OUT` si se restó (en ese caso `quantity` se devuelve en positivo).

### 5. Transferencia entre bodegas — `POST /transfers`

**Body**
```json
{
  "originWarehouseId": "BOG",
  "destinationWarehouseId": "MED",
  "productId": "4b95fbfa-e9e8-4230-bde8-c0528ac37f19",
  "quantity": 20,
  "responsibleId": "u1"
}
```

**Respuesta `201 Created`**
```json
{
  "transferId": "c2a7...",
  "productId": "4b95fbfa-...",
  "quantity": 20,
  "responsibleId": "u1",
  "origin": { "warehouseId": "BOG", "newBalance": 30 },
  "destination": { "warehouseId": "MED", "newBalance": 20 },
  "createdAt": "2026-10-14T15:32:00.000Z"
}
```

---

## Reglas de negocio

**Productos**
- El código es obligatorio, se normaliza (trim + mayúsculas) y es **único**.
- El nombre es obligatorio.
- Un producto nuevo siempre nace activo.
- Un producto **inactivo** no admite ajustes ni transferencias.

**Stock**
- El stock es **independiente por bodega**.
- **No se permite stock negativo**, ni en ajustes ni en transferencias.
- Es válido dejar el stock exactamente en 0.
- Las cantidades deben ser enteros.

**Ajustes manuales**
- Exigen **justificación** (mínimo 5 caracteres) y **responsable**.
- La cantidad no puede ser 0.

**Transferencias**
- Origen y destino deben ser distintos y existir.
- La cantidad debe ser un entero mayor que 0.
- Se valida que el origen tenga **disponibilidad suficiente**.
- Se registra origen, destino y **responsable** (obligatorio).

**Kardex (auditoría)**
- Cada ajuste y cada transferencia genera movimientos con el saldo posterior: `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`. Una transferencia genera dos movimientos (salida y entrada) con el mismo `transferId`.

**Consultas**
- La paginación es obligatoria (valores por defecto `page=1`, `limit=10`; máximo 100).

---

## Formato de errores y códigos

Todos los errores de negocio responden con esta forma:

```json
{ "code": "INSUFFICIENT_STOCK", "message": "Insufficient stock: the operation would leave negative stock" }
```

| HTTP | Código | Cuándo ocurre |
|---|---|---|
| 400 | `PRODUCT_CODE_REQUIRED` | Falta el código del producto o está vacío |
| 400 | `PRODUCT_NAME_REQUIRED` | Falta el nombre del producto o está vacío |
| 400 | `INVALID_STATUS` | `active` no es un booleano |
| 400 | `INVALID_QUANTITY` | Cantidad no entera, ausente, 0 en ajuste, o ≤ 0 en transferencia |
| 400 | `REASON_REQUIRED` | La justificación falta o tiene menos de 5 caracteres |
| 400 | `RESPONSIBLE_REQUIRED` | Falta el responsable |
| 400 | `SAME_WAREHOUSE` | Origen y destino son la misma bodega |
| 400 | `INVALID_PAGINATION` | `page` o `limit` fuera de rango o no numéricos |
| 400 | `BAD_REQUEST` | JSON mal formado u otro error 4xx de Express |
| 404 | `PRODUCT_NOT_FOUND` | El producto no existe |
| 404 | `WAREHOUSE_NOT_FOUND` | La bodega no existe |
| 409 | `PRODUCT_CODE_DUPLICATED` | Ya existe un producto con ese código |
| 422 | `PRODUCT_INACTIVE` | El producto está inactivo |
| 422 | `INSUFFICIENT_STOCK` | La operación dejaría el stock negativo |
| 500 | `INTERNAL_SERVER_ERROR` | Error inesperado |

Las definiciones están en `src/exceptions/errors/app.error.ts`.

### Orden de validación
Las validaciones de formato (cantidad, justificación, responsable) se ejecutan **antes** de consultar bodegas y productos. Después se verifica la existencia de la bodega y del producto, luego que el producto esté activo y, por último, la disponibilidad de stock.

---

## Pruebas unitarias

Las pruebas están escritas con **Vitest**. Los repositorios se reemplazan por **mocks**, por lo que no necesitan base de datos ni servidor.

```bash
npm test                # una ejecución
npm run test:watch      # modo observador
npm run test:coverage   # cobertura (abre coverage/index.html)
```

**Qué se prueba**

| Capa | Archivo | Qué cubre |
|---|---|---|
| Servicios | `test/services/*.spec.ts` | Todas las reglas de negocio: casos exitosos, validaciones, límites (stock en 0, `limit` 100 vs 101, justificación de 5 caracteres) y que no se escriba nada cuando hay error |
| Controladores | `test/controllers/*.spec.ts` | Códigos de estado (200/201), conversión de parámetros de consulta y propagación de errores |
| Middleware | `test/middlewares/error.middleware.spec.ts` | Mapeo de `AppException`, errores 4xx de Express y errores 500 |
| Repositorios | `test/repositories/*.spec.ts` | Guardado, búsqueda, aislamiento por bodega y paginación |

La carpeta `test/helpers` contiene los mocks y fixtures reutilizables.

---

## Arquitectura y estructura del proyecto

Arquitectura en capas. Cada capa solo conoce a la siguiente:

```
Ruta → Controller → Service → Repository → (datos en memoria)
                 (reglas de negocio)   (guardar / leer)
```

```
src/
├── main.ts                  # Arranque del servidor
├── server.ts                # Configuración de Express
├── config/
│   └── container.ts         # Registro de dependencias (Awilix)
├── routes/v1/               # Definición de las 5 rutas
├── controllers/             # Reciben la petición HTTP y responden
├── services/                # Reglas de negocio
│   └── interfaces/
├── repositories/
│   ├── interfaces/          # Contratos (qué operaciones existen)
│   └── in-memory/           # Implementación actual en memoria
├── entities/                # Product, Warehouse, StockItem, Movement
├── dto/                     # Formas de las peticiones y respuestas
├── exceptions/              # AppException y catálogo de errores
├── middlewares/             # Manejo global de errores
└── types/                   # Extensión de tipos de Express

test/
├── helpers/                 # Mocks y fixtures
├── services/
├── controllers/
├── middlewares/
└── repositories/
```

**Por qué esta separación:** al ser los repositorios interfaces, para pasar a una base de datos real basta con crear nuevas implementaciones (por ejemplo `PostgresProductRepository`) y registrarlas en `config/container.ts`, sin tocar servicios ni controladores. Además permite probar la lógica de negocio con mocks.

---

## Flujo de trabajo con Git

Se trabaja con ramas por funcionalidad y Pull Requests hacia `main`, con mensajes de commit tipo `feat:`, `test:`, `fix:`, `refactor:` y `chore:`.

| Rama | Contenido |
|---|---|
| `main` | Configuración base y código estable |
| `feature/endpoints` | Entidades, repositorios, servicios, controladores y rutas |
| `feature/tests` | Pruebas unitarias |

---

## Limitaciones conocidas
- **Persistencia en memoria:** al reiniciar el servidor (incluido el reinicio automático de `npm run dev` al guardar un archivo) se pierden todos los datos.
- **Sin autenticación ni roles:** la API es abierta. El responsable de cada operación se recibe en el body (`responsibleId`) y no se verifica contra un usuario real.
- **Sin transacciones:** al ser en memoria no aplica, pero con una base de datos real las escrituras de una transferencia deben ejecutarse en una sola transacción.
- **Validación de tipos incompleta:** si los campos de texto llegan con otro tipo (por ejemplo `"code": 123`) o la petición no trae cuerpo, la API responde 500 en lugar de 400.
- **Fuera de alcance por ahora:** consulta de kardex, reportes, documentación Swagger, Docker y despliegue.
