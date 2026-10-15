import { asClass, createContainer, InjectionMode } from "awilix";
import { ProductController } from "../controllers/product.controller";
import { StockController } from "../controllers/stock.controller";
import { TransferController } from "../controllers/transfer.controller";
import { InMemoryMovementRepository } from "../repositories/in-memory/movement.repository";
import { InMemoryProductRepository } from "../repositories/in-memory/product.repository";
import { InMemoryStockRepository } from "../repositories/in-memory/stock.repository";
import { InMemoryWarehouseRepository } from "../repositories/in-memory/warehouse.repository";
import { ProductService } from "../services/product.service";
import { StockService } from "../services/stock.service";
import { TransferService } from "../services/transfer.service";

export const container = createContainer({
    injectionMode: InjectionMode.CLASSIC,
});

// Los nombres de los parámetros de cada constructor deben coincidir con estas llaves (modo CLASSIC).
container.register({
    // Repositorios (singleton: mantienen el estado en memoria)
    productRepository: asClass(InMemoryProductRepository).singleton(),
    warehouseRepository: asClass(InMemoryWarehouseRepository).singleton(),
    stockRepository: asClass(InMemoryStockRepository).singleton(),
    movementRepository: asClass(InMemoryMovementRepository).singleton(),

    // Servicios
    productService: asClass(ProductService).scoped(),
    stockService: asClass(StockService).scoped(),
    transferService: asClass(TransferService).scoped(),

    // Controladores
    productController: asClass(ProductController).scoped(),
    stockController: asClass(StockController).scoped(),
    transferController: asClass(TransferController).scoped(),
});
