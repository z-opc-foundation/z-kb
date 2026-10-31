-- z-kb 任务配置 H2 元数据表（MySQL 兼容模式，幂等）
-- 与 db/mysql/taskconfig-kb.sql 保持同构；kb_id 空串表示租户级配置。

CREATE TABLE IF NOT EXISTS zkb_task_config (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL DEFAULT '',
    task_type VARCHAR(32) NOT NULL,
    task_code VARCHAR(32) NOT NULL,
    task_name VARCHAR(128) NOT NULL,
    config_version VARCHAR(32) NOT NULL,
    executor_config VARCHAR(4000) NOT NULL,
    published_at TIMESTAMP(3) NULL,
    published_by VARCHAR(64) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_task_config ON zkb_task_config (tenant_code, kb_id, config_version, task_code, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_task_config_version ON zkb_task_config (tenant_code, kb_id, published_at);
