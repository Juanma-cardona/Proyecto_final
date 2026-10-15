import { Router } from "express";
import warehouseRoutes from "./warehouse.route";

const router = Router();

router.use("/v1", warehouseRoutes);

export default router;
