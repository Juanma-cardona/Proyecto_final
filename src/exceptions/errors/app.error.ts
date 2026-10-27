export const AppError = {
    // Productos
    PRODUCT_CODE_REQUIRED: { code: "PRODUCT_CODE_REQUIRED", statusCode: 400, message: "Product code is required" },
    PRODUCT_NAME_REQUIRED: { code: "PRODUCT_NAME_REQUIRED", statusCode: 400, message: "Product name is required" },
    PRODUCT_CODE_DUPLICATED: { code: "PRODUCT_CODE_DUPLICATED", statusCode: 409, message: "A product with this code already exists" },
    PRODUCT_NOT_FOUND: { code: "PRODUCT_NOT_FOUND", statusCode: 404, message: "Product not found" },
    PRODUCT_INACTIVE: { code: "PRODUCT_INACTIVE", statusCode: 422, message: "Product is inactive" },
    INVALID_STATUS: { code: "INVALID_STATUS", statusCode: 400, message: "Field 'active' must be a boolean" },

    // Bodegas / stock
    WAREHOUSE_NOT_FOUND: { code: "WAREHOUSE_NOT_FOUND", statusCode: 404, message: "Warehouse not found" },
    INVALID_QUANTITY: { code: "INVALID_QUANTITY", statusCode: 400, message: "Quantity must be a valid integer" },
    REASON_REQUIRED: { code: "REASON_REQUIRED", statusCode: 400, message: "A justification of at least 5 characters is required" },
    RESPONSIBLE_REQUIRED: { code: "RESPONSIBLE_REQUIRED", statusCode: 400, message: "Responsible user is required" },
    INSUFFICIENT_STOCK: { code: "INSUFFICIENT_STOCK", statusCode: 422, message: "Insufficient stock: the operation would leave negative stock" },
    INVALID_PAGINATION: { code: "INVALID_PAGINATION", statusCode: 400, message: "page must be >= 1 and limit between 1 and 100" },

    // Validación genérica (Zod): campos sin un código de error propio
    VALIDATION_ERROR: { code: "VALIDATION_ERROR", statusCode: 400, message: "Invalid request data" },

    // Transferencias
    SAME_WAREHOUSE: { code: "SAME_WAREHOUSE", statusCode: 400, message: "Origin and destination warehouses must be different" },
} as const;
