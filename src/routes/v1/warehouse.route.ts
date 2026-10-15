import { Router } from "express";
import { ProductController } from "../../controllers/product.controller";
import { StockController } from "../../controllers/stock.controller";
import { TransferController } from "../../controllers/transfer.controller";

const router = Router();

// 1. Crear producto (código único obligatorio)
router.post("/products", (req, res) =>
    req.container.resolve<ProductController>("productController").createProduct(req, res)
);

// 2. Activar / desactivar producto
router.patch("/products/:id/status", (req, res) =>
    req.container.resolve<ProductController>("productController").updateProductStatus(req, res)
);

// 3. Consultar stock de una bodega (paginado)
router.get("/warehouses/:warehouseId/stock", (req, res) =>
    req.container.resolve<StockController>("stockController").getWarehouseStock(req, res)
);

// 4. Ajuste manual de stock con justificación
router.post("/stock/adjustments", (req, res) =>
    req.container.resolve<StockController>("stockController").createAdjustment(req, res)
);

// 5. Transferir stock entre bodegas
router.post("/transfers", (req, res) =>
    req.container.resolve<TransferController>("transferController").createTransfer(req, res)
);

export default router;
