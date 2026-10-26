import { z } from "zod";
import { AppError } from "../exceptions/errors/app.error";
import type { FieldErrors } from "../middlewares/validate.middleware";

const MIN_REASON_LENGTH = 5;
const MAX_LIMIT = 100;

/** Query de GET /warehouses/:warehouseId/stock */
export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(10),
});

export const paginationErrors: FieldErrors = {
    page: AppError.INVALID_PAGINATION,
    limit: AppError.INVALID_PAGINATION,
};

/** Body de POST /stock/adjustments. El orden de las llaves define qué error se reporta primero. */
export const stockAdjustmentSchema = z.object({
    quantity: z
        .number()
        .int()
        .refine((value) => value !== 0),
    reason: z.string().trim().min(MIN_REASON_LENGTH),
    responsibleId: z.string().trim().min(1),
    warehouseId: z.string().trim().min(1),
    productId: z.string().trim().min(1),
});

export const stockAdjustmentErrors: FieldErrors = {
    quantity: AppError.INVALID_QUANTITY,
    reason: AppError.REASON_REQUIRED,
    responsibleId: AppError.RESPONSIBLE_REQUIRED,
};
