-- Ejecuta este script en Supabase > SQL Editor para crear el esquema PostgreSQL.
-- Los identificadores se guardan como texto para conservar UUID y facilitar la importación existente.

CREATE TABLE IF NOT EXISTS warehouses (
    id text PRIMARY KEY,
    name text NOT NULL,
    city text NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id text PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS stock (
    warehouse_id text NOT NULL REFERENCES warehouses (id),
    product_id text NOT NULL REFERENCES products (id),
    quantity integer NOT NULL CHECK (quantity >= 0),
    CONSTRAINT pk_stock PRIMARY KEY (warehouse_id, product_id)
);

CREATE TABLE IF NOT EXISTS movements (
    id text PRIMARY KEY,
    type text NOT NULL CHECK (type IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT')),
    warehouse_id text NOT NULL REFERENCES warehouses (id),
    product_id text NOT NULL REFERENCES products (id),
    quantity integer NOT NULL CHECK (quantity > 0),
    balance_after integer NOT NULL,
    reason text,
    transfer_id text,
    responsible_id text NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_movements_warehouse_product
    ON movements (warehouse_id, product_id, created_at);

INSERT INTO warehouses (id, name, city)
VALUES
    ('BOG', 'Bodega Bogotá', 'Bogotá'),
    ('MED', 'Bodega Medellín', 'Medellín'),
    ('CAL', 'Bodega Cali', 'Cali')
ON CONFLICT (id) DO NOTHING;
