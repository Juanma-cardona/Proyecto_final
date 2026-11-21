import { Product } from "../../entities/warehouse.entities";
import { AppError } from "../../exceptions/errors/app.error";
import { fail } from "../../exceptions/fail";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IProductRepository } from "../interfaces/repositories.interface";

interface ProductRow {
    id: string;
    code: string;
    name: string;
    description: string | null;
    active: boolean;
    created_at: Date;
}

const SELECT_PRODUCT = "SELECT id, code, name, description, active, created_at FROM products";
const toProduct = (row: ProductRow): Product => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
});

export class PostgresProductRepository implements IProductRepository {
    constructor(private readonly sqlExecutor: ISqlExecutor) {}

    async save(product: Product): Promise<Product> {
        try {
            await this.sqlExecutor.query(
                `INSERT INTO products (id, code, name, description, active, created_at)
                 VALUES (@id, @code, @name, @description, @active, @createdAt)
                 ON CONFLICT (id) DO UPDATE SET
                    code = EXCLUDED.code,
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    active = EXCLUDED.active`,
                {
                    id: product.id,
                    code: product.code,
                    name: product.name,
                    description: product.description,
                    active: product.active,
                    createdAt: product.createdAt,
                }
            );
        } catch (error) {
            if ((error as { code?: string }).code === "23505") fail(AppError.PRODUCT_CODE_DUPLICATED);
            throw error;
        }
        return { ...product };
    }

    async findById(id: string): Promise<Product | null> {
        const rows = await this.sqlExecutor.query<ProductRow>(`${SELECT_PRODUCT} WHERE id = @id`, { id });
        return rows[0] ? toProduct(rows[0]) : null;
    }

    async updateStatus(id: string, active: boolean): Promise<Product | null> {
        const rows = await this.sqlExecutor.query<ProductRow>(
            `UPDATE products SET active = @active WHERE id = @id
             RETURNING id, code, name, description, active, created_at`,
            { id, active }
        );
        return rows[0] ? toProduct(rows[0]) : null;
    }

    async findByIds(ids: string[]): Promise<Product[]> {
        const uniqueIds = [...new Set(ids)];
        if (uniqueIds.length === 0) return [];

        const params: Record<string, string> = {};
        const placeholders = uniqueIds.map((id, index) => {
            params[`id${index}`] = id;
            return `@id${index}`;
        });
        const rows = await this.sqlExecutor.query<ProductRow>(
            `${SELECT_PRODUCT} WHERE id IN (${placeholders.join(", ")})`,
            params
        );
        return rows.map(toProduct);
    }

    async findByCode(code: string): Promise<Product | null> {
        const rows = await this.sqlExecutor.query<ProductRow>(`${SELECT_PRODUCT} WHERE code = @code`, { code });
        return rows[0] ? toProduct(rows[0]) : null;
    }
}
