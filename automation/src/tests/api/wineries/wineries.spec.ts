import { APIResponse } from '@playwright/test';
import { test, expect, createStockedProduct } from '../../../fixtures/api.fixture';
import { WAREHOUSES } from '../../../data/product.data';
import { expectApiError } from '../../../helpers/assertions';
import { findStockItem } from '../../../helpers/stock.helper';
import { getWineries } from '../../../services/wineries.service';

/**
 * Endpoint 3: GET /warehouses/:warehouseId/stock
 */
test.describe('Wineries API - GET /warehouses/:warehouseId/stock', () => {

  test('should return a list of wineries for a given warehouse ID', async ({ request }) => {
    let response!: APIResponse;
    let body;

    await test.step('send request', async () => {
      response = await getWineries(request, 'BOG');
    });

    await test.step('Validate status code', async () => {
      expect(response.status()).toBe(200);
    });

    await test.step('Validate response body', async () => {
      body = await response.json();

      expect(body).toHaveProperty('warehouseName');
      expect(body.warehouseId).toBe('BOG');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(10);
      expect(body.total).toBeGreaterThanOrEqual(0);
      expect(body.totalPages).toBe(Math.ceil(body.total / body.limit));
    });
  });

  for (const warehouseId of Object.values(WAREHOUSES)) {
    test(`should return the stock of the warehouse ${warehouseId}`, async ({ request }) => {
      const response = await getWineries(request, warehouseId);

      expect(response.status()).toBe(200);
      expect((await response.json()).warehouseId).toBe(warehouseId);
    });
  }

  test('should list a product with its stock after loading it', async ({ request, stockedProduct }) => {
    const item = await findStockItem(request, WAREHOUSES.BOGOTA, stockedProduct.id);

    expect(item).toBeDefined();
    expect(item).toMatchObject({
      productId: stockedProduct.id,
      productCode: stockedProduct.code,
      productName: stockedProduct.name,
      quantity: 100,
    });
  });

  test('should paginate the stock', async ({ request, stockedProduct }) => {
    // Se garantiza que BOG tenga al menos 2 productos con stock
    await createStockedProduct(request);
    expect(stockedProduct.id).toBeTruthy();

    await test.step('Validate the first page', async () => {
      const response = await getWineries(request, 'BOG', { page: 1, limit: 1 });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.page).toBe(1);
      expect(body.limit).toBe(1);
      expect(body.data).toHaveLength(1);
      expect(body.total).toBeGreaterThanOrEqual(2);
      expect(body.totalPages).toBe(body.total);
    });

    await test.step('Validate the second page', async () => {
      const response = await getWineries(request, 'BOG', { page: 2, limit: 1 });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.page).toBe(2);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toEqual({
        productId: expect.any(String),
        productCode: expect.any(String),
        productName: expect.any(String),
        quantity: expect.any(Number),
      });
    });
  });

  test('should accept the maximum limit of 100', async ({ request }) => {
    const response = await getWineries(request, 'BOG', { limit: 100 });

    expect(response.status()).toBe(200);
    expect((await response.json()).limit).toBe(100);
  });

  test('should return an empty page when the page is beyond the last one', async ({ request }) => {
    const response = await getWineries(request, 'BOG', { page: 100000, limit: 100 });

    expect(response.status()).toBe(200);
    expect((await response.json()).data).toEqual([]);
  });

  const invalidPagination: Array<[string, Record<string, string>]> = [
    ['page 0', { page: '0' }],
    ['a negative page', { page: '-1' }],
    ['a page that is not a number', { page: 'abc' }],
    ['a decimal page', { page: '1.5' }],
    ['limit 0', { limit: '0' }],
    ['a limit above 100', { limit: '101' }],
    ['a limit that is not a number', { limit: 'abc' }],
  ];

  for (const [label, params] of invalidPagination) {
    test(`should reject ${label}`, async ({ request }) => {
      const response = await getWineries(request, 'BOG', params);

      await expectApiError(response, 400, 'INVALID_PAGINATION');
    });
  }

  test('should answer 404 when the warehouse does not exist', async ({ request }) => {
    const response = await getWineries(request, 'XXX');

    await expectApiError(response, 404, 'WAREHOUSE_NOT_FOUND');
  });
});
