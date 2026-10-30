import { randomUUID } from 'node:crypto';

export interface ProductPayload {
  code?: unknown;
  name?: unknown;
  description?: unknown;
}

/** Bodegas precargadas en la base de datos (script database/schema.sql de la API). */
export const WAREHOUSES = { BOGOTA: 'BOG', MEDELLIN: 'MED', CALI: 'CAL' } as const;

export const RESPONSIBLE_ID = 'qa-automation';

/**
 * Código único por prueba. La base de datos conserva los datos entre ejecuciones,
 * así que un código fijo fallaría la segunda vez con 409 PRODUCT_CODE_DUPLICATED.
 */
export const uniqueCode = (prefix = 'AUT'): string =>
  `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;

export const buildProduct = (overrides: ProductPayload = {}): ProductPayload => ({
  code: uniqueCode(),
  name: 'Producto de prueba automatizada',
  description: 'Creado por Playwright',
  ...overrides,
});

export const buildAdjustment = (
  productId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  warehouseId: WAREHOUSES.BOGOTA,
  productId,
  quantity: 10,
  reason: 'Ajuste de prueba automatizada',
  responsibleId: RESPONSIBLE_ID,
  ...overrides,
});

export const buildTransfer = (
  productId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  originWarehouseId: WAREHOUSES.BOGOTA,
  destinationWarehouseId: WAREHOUSES.MEDELLIN,
  productId,
  quantity: 10,
  responsibleId: RESPONSIBLE_ID,
  ...overrides,
});
