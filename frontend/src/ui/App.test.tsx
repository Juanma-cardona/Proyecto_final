import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import App from './App';
import { server } from '../test-setup';

afterEach(() => cleanup());

function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);
}

describe('BodegasApp', () => {
  it('muestra el stock recibido desde la API', async () => {
    server.use(http.get('/api/v1/warehouses/BOG/stock', () => HttpResponse.json({ warehouseId: 'BOG', warehouseName: 'Bodega Bogotá', data: [{ productId: 'p-1', productCode: 'TOR-001', productName: 'Tornillo de acero', quantity: 42 }], page: 1, limit: 10, total: 1, totalPages: 1 })));
    renderApp('/stock?bodega=BOG&page=1&limit=10');
    expect(await screen.findByText('Tornillo de acero')).toBeInTheDocument();
    expect(screen.getByText('TOR-001')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('presenta la bodega vacía con un mensaje claro', async () => {
    server.use(http.get('/api/v1/warehouses/MED/stock', () => HttpResponse.json({ warehouseId: 'MED', warehouseName: 'Bodega Medellín', data: [], page: 1, limit: 10, total: 0, totalPages: 0 })));
    renderApp('/stock?bodega=MED&page=1&limit=10');
    await waitFor(() => expect(screen.getByText('Esta bodega aún no tiene productos')).toBeInTheDocument());
  });
});
