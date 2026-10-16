import { beforeEach, describe, expect, it, vi, type Mocked } from "vitest";
import { StockController } from "../../src/controllers/stock.controller";
import { IStockService } from "../../src/services/interfaces/stock.interface";
import { createRequest, createResponse } from "../helpers/http";

describe("StockController", () => {
    let stockService: Mocked<IStockService>;
    let controller: StockController;

    beforeEach(() => {
        stockService = {
            getStockByWarehouse: vi.fn(),
            adjustStock: vi.fn(),
        } as unknown as Mocked<IStockService>;
        controller = new StockController(stockService);
    });

    describe("getWarehouseStock", () => {
        const page = { warehouseId: "BOG", warehouseName: "Bodega Bogotá", data: [], page: 1, limit: 10, total: 0, totalPages: 0 };

        it("should use page=1 and limit=10 by default and respond 200", async () => {
            stockService.getStockByWarehouse.mockResolvedValue(page);
            const res = createResponse();

            await controller.getWarehouseStock(createRequest({ params: { warehouseId: "BOG" } }), res);

            expect(stockService.getStockByWarehouse).toHaveBeenCalledWith("BOG", 1, 10);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(page);
        });

        it("should convert page and limit query params to numbers", async () => {
            stockService.getStockByWarehouse.mockResolvedValue(page);

            await controller.getWarehouseStock(
                createRequest({ params: { warehouseId: "MED" }, query: { page: "3", limit: "5" } }),
                createResponse()
            );

            expect(stockService.getStockByWarehouse).toHaveBeenCalledWith("MED", 3, 5);
        });

        it("should pass NaN to the service when the query params are not numeric (service rejects them)", async () => {
            stockService.getStockByWarehouse.mockResolvedValue(page);

            await controller.getWarehouseStock(
                createRequest({ params: { warehouseId: "BOG" }, query: { page: "abc", limit: "xyz" } }),
                createResponse()
            );

            expect(stockService.getStockByWarehouse).toHaveBeenCalledWith("BOG", Number.NaN, Number.NaN);
        });

        it("should propagate service errors without responding", async () => {
            stockService.getStockByWarehouse.mockRejectedValue(new Error("boom"));
            const res = createResponse();

            await expect(
                controller.getWarehouseStock(createRequest({ params: { warehouseId: "BOG" } }), res)
            ).rejects.toThrow("boom");
            expect(res.json).not.toHaveBeenCalled();
        });
    });

    describe("createAdjustment", () => {
        it("should respond 201 with the adjustment result", async () => {
            const body = { warehouseId: "BOG", productId: "p1", quantity: 10, reason: "Carga inicial", responsibleId: "u1" };
            const result = {
                movementId: "m1", warehouseId: "BOG", productId: "p1", type: "ADJUSTMENT_IN" as const,
                quantity: 10, previousBalance: 0, newBalance: 10, reason: "Carga inicial",
                responsibleId: "u1", createdAt: "2026-01-01T00:00:00.000Z",
            };
            stockService.adjustStock.mockResolvedValue(result);
            const res = createResponse();

            await controller.createAdjustment(createRequest({ body }), res);

            expect(stockService.adjustStock).toHaveBeenCalledWith(body);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(result);
        });

        it("should propagate service errors without responding", async () => {
            stockService.adjustStock.mockRejectedValue(new Error("boom"));
            const res = createResponse();

            await expect(controller.createAdjustment(createRequest({ body: {} }), res)).rejects.toThrow("boom");
            expect(res.json).not.toHaveBeenCalled();
        });
    });
});
