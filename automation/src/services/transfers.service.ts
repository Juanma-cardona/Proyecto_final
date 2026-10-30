import { APIRequestContext, APIResponse } from '@playwright/test';

/** POST /transfers */
export async function createTransfer(request: APIRequestContext, data: object): Promise<APIResponse> {
  return await request.post('v1/transfers', { data });
}
