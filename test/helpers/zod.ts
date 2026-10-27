import type { ZodType } from "zod";

/** Devuelve el nombre del primer campo inválido, o null si los datos son válidos. */
export const firstInvalidField = (schema: ZodType, data: unknown): string | null => {
    const result = schema.safeParse(data);
    return result.success ? null : String(result.error.issues[0]?.path[0] ?? "");
};
