import { APIResponse } from '@playwright/test';
import { test, expect } from '../../../fixtures/api.fixture';
import { buildTransfer, WAREHOUSES, RESPONSIBLE_ID } from '../../../data/product.data';
import { expectApiError } from '../../../helpers/assertions';
import { getBalance } from '../../../helpers/stock.helper';
import { setProductStatus } from '../../../services/products.service';
import { createTransfer } from '../../../services/transfers.service';

/**
 * Endpoint 5: POST /transfers
 */
test.describe('POST /transfers - transfer between warehouses', () => {

  test('should move stock from the origin to the destination warehouse', async ({ request, stockedProduct }) => {
    let response!: APIResponse;

    await test.step('Transfer 40 units from BOG to MED', async () => {
      response = await createTransfer(request, buildTransfer(stockedProduct.id, { quantity: 40 }));
    });

    await test.step('Validate status code', async () => {
      expect(response.status()).toBe(201);
    });

    await test.step('Validate response body', async () => {
      const body = await response.json();

      expect(body.transferId).toEqual(expect.any(String));
      expect(body.productId).toBe(stockedProduct.id);
      expect(body.quantity).toBe(40);
      expect(body.responsibleId).toBe(RESPONSIBLE_ID);
      expect(body.origin).toEqual({ warehouseId: 'BOG', newBalance: 60 });
      expect(body.destination).toEqual({ warehouseId: 'MED', newBalance: 40 });
      expect(new Date(body.createdAt).toString()).not.toBe('Invalid Date');
    });

    await test.step('Validate the stock of both warehouses', async () => {
      expect(await getBalance(request, WAREHOUSES.BOGOTA, stockedProduct.id)).toBe(60);
      expect(await getBalance(request, WAREHOUSES.MEDELLIN, stockedProduct.id)).toBe(40);
    });
  });

  test('should accumulate the stock in the destination warehouse', async ({ request, stockedProduct }) => {
    await createTransfer(request, buildTransfer(stockedProduct.id, { quantity: 40 }));
    const response = await createTransfer(request, buildTransfer(stockedProduct.id, { quantity: 10 }));

    const body = await response.json();
    expect(body.origin.newBalance).toBe(50);
    expect(body.destination.newBalance).toBe(50);
  });

  test('should allow transferring all the stock', async ({ request, stockedProduct }) => {
    const response = await createTransfer(request, buildTransfer(stockedProduct.id, { quantity: 100 }));

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.origin.newBalance).toBe(0);
    expect(body.destination.newBalance).toBe(100);
  });

  test('should allow transferring between any pair of warehouses', async ({ request, stockedProduct }) => {
    const response = await createTransfer(
      request,
      buildTransfer(stockedProduct.id, {
        originWarehouseId: WAREHOUSES.BOGOTA,
        destinationWarehouseId: WAREHOUSES.CALI,
        quantity: 5,
      }),
    );

    expect(response.status()).toBe(201);
    expect((await response.json()).destination.warehouseId).toBe('CAL');
  });

  test('should reject a transfer larger than the available stock and leave the stock untouched', async ({
    request,
    stockedProduct,
  }) => {
    await test.step('Try to transfer 101 units when there are 100', async () => {
      const response = await createTransfer(request, buildTransfer(stockedProduct.id, { quantity: 101 }));

      await expectApiError(response, 422, 'INSUFFICIENT_STOCK');
    });

    await test.step('Validate neither warehouse changed', async () => {
      expect(await getBalance(request, WAREHOUSES.BOGOTA, stockedProduct.id)).toBe(100);
      expect(await getBalance(request, WAREHOUSES.MEDELLIN, stockedProduct.id)).toBe(0);
    });
  });

  test('should reject a transfer of a product that has no stock in the origin', async ({ request, product }) => {
    const response = await createTransfer(request, buildTransfer(product.id));

    await expectApiError(response, 422, 'INSUFFICIENT_STOCK');
  });

  const invalidQuantities: Array<[string, unknown]> = [
    ['zero', 0],
    ['negative', -40],
    ['a decimal', 2.5],
    ['text', '10'],
    ['null', null],
    ['missing', undefined],
  ];

  for (const [label, quantity] of invalidQuantities) {
    test(`should reject a quantity that is ${label}`, async ({ request, stockedProduct }) => {
      const response = await createTransfer(request, buildTransfer(stockedProduct.id, { quantity }));

      await expectApiError(response, 400, 'INVALID_QUANTITY');
    });
  }

  const invalidResponsibles: Array<[string, unknown]> = [
    ['empty', ''],
    ['only spaces', '   '],
    ['missing', undefined],
  ];

  for (const [label, responsibleId] of invalidResponsibles) {
    test(`should reject a responsible that is ${label}`, async ({ request, stockedProduct }) => {
      const response = await createTransfer(request, buildTransfer(stockedProduct.id, { responsibleId }));

      await expectApiError(response, 400, 'RESPONSIBLE_REQUIRED');
    });
  }

  test('should reject a transfer to the same warehouse', async ({ request, stockedProduct }) => {
    const response = await createTransfer(
      request,
      buildTransfer(stockedProduct.id, { originWarehouseId: 'BOG', destinationWarehouseId: 'BOG' }),
    );

    await expectApiError(response, 400, 'SAME_WAREHOUSE');
  });

  test('should answer 404 when the origin warehouse does not exist', async ({ request, stockedProduct }) => {
    const response = await createTransfer(request, buildTransfer(stockedProduct.id, { originWarehouseId: 'XXX' }));

    await expectApiError(response, 404, 'WAREHOUSE_NOT_FOUND');
  });

  test('should answer 404 when the destination warehouse does not exist', async ({ request, stockedProduct }) => {
    const response = await createTransfer(
      request,
      buildTransfer(stockedProduct.id, { destinationWarehouseId: 'XXX' }),
    );

    await expectApiError(response, 404, 'WAREHOUSE_NOT_FOUND');
  });

  test('should answer 404 when the product does not exist', async ({ request }) => {
    const response = await createTransfer(request, buildTransfer('non-existent-product'));

    await expectApiError(response, 404, 'PRODUCT_NOT_FOUND');
  });

  test('should reject transfers of an inactive product', async ({ request, stockedProduct }) => {
    await test.step('Deactivate the product', async () => {
      const deactivated = await setProductStatus(request, stockedProduct.id, { active: false });
      expect(deactivated.status()).toBe(200);
    });

    await test.step('Try to transfer it', async () => {
      const response = await createTransfer(request, buildTransfer(stockedProduct.id));

      await expectApiError(response, 422, 'PRODUCT_INACTIVE');
    });
  });

  test('should reject a body with a missing product or warehouse', async ({ request, stockedProduct }) => {
    const missingProduct = await createTransfer(request, buildTransfer(stockedProduct.id, { productId: undefined }));
    const missingOrigin = await createTransfer(
      request,
      buildTransfer(stockedProduct.id, { originWarehouseId: undefined }),
    );

    await expectApiError(missingProduct, 400, 'VALIDATION_ERROR');
    await expectApiError(missingOrigin, 400, 'VALIDATION_ERROR');
  });
});
