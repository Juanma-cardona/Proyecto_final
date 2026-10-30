import { APIRequestContext, APIResponse } from '@playwright/test';

/** GET /warehouses/:warehouseId/stock (con paginación opcional: page y limit). */
export async function getWineries(
  request: APIRequestContext,
  warehouseid: string,
  params?: Record<string, string | number>,
): Promise<APIResponse> {
  return await request.get(`v1/warehouses/${warehouseid}/stock`, { params });
}
