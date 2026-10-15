import { StockItem } from "../../entities/warehouse.entities";
import { IStockRepository } from "../interfaces/repositories.interface";

export class InMemoryStockRepository implements IStockRepository {
    private readonly stock = new Map<string, number>();

    private key(warehouseId: string, productId: string): string {
        return `${warehouseId}:${productId}`;
    }

    async getQuantity(warehouseId: string, productId: string): Promise<number> {
        return this.stock.get(this.key(warehouseId, productId)) ?? 0;
    }

    async setQuantity(warehouseId: string, productId: string, quantity: number): Promise<void> {
        this.stock.set(this.key(warehouseId, productId), quantity);
    }

    async listByWarehouse(
        warehouseId: string,
        offset: number,
        limit: number
    ): Promise<{ items: StockItem[]; total: number }> {
        const prefix = `${warehouseId}:`;
        const all: StockItem[] = [];
        for (const [key, quantity] of this.stock.entries()) {
            if (key.startsWith(prefix)) {
                all.push({ warehouseId, productId: key.slice(prefix.length), quantity });
            }
        }
        return { items: all.slice(offset, offset + limit), total: all.length };
    }
}
