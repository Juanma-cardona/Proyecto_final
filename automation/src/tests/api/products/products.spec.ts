import { APIResponse } from '@playwright/test';
import { test, expect } from '../../../fixtures/api.fixture';
import { buildProduct, uniqueCode } from '../../../data/product.data';
import { expectApiError } from '../../../helpers/assertions';
import { createProduct, createProductRaw } from '../../../services/products.service';

/**
 * Endpoint 1: POST /products
 */
test.describe('POST /products - create product', () => {

  test('should create a product and normalize its code', async ({ request }) => {
    const code = uniqueCode();
    let response!: APIResponse;

    await test.step('Send a lowercase code and values with extra spaces', async () => {
      response = await createProduct(request, {
        code: `  ${code.toLowerCase()}  `,
        name: '  Tornillo  ',
        description: '  Acero inoxidable  ',
      });
    });

    await test.step('Validate status code', async () => {
      expect(response.status()).toBe(201);
    });

    await test.step('Validate response body', async () => {
      const body = await response.json();

      expect(body.id).toEqual(expect.any(String));
      expect(body.code).toBe(code);
      expect(body.name).toBe('Tornillo');
      expect(body.description).toBe('Acero inoxidable');
      expect(body.active).toBe(true);
      expect(new Date(body.createdAt).toString()).not.toBe('Invalid Date');
    });
  });

  test('should create a product without description', async ({ request }) => {
    const response = await createProduct(request, buildProduct({ description: undefined }));

    expect(response.status()).toBe(201);
    expect((await response.json()).description).toBeNull();
  });

  test('should reject a duplicated code, even if it only differs in letter case', async ({ request }) => {
    const code = uniqueCode();

    await test.step('Create the product the first time', async () => {
      const first = await createProduct(request, buildProduct({ code }));
      expect(first.status()).toBe(201);
    });

    await test.step('Create it again with the same code', async () => {
      const duplicated = await createProduct(request, buildProduct({ code }));
      await expectApiError(duplicated, 409, 'PRODUCT_CODE_DUPLICATED');
    });

    await test.step('Create it again with the code in lowercase', async () => {
      const lowercase = await createProduct(request, buildProduct({ code: code.toLowerCase() }));
      await expectApiError(lowercase, 409, 'PRODUCT_CODE_DUPLICATED');
    });
  });

  const invalidCodes: Array<[string, unknown]> = [
    ['missing', undefined],
    ['empty', ''],
    ['only spaces', '   '],
    ['null', null],
    ['a number', 123],
  ];

  for (const [label, code] of invalidCodes) {
    test(`should reject a product when the code is ${label}`, async ({ request }) => {
      const response = await createProduct(request, buildProduct({ code }));

      await expectApiError(response, 400, 'PRODUCT_CODE_REQUIRED');
    });
  }

  const invalidNames: Array<[string, unknown]> = [
    ['missing', undefined],
    ['empty', ''],
    ['only spaces', '   '],
    ['a number', 42],
  ];

  for (const [label, name] of invalidNames) {
    test(`should reject a product when the name is ${label}`, async ({ request }) => {
      const response = await createProduct(request, buildProduct({ name }));

      await expectApiError(response, 400, 'PRODUCT_NAME_REQUIRED');
    });
  }

  test('should reject a description that is not text', async ({ request }) => {
    const response = await createProduct(request, buildProduct({ description: 10 }));

    await expectApiError(response, 400, 'VALIDATION_ERROR');
  });

  test('should reject a body that is not an object', async ({ request }) => {
    const response = await createProduct(request, []);

    await expectApiError(response, 400, 'VALIDATION_ERROR');
  });

  test('should reject a malformed JSON body', async ({ request }) => {
    const response = await createProductRaw(request, '{"code": ');

    await expectApiError(response, 400, 'BAD_REQUEST');
  });
});
