import { APIResponse, expect } from '@playwright/test';

/**
 * Valida una respuesta de error de la API: el status HTTP, el código de negocio
 * (por ejemplo INSUFFICIENT_STOCK) y que traiga un mensaje.
 */
export async function expectApiError(response: APIResponse, status: number, code: string): Promise<void> {
  expect(response.status()).toBe(status);

  const body = await response.json();
  expect(body.code).toBe(code);
  expect(typeof body.message).toBe('string');
  expect(body.message.length).toBeGreaterThan(0);
}
