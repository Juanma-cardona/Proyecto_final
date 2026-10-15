export interface CreateProductRequestDTO {
    code: string;
    name: string;
    description?: string;
}

export interface UpdateProductStatusRequestDTO {
    active: boolean;
}

export interface ProductResponseDTO {
    id: string;
    code: string;
    name: string;
    description: string | null;
    active: boolean;
    createdAt: string;
}
