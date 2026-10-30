import { APIRequestContext, APIResponse } from '@playwright/test';

/** POST /stock/adjustments */
export async function createAdjustment(request: APIRequestContext, data: object): Promise<APIResponse> {
  return await request.post('v1/stock/adjustments', { data });
}
