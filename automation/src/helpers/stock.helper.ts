import { APIRequestContext, expect } from '@playwright/test';
import { getWineries } from '../services/wineries.service';

export interface StockItem {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
}

/**
 * Busca un producto en el stock de una bodega recorriendo todas las páginas.
 * Es necesario porque la base de datos acumula productos de ejecuciones anteriores,
 * así que el producto de la prueba puede no estar en la primera página.
 */
export async function findStockItem(
  request: APIRequestContext,
  warehouseId: string,
  productId: string,
): Promise<StockItem | undefined> {
  let page = 1;
  let totalPages = 1;

  do {
    const response = await getWineries(request, warehouseId, { page, limit: 100 });
    expect(response.status(), `reading stock page ${page} of ${warehouseId}`).toBe(200);

    const body = await response.json();
    const item = (body.data as StockItem[]).find((entry) => entry.productId === productId);
    if (item) return item;

    totalPages = body.totalPages;
    page++;
  } while (page <= totalPages);

  return undefined;
}

/** Cantidad actual de un producto en una bodega (0 si nunca ha tenido stock allí). */
export async function getBalance(
  request: APIRequestContext,
  warehouseId: string,
  productId: string,
): Promise<number> {
  const item = await findStockItem(request, warehouseId, productId);
  return item?.quantity ?? 0;
}
