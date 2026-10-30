import { test, expect } from '../../../fixtures/api.fixture';
import { expectApiError } from '../../../helpers/assertions';
import { setProductStatus } from '../../../services/products.service';

/**
 * Endpoint 2: PATCH /products/:id/status
 */
test.describe('PATCH /products/:id/status - activate or deactivate', () => {

  test('should deactivate an active product', async ({ request, product }) => {
    const response = await setProductStatus(request, product.id, { active: false });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(product.id);
    expect(body.code).toBe(product.code);
    expect(body.active).toBe(false);
  });

  test('should reactivate a deactivated product', async ({ request, product }) => {
    await test.step('Deactivate the product', async () => {
      const deactivated = await setProductStatus(request, product.id, { active: false });
      expect(deactivated.status()).toBe(200);
    });

    await test.step('Activate it again', async () => {
      const reactivated = await setProductStatus(request, product.id, { active: true });

      expect(reactivated.status()).toBe(200);
      expect((await reactivated.json()).active).toBe(true);
    });
  });

  const invalidStatuses: Array<[string, object]> = [
    ['a string', { active: 'false' }],
    ['a number', { active: 1 }],
    ['null', { active: null }],
    ['missing', {}],
  ];

  for (const [label, body] of invalidStatuses) {
    test(`should reject a status that is ${label}`, async ({ request, product }) => {
      const response = await setProductStatus(request, product.id, body);

      await expectApiError(response, 400, 'INVALID_STATUS');
    });
  }

  test('should answer 404 when the product does not exist', async ({ request }) => {
    const response = await setProductStatus(request, 'non-existent-product', { active: false });

    await expectApiError(response, 404, 'PRODUCT_NOT_FOUND');
  });
});
