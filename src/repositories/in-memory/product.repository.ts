import { Product } from "../../entities/warehouse.entities";
import { AppError } from "../../exceptions/errors/app.error";
import { fail } from "../../exceptions/fail";
import { IProductRepository } from "../interfaces/repositories.interface";

export class InMemoryProductRepository implements IProductRepository {
    private readonly products = new Map<string, Product>();

    async save(product: Product): Promise<Product> {
        const duplicate = [...this.products.values()].some(
            (existing) => existing.id !== product.id && existing.code === product.code
        );
        if (duplicate) fail(AppError.PRODUCT_CODE_DUPLICATED);
        this.products.set(product.id, { ...product });
        return { ...product };
    }

    async findById(id: string): Promise<Product | null> {
        const found = this.products.get(id);
        return found ? { ...found } : null;
    }

    async updateStatus(id: string, active: boolean): Promise<Product | null> {
        const product = this.products.get(id);
        if (!product) return null;
        const updated = { ...product, active };
        this.products.set(id, updated);
        return { ...updated };
    }

    async findByIds(ids: string[]): Promise<Product[]> {
        const found: Product[] = [];
        for (const id of new Set(ids)) {
            const product = this.products.get(id);
            if (product) {
                found.push({ ...product });
            }
        }
        return found;
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
