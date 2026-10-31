-- z-kb 任务配置 MySQL 元数据表（幂等）
-- 与 db/h2/taskconfig-kb.sql 保持同构；kb_id 空串表示租户级配置。

CREATE TABLE IF NOT EXISTS zkb_task_config (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL DEFAULT '',
    task_type VARCHAR(32) NOT NULL,
    task_code VARCHAR(32) NOT NULL,
    task_name VARCHAR(128) NOT NULL,
    config_version VARCHAR(32) NOT NULL,
    executor_config VARCHAR(4000) NOT NULL,
    published_at DATETIME(3) NULL,
    published_by VARCHAR(64) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time DATETIME(3) NULL,
    update_time DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_zkb_task_config (tenant_code, kb_id, config_version, task_code, is_deleted),
    KEY idx_zkb_task_config_version (tenant_code, kb_id, published_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '任务配置';
