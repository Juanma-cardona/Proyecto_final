-- =====================================================================
-- Bodegas API - Script de base de datos (SQL Server)
-- Se puede ejecutar varias veces sin problema: solo crea lo que falta.
-- Ejecútalo en SQL Server Management Studio o Azure Data Studio.
-- =====================================================================

IF DB_ID(N'BodegasDB') IS NULL
    CREATE DATABASE BodegasDB;
GO

USE BodegasDB;
GO

-- ---------- Bodegas ----------
IF OBJECT_ID(N'dbo.warehouses', N'U') IS NULL
CREATE TABLE dbo.warehouses (
    id   NVARCHAR(10)  NOT NULL CONSTRAINT PK_warehouses PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    city NVARCHAR(100) NOT NULL
);
GO

-- ---------- Productos ----------
IF OBJECT_ID(N'dbo.products', N'U') IS NULL
CREATE TABLE dbo.products (
    id          NVARCHAR(36)  NOT NULL CONSTRAINT PK_products PRIMARY KEY,
    code        NVARCHAR(100) NOT NULL CONSTRAINT UQ_products_code UNIQUE,
    name        NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    active      BIT           NOT NULL CONSTRAINT DF_products_active DEFAULT 1,
    created_at  DATETIME2(3)  NOT NULL
);
GO

-- ---------- Stock actual por bodega y producto ----------
IF OBJECT_ID(N'dbo.stock', N'U') IS NULL
CREATE TABLE dbo.stock (
    warehouse_id NVARCHAR(10) NOT NULL CONSTRAINT FK_stock_warehouse REFERENCES dbo.warehouses (id),
    product_id   NVARCHAR(36) NOT NULL CONSTRAINT FK_stock_product   REFERENCES dbo.products (id),
    quantity     INT          NOT NULL CONSTRAINT CK_stock_quantity CHECK (quantity >= 0), -- nunca negativo
    CONSTRAINT PK_stock PRIMARY KEY (warehouse_id, product_id)
);
GO

-- ---------- Movimientos (kardex) ----------
IF OBJECT_ID(N'dbo.movements', N'U') IS NULL
CREATE TABLE dbo.movements (
    id             NVARCHAR(36)  NOT NULL CONSTRAINT PK_movements PRIMARY KEY,
    type           NVARCHAR(20)  NOT NULL
        CONSTRAINT CK_movements_type CHECK (type IN (N'ADJUSTMENT_IN', N'ADJUSTMENT_OUT', N'TRANSFER_IN', N'TRANSFER_OUT')),
    warehouse_id   NVARCHAR(10)  NOT NULL CONSTRAINT FK_movements_warehouse REFERENCES dbo.warehouses (id),
    product_id     NVARCHAR(36)  NOT NULL CONSTRAINT FK_movements_product   REFERENCES dbo.products (id),
    quantity       INT           NOT NULL CONSTRAINT CK_movements_quantity CHECK (quantity > 0),
    balance_after  INT           NOT NULL,
    reason         NVARCHAR(MAX) NULL,
    transfer_id    NVARCHAR(36)  NULL,
    responsible_id NVARCHAR(255) NOT NULL,
    created_at     DATETIME2(3)  NOT NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_movements_warehouse_product' AND object_id = OBJECT_ID(N'dbo.movements'))
    CREATE INDEX IX_movements_warehouse_product ON dbo.movements (warehouse_id, product_id, created_at);
GO

-- ---------- Las 3 bodegas ----------
INSERT INTO dbo.warehouses (id, name, city)
SELECT v.id, v.name, v.city
FROM (VALUES
    (N'BOG', N'Bodega Bogotá',   N'Bogotá'),
    (N'MED', N'Bodega Medellín', N'Medellín'),
    (N'CAL', N'Bodega Cali',     N'Cali')
) AS v (id, name, city)
WHERE NOT EXISTS (SELECT 1 FROM dbo.warehouses w WHERE w.id = v.id);
GO
