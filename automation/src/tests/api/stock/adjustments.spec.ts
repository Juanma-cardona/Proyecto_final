import { APIResponse } from '@playwright/test';
import { test, expect } from '../../../fixtures/api.fixture';
import { buildAdjustment, WAREHOUSES, RESPONSIBLE_ID } from '../../../data/product.data';
import { expectApiError } from '../../../helpers/assertions';
import { getBalance } from '../../../helpers/stock.helper';
import { setProductStatus } from '../../../services/products.service';
import { createAdjustment } from '../../../services/stock.service';

/**
 * Endpoint 4: POST /stock/adjustments
 */
test.describe('POST /stock/adjustments - manual stock adjustment', () => {

  test('should add stock with a positive quantity', async ({ request, product }) => {
    let response!: APIResponse;

    await test.step('Send an adjustment of +25', async () => {
      response = await createAdjustment(
        request,
        buildAdjustment(product.id, { quantity: 25, reason: 'Conteo físico inicial' }),
      );
    });

    await test.step('Validate status code', async () => {
      expect(response.status()).toBe(201);
    });

    await test.step('Validate response body', async () => {
      const body = await response.json();

      expect(body.movementId).toEqual(expect.any(String));
      expect(body.type).toBe('ADJUSTMENT_IN');
      expect(body.warehouseId).toBe(WAREHOUSES.BOGOTA);
      expect(body.productId).toBe(product.id);
      expect(body.quantity).toBe(25);
      expect(body.previousBalance).toBe(0);
      expect(body.newBalance).toBe(25);
      expect(body.reason).toBe('Conteo físico inicial');
      expect(body.responsibleId).toBe(RESPONSIBLE_ID);
      expect(new Date(body.createdAt).toString()).not.toBe('Invalid Date');
    });
  });

  test('should remove stock with a negative quantity', async ({ request, stockedProduct }) => {
    const response = await createAdjustment(request, buildAdjustment(stockedProduct.id, { quantity: -30 }));

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.type).toBe('ADJUSTMENT_OUT');
    expect(body.quantity).toBe(30); // la cantidad del movimiento siempre es positiva
    expect(body.previousBalance).toBe(100);
    expect(body.newBalance).toBe(70);
  });

  test('should chain the balances of consecutive adjustments', async ({ request, product }) => {
    const first = await createAdjustment(request, buildAdjustment(product.id, { quantity: 10 }));
    const second = await createAdjustment(request, buildAdjustment(product.id, { quantity: 5 }));

    expect((await first.json()).newBalance).toBe(10);

    const body = await second.json();
    expect(body.previousBalance).toBe(10);
    expect(body.newBalance).toBe(15);
  });

  test('should reflect the adjustment in the warehouse stock', async ({ request, stockedProduct }) => {
    await test.step('Remove 40 units', async () => {
      const response = await createAdjustment(request, buildAdjustment(stockedProduct.id, { quantity: -40 }));
      expect(response.status()).toBe(201);
    });

    await test.step('Read the stock of the warehouse', async () => {
      expect(await getBalance(request, WAREHOUSES.BOGOTA, stockedProduct.id)).toBe(60);
    });
  });

  test('should keep the stock of each warehouse independent', async ({ request, stockedProduct }) => {
    expect(await getBalance(request, WAREHOUSES.BOGOTA, stockedProduct.id)).toBe(100);
    expect(await getBalance(request, WAREHOUSES.MEDELLIN, stockedProduct.id)).toBe(0);
    expect(await getBalance(request, WAREHOUSES.CALI, stockedProduct.id)).toBe(0);
  });

  test('should allow removing all the stock', async ({ request, stockedProduct }) => {
    const response = await createAdjustment(request, buildAdjustment(stockedProduct.id, { quantity: -100 }));

    expect(response.status()).toBe(201);
    expect((await response.json()).newBalance).toBe(0);
  });

  test('should reject an adjustment that would leave negative stock', async ({ request, stockedProduct }) => {
    await test.step('Try to remove one unit more than available', async () => {
      const response = await createAdjustment(request, buildAdjustment(stockedProduct.id, { quantity: -101 }));

      await expectApiError(response, 422, 'INSUFFICIENT_STOCK');
    });

    await test.step('Validate the stock did not change', async () => {
      expect(await getBalance(request, WAREHOUSES.BOGOTA, stockedProduct.id)).toBe(100);
    });
  });

  test('should reject removing stock from a product that has none', async ({ request, product }) => {
    const response = await createAdjustment(request, buildAdjustment(product.id, { quantity: -1 }));

    await expectApiError(response, 422, 'INSUFFICIENT_STOCK');
  });

  const invalidQuantities: Array<[string, unknown]> = [
    ['zero', 0],
    ['a decimal', 1.5],
    ['text', '5'],
    ['null', null],
    ['missing', undefined],
  ];

  for (const [label, quantity] of invalidQuantities) {
    test(`should reject a quantity that is ${label}`, async ({ request, product }) => {
      const response = await createAdjustment(request, buildAdjustment(product.id, { quantity }));

      await expectApiError(response, 400, 'INVALID_QUANTITY');
    });
  }

  test('should accept a reason of exactly 5 characters', async ({ request, product }) => {
    const response = await createAdjustment(request, buildAdjustment(product.id, { reason: 'abcde' }));

    expect(response.status()).toBe(201);
  });

  const invalidReasons: Array<[string, unknown]> = [
    ['4 characters long', 'abcd'],
    ['too short once the spaces are trimmed', '  abc  '],
    ['only spaces', '     '],
    ['missing', undefined],
  ];

  for (const [label, reason] of invalidReasons) {
    test(`should reject a reason that is ${label}`, async ({ request, product }) => {
      const response = await createAdjustment(request, buildAdjustment(product.id, { reason }));

      await expectApiError(response, 400, 'REASON_REQUIRED');
    });
  }

  const invalidResponsibles: Array<[string, unknown]> = [
    ['empty', ''],
    ['only spaces', '   '],
    ['missing', undefined],
  ];

  for (const [label, responsibleId] of invalidResponsibles) {
    test(`should reject a responsible that is ${label}`, async ({ request, product }) => {
      const response = await createAdjustment(request, buildAdjustment(product.id, { responsibleId }));

      await expectApiError(response, 400, 'RESPONSIBLE_REQUIRED');
    });
  }

  test('should answer 404 when the warehouse does not exist', async ({ request, product }) => {
    const response = await createAdjustment(request, buildAdjustment(product.id, { warehouseId: 'XXX' }));

    await expectApiError(response, 404, 'WAREHOUSE_NOT_FOUND');
  });

  test('should answer 404 when the product does not exist', async ({ request }) => {
    const response = await createAdjustment(request, buildAdjustment('non-existent-product'));

    await expectApiError(response, 404, 'PRODUCT_NOT_FOUND');
  });

  test('should reject adjustments on an inactive product', async ({ request, stockedProduct }) => {
    await test.step('Deactivate the product', async () => {
      const deactivated = await setProductStatus(request, stockedProduct.id, { active: false });
      expect(deactivated.status()).toBe(200);
    });

    await test.step('Try to adjust its stock', async () => {
      const response = await createAdjustment(request, buildAdjustment(stockedProduct.id));

      await expectApiError(response, 422, 'PRODUCT_INACTIVE');
    });

    await test.step('Reactivate it and adjust again', async () => {
      await setProductStatus(request, stockedProduct.id, { active: true });
      const response = await createAdjustment(request, buildAdjustment(stockedProduct.id));

      expect(response.status()).toBe(201);
    });
  });
});
