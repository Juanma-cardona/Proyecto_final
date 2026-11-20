# BodegasApp · Frontend

Interfaz React para la API de inventario de este repositorio. El backend permanece en la raíz y no requiere cambios para servir estas pantallas.

## Requisitos y ejecución

Se requiere Node.js 20 o superior y npm.

```bash
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Vite sirve la aplicación en `http://localhost:5173` y reenvía `/api` a `http://localhost:3000`. En otra terminal, desde la raíz, inicia la API con `npm run dev`. Se puede cambiar `API_PROXY_TARGET` para otro host/puerto. `VITE_API_BASE_URL` acepta otra base (por defecto `/api/v1`).

Comandos disponibles dentro de `frontend/`:

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
npm test
```

## Supuestos

- La API no ofrece listado de productos ni de responsables; la búsqueda se limita a productos creados en esta sesión de navegador y el identificador del responsable se escribe manualmente.
- Los productos guardados en `localStorage` se comparten entre las pantallas de esta aplicación y sobreviven a recargas, pero no representan un catálogo completo del servidor.
- El backend devuelve los errores con `code`; el frontend muestra mensajes en español mapeados a los códigos especificados.
- La selección de bodega, página y filas por página se guarda en la consulta URL en la pantalla de stock.
- El ZIP de Stitch incluye diseños de escritorio y móvil; se siguieron su paleta Andes Logistics Grid, jerarquía, códigos monoespaciados, superficies claras y adaptación de navegación. Los indicadores, actividad reciente, KPI, perfiles y acciones decorativas presentes en algunos mockups no se implementaron porque requieren datos o comportamiento que no existe en los endpoints especificados. Las operaciones y saldos se presentan solo con la respuesta real de la API.
- Se usa tipografía Inter y JetBrains Mono desde Google Fonts; si no hay conexión, el navegador recurre a fuentes locales sans-serif/monoespaciadas.

## Pasos y commits sugeridos

1. `chore: configura frontend y cliente de API`
2. `feat: agrega layout y navegación de inventario`
3. `feat: implementa consulta de stock por bodega`
4. `feat: implementa catálogo local de productos`
5. `feat: agrega ajustes de inventario`
6. `feat: agrega transferencias entre bodegas`
7. `test: valida pantallas y pule estados de interfaz`

No se crearon commits ni se hizo push.
