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

    async findByCode(code: string): Promise<Product | null> {
        const rows = await this.sqlExecutor.query<ProductRow>(`${SELECT_PRODUCT} WHERE code = @code`, { code });
        const row = rows[0];
        return row ? toProduct(row) : null;
    }
}
