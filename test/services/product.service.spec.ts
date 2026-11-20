import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../../src/exceptions/errors/app.error";
import { AppException } from "../../src/exceptions/app.exception";
import { ProductService } from "../../src/services/product.service";
import { createProductRepositoryMock, expectAppError, makeProduct } from "../helpers/mocks";

describe("ProductService", () => {
    let productRepository: ReturnType<typeof createProductRepositoryMock>;
    let service: ProductService;

    beforeEach(() => {
        productRepository = createProductRepositoryMock();
        service = new ProductService(productRepository);
    });

    describe("createProduct", () => {
        it("should create an active product and return it as DTO", async () => {
            const result = await service.createProduct({
                code: "TOR-001",
                name: "Tornillo 1/4",
                description: "Caja x100",
            });

            expect(result.id).toEqual(expect.any(String));
            expect(result.code).toBe("TOR-001");
            expect(result.name).toBe("Tornillo 1/4");
            expect(result.description).toBe("Caja x100");
            expect(result.active).toBe(true);
            expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
            expect(productRepository.save).toHaveBeenCalledTimes(1);
        });

        it("should normalize the code (trim + uppercase) and trim the name", async () => {
            const result = await service.createProduct({ code: "  tor-001 ", name: "  Tornillo  " });

            expect(result.code).toBe("TOR-001");
            expect(result.name).toBe("Tornillo");
            expect(productRepository.findByCode).not.toHaveBeenCalled();
        });

        it("should store description as null when it is missing", async () => {
            const result = await service.createProduct({ code: "A-1", name: "Producto" });

            expect(result.description).toBeNull();
        });

        it("should store description as null when it is blank", async () => {
            const result = await service.createProduct({ code: "A-1", name: "Producto", description: "   " });

            expect(result.description).toBeNull();
        });

        it.each([
            ["empty", ""],
            ["blank", "   "],
            ["undefined", undefined],
        ])("should throw PRODUCT_CODE_REQUIRED when code is %s", async (_label, code) => {
            await expectAppError(
                service.createProduct({ code: code as unknown as string, name: "Producto" }),
                AppError.PRODUCT_CODE_REQUIRED
            );
            expect(productRepository.save).not.toHaveBeenCalled();
        });

        it.each([
            ["empty", ""],
            ["blank", "   "],
            ["undefined", undefined],
        ])("should throw PRODUCT_NAME_REQUIRED when name is %s", async (_label, name) => {
            await expectAppError(
                service.createProduct({ code: "A-1", name: name as unknown as string }),
                AppError.PRODUCT_NAME_REQUIRED
            );
            expect(productRepository.save).not.toHaveBeenCalled();
        });

        it("should validate the code before the name", async () => {
            await expectAppError(
                service.createProduct({ code: "", name: "" }),
                AppError.PRODUCT_CODE_REQUIRED
            );
        });

        it("should throw PRODUCT_CODE_DUPLICATED (409) when the code already exists", async () => {
            productRepository.save.mockRejectedValue(
                new AppException(AppError.PRODUCT_CODE_DUPLICATED.code, AppError.PRODUCT_CODE_DUPLICATED.statusCode, AppError.PRODUCT_CODE_DUPLICATED.message)
            );

            await expectAppError(
                service.createProduct({ code: "tor-001", name: "Otro" }),
                AppError.PRODUCT_CODE_DUPLICATED
            );
            expect(productRepository.save).toHaveBeenCalledTimes(1);
        });
    });

    describe("setProductStatus", () => {
        it("should deactivate an active product", async () => {
            productRepository.updateStatus.mockResolvedValue(makeProduct({ active: false }));

            const result = await service.setProductStatus("prod-1", false);

            expect(result.active).toBe(false);
            expect(productRepository.updateStatus).toHaveBeenCalledWith("prod-1", false);
        });

        it("should activate an inactive product", async () => {
            productRepository.updateStatus.mockResolvedValue(makeProduct({ active: true }));

            const result = await service.setProductStatus("prod-1", true);

            expect(result.active).toBe(true);
            expect(productRepository.updateStatus).toHaveBeenCalledWith("prod-1", true);
        });

        it("should keep the rest of the product data untouched", async () => {
            productRepository.updateStatus.mockResolvedValue(makeProduct({ description: "Caja x100", active: false }));

            const result = await service.setProductStatus("prod-1", false);

            expect(result).toMatchObject({
                id: "prod-1",
                code: "TOR-001",
                name: "Tornillo 1/4",
                description: "Caja x100",
                createdAt: "2026-01-01T00:00:00.000Z",
            });
        });

        it.each([
            ["a string", "true"],
            ["a number", 1],
            ["null", null],
            ["undefined", undefined],
        ])("should throw INVALID_STATUS when active is %s", async (_label, active) => {
            await expectAppError(service.setProductStatus("prod-1", active), AppError.INVALID_STATUS);
            expect(productRepository.updateStatus).not.toHaveBeenCalled();
        });

        it("should throw PRODUCT_NOT_FOUND (404) when the product does not exist", async () => {
            productRepository.updateStatus.mockResolvedValue(null);

            await expectAppError(service.setProductStatus("nope", true), AppError.PRODUCT_NOT_FOUND);
            expect(productRepository.updateStatus).toHaveBeenCalledWith("nope", true);
        });
    });
});
