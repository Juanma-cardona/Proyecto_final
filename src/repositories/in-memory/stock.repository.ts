import { StockListItem } from "../../entities/warehouse.entities";
import { IProductRepository, IStockRepository, StockBalance } from "../interfaces/repositories.interface";

export class InMemoryStockRepository implements IStockRepository {
    private readonly stock = new Map<string, number>();

    // El nombre del parámetro debe coincidir con la llave del contenedor (modo CLASSIC).
    // Es opcional para poder crear el repositorio solo, sin productos (los nombres salen como UNKNOWN).
    constructor(private readonly productRepository?: IProductRepository) {}

    private key(warehouseId: string, productId: string): string {
        return `${warehouseId}:${productId}`;
    }

    async getQuantity(warehouseId: string, productId: string): Promise<number> {
        return this.stock.get(this.key(warehouseId, productId)) ?? 0;
    }

    async setQuantity(warehouseId: string, productId: string, quantity: number): Promise<void> {
        this.stock.set(this.key(warehouseId, productId), quantity);
    }

    async getQuantities(productId: string, warehouseIds: string[]): Promise<Map<string, number>> {
        return new Map(warehouseIds.map((id) => [id, this.stock.get(this.key(id, productId)) ?? 0]));
    }

    async setQuantities(productId: string, balances: StockBalance[]): Promise<void> {
        for (const balance of balances) {
            this.stock.set(this.key(balance.warehouseId, productId), balance.quantity);
        }
    }

    invalidateWarehouseCounts(_warehouseIds: string[]): void {}

    async listByWarehouse(
        warehouseId: string,
        offset: number,
        limit: number
    ): Promise<{ items: StockListItem[]; total: number }> {
        const prefix = `${warehouseId}:`;
        const all: { productId: string; quantity: number }[] = [];
        for (const [key, quantity] of this.stock.entries()) {
            if (key.startsWith(prefix)) {
                all.push({ productId: key.slice(prefix.length), quantity });
            }
        }

        const items = await Promise.all(
            all.slice(offset, offset + limit).map(async ({ productId, quantity }) => {
                const product = await this.productRepository?.findById(productId);
                return {
                    warehouseId,
                    productId,
                    productCode: product?.code ?? "UNKNOWN",
                    productName: product?.name ?? "UNKNOWN",
                    quantity,
                };
            })
        );
        return { items, total: all.length };
    }
}
