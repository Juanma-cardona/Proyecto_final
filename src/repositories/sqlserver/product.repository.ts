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

// Números de error de SQL Server para "llave duplicada" (índice único / restricción UNIQUE).
const UNIQUE_VIOLATION_NUMBERS = [2601, 2627];

const SELECT_PRODUCT = "SELECT id, code, name, description, active, created_at FROM dbo.products";

const toProduct = (row: ProductRow): Product => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
});

export class SqlServerProductRepository implements IProductRepository {
    constructor(private readonly sqlExecutor: ISqlExecutor) {}

    async save(product: Product): Promise<Product> {
        try {
            await this.sqlExecutor.query(
                `MERGE dbo.products WITH (HOLDLOCK) AS target
                 USING (SELECT @id AS id) AS source ON target.id = source.id
                 WHEN MATCHED THEN
                     UPDATE SET code = @code, name = @name, description = @description, active = @active
                 WHEN NOT MATCHED THEN
                     INSERT (id, code, name, description, active, created_at)
                     VALUES (@id, @code, @name, @description, @active, @createdAt);`,
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
            const number = (error as { number?: number }).number;
            if (number !== undefined && UNIQUE_VIOLATION_NUMBERS.includes(number)) {
                fail(AppError.PRODUCT_CODE_DUPLICATED);
            }
            throw error;
        }

        return { ...product };
    }

    async findById(id: string): Promise<Product | null> {
        const rows = await this.sqlExecutor.query<ProductRow>(`${SELECT_PRODUCT} WHERE id = @id`, { id });
        const row = rows[0];
        return row ? toProduct(row) : null;
    }

    async updateStatus(id: string, active: boolean): Promise<Product | null> {
        const rows = await this.sqlExecutor.query<ProductRow>(
            `UPDATE dbo.products
             SET active = @active
             OUTPUT inserted.id, inserted.code, inserted.name, inserted.description,
                    inserted.active, inserted.created_at
             WHERE id = @id`,
            { id, active }
        );
        const row = rows[0];
        return row ? toProduct(row) : null;
    }

    async findByIds(ids: string[]): Promise<Product[]> {
        const uniqueIds = [...new Set(ids)];
        if (uniqueIds.length === 0) {
            return [];
        }

        // Una sola consulta con IN (@id0, @id1, ...). SQL Server admite hasta 2100 parámetros por consulta
        // y una página de stock trae como máximo 100 productos.
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
        const row = rows[0];
        return row ? toProduct(row) : null;
    }
}
