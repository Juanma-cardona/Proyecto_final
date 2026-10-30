# Pruebas automatizadas con Playwright - API de gestión de bodegas

Pruebas de la API REST (los 5 endpoints) con Playwright.

## Antes de ejecutar
1. Arranca la API (en el proyecto de la API): `npm run dev`. Debe decir `Connected to SQL Server`.
2. En esta carpeta: `npm install`.
3. Copia `.env.example` como `.env` y revisa `BASE_URL` (por defecto `http://localhost:3000/api/`).
   La URL debe terminar en `/`.

## Ejecutar
| Comando | Qué hace |
|---|---|
| `npm run test:api` | Corre las pruebas de la API |
| `npm run report` | Abre el reporte HTML de la última ejecución |
| `npm run test:ui` | Abre el modo interactivo de Playwright |

## Estructura
```
src/
├── data/        Datos de prueba (productos con código único, ajustes, transferencias)
├── fixtures/    Datos ya preparados: `product` (sin stock) y `stockedProduct` (100 en BOG)
├── helpers/     Validación de errores de la API y lectura del stock
├── services/    Una función por endpoint (reciben la petición y devuelven la respuesta)
└── tests/api/
    ├── products/    POST /products y PATCH /products/:id/status
    ├── wineries/    GET /warehouses/:warehouseId/stock
    ├── stock/       POST /stock/adjustments
    └── transfers/   POST /transfers
```

## Cómo están escritas las pruebas
- Cada prueba crea sus propios productos con un código único, porque la base de datos conserva los datos entre ejecuciones.
- Las pruebas de errores validan el código HTTP y el código de negocio (por ejemplo `INSUFFICIENT_STOCK`).
- Las pruebas de transferencias y ajustes consultan el stock después para comprobar que el cambio realmente ocurrió.
