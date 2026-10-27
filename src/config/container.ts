import { aliasTo, asClass, asValue, createContainer, InjectionMode } from "awilix";
import { ProductController } from "../controllers/product.controller";
import { StockController } from "../controllers/stock.controller";
import { TransferController } from "../controllers/transfer.controller";
import { InMemoryMovementRepository } from "../repositories/in-memory/movement.repository";
import { InMemoryProductRepository } from "../repositories/in-memory/product.repository";
import { InMemoryStockRepository } from "../repositories/in-memory/stock.repository";
import { InMemoryTransactionManager } from "../repositories/in-memory/transaction.manager";
import { InMemoryWarehouseRepository } from "../repositories/in-memory/warehouse.repository";
import { SqlServerMovementRepository } from "../repositories/sqlserver/movement.repository";
import { SqlServerProductRepository } from "../repositories/sqlserver/product.repository";
import { SqlServerStockRepository } from "../repositories/sqlserver/stock.repository";
import { SqlServerWarehouseRepository } from "../repositories/sqlserver/warehouse.repository";
import { ProductService } from "../services/product.service";
import { StockService } from "../services/stock.service";
import { TransferService } from "../services/transfer.service";
import { SqlServerDatabase } from "./database";
import { loadSqlServerConfig } from "./sqlserver.config";

/** DB_DRIVER=sqlserver usa SQL Server; cualquier otro valor (o ninguno) usa datos en memoria. */
const useSqlServer = (process.env.DB_DRIVER ?? "memory").toLowerCase() === "sqlserver";

/** Conexión a SQL Server, o null cuando se usa memoria. main.ts la conecta y la cierra. */
export const database = useSqlServer ? new SqlServerDatabase(loadSqlServerConfig()) : null;

export const container = createContainer({
    injectionMode: InjectionMode.CLASSIC,
});

// Los nombres de los parámetros de cada constructor deben coincidir con estas llaves (modo CLASSIC).
if (database) {
    container.register({
        database: asValue(database),
        sqlExecutor: aliasTo("database"),
        transactionManager: aliasTo("database"),

        productRepository: asClass(SqlServerProductRepository).singleton(),
        warehouseRepository: asClass(SqlServerWarehouseRepository).singleton(),
        stockRepository: asClass(SqlServerStockRepository).singleton(),
        movementRepository: asClass(SqlServerMovementRepository).singleton(),
    });
} else {
    container.register({
        transactionManager: asClass(InMemoryTransactionManager).singleton(),

        // Repositorios en memoria (singleton: mantienen el estado)
        productRepository: asClass(InMemoryProductRepository).singleton(),
        warehouseRepository: asClass(InMemoryWarehouseRepository).singleton(),
        stockRepository: asClass(InMemoryStockRepository).singleton(),
        movementRepository: asClass(InMemoryMovementRepository).singleton(),
    });
}

container.register({
    // Servicios
    productService: asClass(ProductService).scoped(),
    stockService: asClass(StockService).scoped(),
    transferService: asClass(TransferService).scoped(),

    // Controladores
    productController: asClass(ProductController).scoped(),
    stockController: asClass(StockController).scoped(),
    transferController: asClass(TransferController).scoped(),
});
