import { Product } from "../../entities/warehouse.entities";
import { ISqlExecutor } from "../interfaces/database.interface";

export interface ProductRow {
    id: string;
    code: string;
    name: string;
    description: string | null;
    active: boolean;
    created_at: Date;
}

export const toProduct = (row: ProductRow): Product => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
});

export const findProductsByIds = async (
    sqlExecutor: ISqlExecutor,
    table: "products" | "dbo.products",
    ids: string[]
): Promise<Product[]> => {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];

    const params: Record<string, string> = {};
    const placeholders = uniqueIds.map((id, index) => {
        params[`id${index}`] = id;
        return `@id${index}`;
    });
    const rows = await sqlExecutor.query<ProductRow>(
        `SELECT id, code, name, description, active, created_at FROM ${table} WHERE id IN (${placeholders.join(", ")})`,
        params
    );
    return rows.map(toProduct);
};
