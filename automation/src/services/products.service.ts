import { APIRequestContext, APIResponse } from '@playwright/test';

/** POST /products */
export async function createProduct(request: APIRequestContext, data: object): Promise<APIResponse> {
  return await request.post('v1/products', { data });
}

/** POST /products con un cuerpo en texto crudo (para probar JSON mal formado). */
export async function createProductRaw(request: APIRequestContext, rawBody: string): Promise<APIResponse> {
  return await request.post('v1/products', {
    headers: { 'Content-Type': 'application/json' },
    data: Buffer.from(rawBody),
  });
}

/** PATCH /products/:id/status */
export async function setProductStatus(
  request: APIRequestContext,
  productId: string,
  data: object,
): Promise<APIResponse> {
  return await request.patch(`v1/products/${productId}/status`, { data });
}
