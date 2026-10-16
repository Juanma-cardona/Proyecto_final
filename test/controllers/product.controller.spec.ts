import { beforeEach, describe, expect, it, vi, type Mocked } from "vitest";
import { ProductController } from "../../src/controllers/product.controller";
import { IProductService } from "../../src/services/interfaces/product.interface";
import { createRequest, createResponse } from "../helpers/http";

describe("ProductController", () => {
    let productService: Mocked<IProductService>;
    let controller: ProductController;

    beforeEach(() => {
        productService = {
            createProduct: vi.fn(),
            setProductStatus: vi.fn(),
        } as unknown as Mocked<IProductService>;
        controller = new ProductController(productService);
    });

    describe("createProduct", () => {
        it("should respond 201 with the created product", async () => {
            const body = { code: "TOR-001", name: "Tornillo", description: "Caja" };
            const created = { id: "1", ...body, active: true, createdAt: "2026-01-01T00:00:00.000Z" };
            productService.createProduct.mockResolvedValue(created);
            const res = createResponse();

            await controller.createProduct(createRequest({ body }), res);

            expect(productService.createProduct).toHaveBeenCalledWith(body);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(created);
        });

        it("should propagate service errors without responding", async () => {
            productService.createProduct.mockRejectedValue(new Error("boom"));
            const res = createResponse();

            await expect(controller.createProduct(createRequest({ body: {} }), res)).rejects.toThrow("boom");
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });
    });

    describe("updateProductStatus", () => {
        it("should respond 200 with the updated product", async () => {
            const updated = { id: "abc", code: "A", name: "N", description: null, active: false, createdAt: "x" };
            productService.setProductStatus.mockResolvedValue(updated);
            const res = createResponse();

            await controller.updateProductStatus(
                createRequest({ params: { id: "abc" }, body: { active: false } }),
                res
            );

            expect(productService.setProductStatus).toHaveBeenCalledWith("abc", false);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(updated);
        });

        it("should propagate service errors without responding", async () => {
            productService.setProductStatus.mockRejectedValue(new Error("not found"));
            const res = createResponse();

            await expect(
                controller.updateProductStatus(createRequest({ params: { id: "x" }, body: { active: true } }), res)
            ).rejects.toThrow("not found");
            expect(res.json).not.toHaveBeenCalled();
        });
    });
});
