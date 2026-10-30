import { APIRequestContext, test as base, expect } from '@playwright/test';
import { buildAdjustment, buildProduct, ProductPayload, WAREHOUSES } from '../data/product.data';
import { createAdjustment } from '../services/stock.service';
import { createProduct } from '../services/products.service';

export interface TestProduct {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

/** Crea un producto nuevo y activo, sin stock en ninguna bodega. */
export async function createTestProduct(
  request: APIRequestContext,
  overrides: ProductPayload = {},
): Promise<TestProduct> {
  const response = await createProduct(request, buildProduct(overrides));
  expect(response.status(), 'creating the test product').toBe(201);
  return await response.json();
}

/** Crea un producto nuevo y le carga stock inicial en una bodega (por defecto 100 en BOG). */
export async function createStockedProduct(
  request: APIRequestContext,
  warehouseId: string = WAREHOUSES.BOGOTA,
  quantity = 100,
): Promise<TestProduct> {
  const product = await createTestProduct(request);

  const response = await createAdjustment(
    request,
    buildAdjustment(product.id, { warehouseId, quantity, reason: 'Initial stock for the test' }),
  );
  expect(response.status(), 'loading the initial stock').toBe(201);

  return product;
}

interface Fixtures {
  /** Producto nuevo y activo, sin stock. */
  product: TestProduct;
  /** Producto nuevo y activo con 100 unidades en la bodega BOG. */
  stockedProduct: TestProduct;
}

/**
 * `test` con datos preparados: cada prueba que pida `product` o `stockedProduct`
 * recibe su propio producto, así las pruebas no se pisan entre sí ni entre ejecuciones.
 */
export const test = base.extend<Fixtures>({
  product: async ({ request }, use) => {
    await use(await createTestProduct(request));
  },
  stockedProduct: async ({ request }, use) => {
    await use(await createStockedProduct(request));
  },
});

export { expect };
