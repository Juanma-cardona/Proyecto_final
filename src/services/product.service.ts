import { randomUUID } from "node:crypto";
import { CreateProductRequestDTO, ProductResponseDTO } from "../dto/product.dto";
import { Product } from "../entities/warehouse.entities";
import { fail } from "../exceptions/fail";
import { AppError } from "../exceptions/errors/app.error";
import { IProductRepository } from "../repositories/interfaces/repositories.interface";
import { IProductService } from "./interfaces/product.interface";

const toResponse = (product: Product): ProductResponseDTO => ({
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    active: product.active,
    createdAt: product.createdAt.toISOString(),
});

export class ProductService implements IProductService {
    constructor(private readonly productRepository: IProductRepository) {}

    async createProduct(request: CreateProductRequestDTO): Promise<ProductResponseDTO> {
        const code = request.code?.trim().toUpperCase();
        const name = request.name?.trim();

        if (!code) fail(AppError.PRODUCT_CODE_REQUIRED);
        if (!name) fail(AppError.PRODUCT_NAME_REQUIRED);

        const product: Product = {
            id: randomUUID(),
            code,
            name,
            description: request.description?.trim() || null,
            active: true,
            createdAt: new Date(),
        };

        return toResponse(await this.productRepository.save(product));
    }

    async setProductStatus(productId: string, active: unknown): Promise<ProductResponseDTO> {
        if (typeof active !== "boolean") fail(AppError.INVALID_STATUS);

        const updated = await this.productRepository.updateStatus(productId, active);
        if (!updated) fail(AppError.PRODUCT_NOT_FOUND);
        return toResponse(updated);
    }
}
