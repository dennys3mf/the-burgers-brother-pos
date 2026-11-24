-- Older Pages deployments still reference the original table names.
ALTER TABLE app_state RENAME TO pos_state;
ALTER TABLE orders RENAME TO pos_orders;
