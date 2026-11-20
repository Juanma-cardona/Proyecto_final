export type WarehouseId = 'BOG' | 'MED' | 'CAL';
export const warehouses: { id: WarehouseId; name: string; city: string }[] = [
  { id: 'BOG', name: 'Bodega Bogotá', city: 'Bogotá' },
  { id: 'MED', name: 'Bodega Medellín', city: 'Medellín' },
  { id: 'CAL', name: 'Bodega Cali', city: 'Cali' },
];
export type Product = { id: string; code: string; name: string; description: string | null; active: boolean; createdAt: string };
export type StockRow = { productId: string; productCode: string; productName: string; quantity: number };
export type StockPage = { warehouseId: string; warehouseName: string; data: StockRow[]; page: number; limit: number; total: number; totalPages: number };
export type Adjustment = { movementId: string; warehouseId: string; productId: string; type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'; quantity: number; previousBalance: number; newBalance: number; reason: string; responsibleId: string; createdAt: string };
export type Transfer = { transferId: string; productId: string; quantity: number; responsibleId: string; origin: { warehouseId: string; newBalance: number }; destination: { warehouseId: string; newBalance: number }; createdAt: string };

const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const messages: Record<string, string> = {
  PRODUCT_CODE_REQUIRED: 'El código del producto es obligatorio.', PRODUCT_NAME_REQUIRED: 'El nombre del producto es obligatorio.', PRODUCT_CODE_DUPLICATED: 'Ya existe un producto con ese código.', INVALID_STATUS: 'Estado no válido.', PRODUCT_NOT_FOUND: 'Producto no encontrado. Revisa el ID.', WAREHOUSE_NOT_FOUND: 'La bodega no existe.', INVALID_QUANTITY: 'La cantidad debe ser un número entero válido.', REASON_REQUIRED: 'El motivo debe tener al menos 5 caracteres.', RESPONSIBLE_REQUIRED: 'El responsable es obligatorio.', INSUFFICIENT_STOCK: 'Stock insuficiente en la bodega.', PRODUCT_INACTIVE: 'El producto está inactivo y no admite ajustes ni transferencias.', SAME_WAREHOUSE: 'La bodega de origen y la de destino deben ser distintas.', INVALID_PAGINATION: 'Paginación no válida.', VALIDATION_ERROR: 'Los datos enviados no son válidos.', BAD_REQUEST: 'Los datos enviados no son válidos.', INTERNAL_SERVER_ERROR: 'Ocurrió un error en el servidor. Inténtalo de nuevo.',
};
export class ApiError extends Error {
  code: string;
  field: string | undefined;
  constructor(code: string, field?: string) { super(messages[code] || (code === 'NETWORK_ERROR' ? 'No se pudo conectar con el servidor.' : 'No se pudo completar la solicitud.')); this.code = code; this.field = field; }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } }); }
  catch { throw new ApiError('NETWORK_ERROR'); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ code: 'INTERNAL_SERVER_ERROR' })) as { code?: string };
    const code = body.code || 'INTERNAL_SERVER_ERROR';
    const fieldMap: Record<string, string> = { PRODUCT_CODE_REQUIRED: 'code', PRODUCT_CODE_DUPLICATED: 'code', PRODUCT_NAME_REQUIRED: 'name', PRODUCT_NOT_FOUND: 'productId', PRODUCT_INACTIVE: 'productId', WAREHOUSE_NOT_FOUND: 'warehouseId', INVALID_QUANTITY: 'quantity', INSUFFICIENT_STOCK: 'quantity', SAME_WAREHOUSE: 'destinationWarehouseId', REASON_REQUIRED: 'reason', RESPONSIBLE_REQUIRED: 'responsibleId' };
    throw new ApiError(code, fieldMap[code]);
  }
  return response.json() as Promise<T>;
}
export const api = {
  stock: (warehouse: WarehouseId, page: number, limit: number) => request<StockPage>(`/warehouses/${warehouse}/stock?page=${page}&limit=${limit}`),
  createProduct: (data: { code: string; name: string; description?: string }) => request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  setProductStatus: (id: string, active: boolean) => request<Product>(`/products/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  adjustment: (data: { warehouseId: string; productId: string; quantity: number; reason: string; responsibleId: string }) => request<Adjustment>('/stock/adjustments', { method: 'POST', body: JSON.stringify(data) }),
  transfer: (data: { originWarehouseId: string; destinationWarehouseId: string; productId: string; quantity: number; responsibleId: string }) => request<Transfer>('/transfers', { method: 'POST', body: JSON.stringify(data) }),
};
export const formatNumber = (n: number) => new Intl.NumberFormat('es-CO').format(n);
export const formatDate = (value: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const errorText = (error: unknown) => error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';
