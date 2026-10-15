import { Request, Response } from "express";
import { CreateProductRequestDTO, UpdateProductStatusRequestDTO } from "../dto/product.dto";
import { IProductService } from "../services/interfaces/product.interface";

export class ProductController {
    constructor(readonly productService: IProductService) {}

    createProduct = async (req: Request, res: Response): Promise<void> => {
        const request = req.body as CreateProductRequestDTO;
        const result = await this.productService.createProduct(request);
        res.status(201).json(result);
    };

    updateProductStatus = async (req: Request, res: Response): Promise<void> => {
        const productId = req.params.id as string;
        const { active } = req.body as UpdateProductStatusRequestDTO;
        const result = await this.productService.setProductStatus(productId, active);
        res.status(200).json(result);
    };
}
