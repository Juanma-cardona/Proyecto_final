import { Movement } from "../../entities/warehouse.entities";

export const MOVEMENT_COLUMNS =
    "id, type, warehouse_id, product_id, quantity, balance_after, reason, transfer_id, responsible_id, created_at";

export const buildMovementInsertValues = (movements: Movement[]) => {
    const params: Record<string, string | number | Date | null> = {};
    const rows = movements.map((movement, index) => {
        params[`id${index}`] = movement.id;
        params[`type${index}`] = movement.type;
        params[`warehouseId${index}`] = movement.warehouseId;
        params[`productId${index}`] = movement.productId;
        params[`quantity${index}`] = movement.quantity;
        params[`balanceAfter${index}`] = movement.balanceAfter;
        params[`reason${index}`] = movement.reason;
        params[`transferId${index}`] = movement.transferId;
        params[`responsibleId${index}`] = movement.responsibleId;
        params[`createdAt${index}`] = movement.createdAt;
        return `(@id${index}, @type${index}, @warehouseId${index}, @productId${index}, @quantity${index}, @balanceAfter${index}, @reason${index}, @transferId${index}, @responsibleId${index}, @createdAt${index})`;
    });
    return { params, rows };
};
