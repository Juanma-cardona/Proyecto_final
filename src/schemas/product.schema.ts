import { z } from "zod";
import { AppError } from "../exceptions/errors/app.error";
import type { FieldErrors } from "../middlewares/validate.middleware";

export const createProductSchema = z.object({
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string().nullish(),
});

export const createProductErrors: FieldErrors = {
    code: AppError.PRODUCT_CODE_REQUIRED,
    name: AppError.PRODUCT_NAME_REQUIRED,
};

export const updateProductStatusSchema = z.object({
    active: z.boolean(),
});

export const updateProductStatusErrors: FieldErrors = {
    active: AppError.INVALID_STATUS,
};
