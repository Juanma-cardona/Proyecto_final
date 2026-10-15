import { CreateProductRequestDTO, ProductResponseDTO } from "../../dto/product.dto";

export interface IProductService {
    createProduct(request: CreateProductRequestDTO): Promise<ProductResponseDTO>;
    setProductStatus(productId: string, active: unknown): Promise<ProductResponseDTO>;
}
