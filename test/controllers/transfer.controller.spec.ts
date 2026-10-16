import { beforeEach, describe, expect, it, vi, type Mocked } from "vitest";
import { TransferController } from "../../src/controllers/transfer.controller";
import { ITransferService } from "../../src/services/interfaces/transfer.interface";
import { createRequest, createResponse } from "../helpers/http";

describe("TransferController", () => {
    let transferService: Mocked<ITransferService>;
    let controller: TransferController;

    beforeEach(() => {
        transferService = { transfer: vi.fn() } as unknown as Mocked<ITransferService>;
        controller = new TransferController(transferService);
    });

    it("should respond 201 with the transfer result", async () => {
        const body = { originWarehouseId: "BOG", destinationWarehouseId: "MED", productId: "p1", quantity: 5, responsibleId: "u1" };
        const result = {
            transferId: "t1", productId: "p1", quantity: 5, responsibleId: "u1",
            origin: { warehouseId: "BOG", newBalance: 45 },
            destination: { warehouseId: "MED", newBalance: 5 },
            createdAt: "2026-01-01T00:00:00.000Z",
        };
        transferService.transfer.mockResolvedValue(result);
        const res = createResponse();

        await controller.createTransfer(createRequest({ body }), res);

        expect(transferService.transfer).toHaveBeenCalledWith(body);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(result);
    });

    it("should propagate service errors without responding", async () => {
        transferService.transfer.mockRejectedValue(new Error("boom"));
        const res = createResponse();

        await expect(controller.createTransfer(createRequest({ body: {} }), res)).rejects.toThrow("boom");
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });
});
