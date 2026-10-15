import { Product } from "../../entities/warehouse.entities";
import { IProductRepository } from "../interfaces/repositories.interface";

export class InMemoryProductRepository implements IProductRepository {
    private readonly products = new Map<string, Product>();

    async save(product: Product): Promise<Product> {
        this.products.set(product.id, { ...product });
        return { ...product };
    }

    async findById(id: string): Promise<Product | null> {
        const found = this.products.get(id);
        return found ? { ...found } : null;
    }

    async findByCode(code: string): Promise<Product | null> {
        for (const product of this.products.values()) {
            if (product.code === code) {
                return { ...product };
            }
        }
        return null;
    }
}
