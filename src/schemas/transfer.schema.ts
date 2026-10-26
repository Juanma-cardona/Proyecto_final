import { z } from "zod";
import { AppError } from "../exceptions/errors/app.error";
import type { FieldErrors } from "../middlewares/validate.middleware";

/**
 * Body de POST /transfers. Que origen y destino sean distintas bodegas
 * lo sigue verificando TransferService (regla de negocio).
 */
export const transferSchema = z.object({
    quantity: z.number().int().positive(),
    responsibleId: z.string().trim().min(1),
    originWarehouseId: z.string().trim().min(1),
    destinationWarehouseId: z.string().trim().min(1),
    productId: z.string().trim().min(1),
});

export const transferErrors: FieldErrors = {
    quantity: AppError.INVALID_QUANTITY,
    responsibleId: AppError.RESPONSIBLE_REQUIRED,
};
