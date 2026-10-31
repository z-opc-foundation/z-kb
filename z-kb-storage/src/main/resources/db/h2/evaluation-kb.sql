-- z-kb 评估域 H2 元数据表（MySQL 兼容模式，幂等）
-- 与 db/mysql/evaluation-kb.sql 保持同构；索引用独立语句。
-- id 由应用生成（UUID 字符串），QA 集合按库单份、可版本化；跑批固定集合版本、
-- 配置版本与 Judge 版本，并用 zkb_kb_snapshot 钉住当时的物料、产物与检索块。

CREATE TABLE IF NOT EXISTS zkb_eval_dataset (
    id VARCHAR(64) NOT NULL,
    dataset_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    version_no INT NOT NULL,
    status VARCHAR(16) NOT NULL,
    case_count INT NOT NULL DEFAULT 0,
    description VARCHAR(1000) NULL,
    published_by VARCHAR(64) NULL,
    published_at TIMESTAMP(3) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_eval_dataset_version ON zkb_eval_dataset (tenant_code, kb_id, version_no, is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_eval_dataset_id ON zkb_eval_dataset (tenant_code, dataset_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_eval_dataset_status ON zkb_eval_dataset (tenant_code, kb_id, status);

CREATE TABLE IF NOT EXISTS zkb_eval_case (
    id VARCHAR(64) NOT NULL,
    case_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    dataset_pk VARCHAR(64) NOT NULL,
    dataset_id VARCHAR(64) NOT NULL,
    dataset_version_no INT NOT NULL,
    case_no INT NOT NULL,
    question VARCHAR(2000) NOT NULL,
    expected_answer CLOB NULL,
    expected_behavior VARCHAR(16) NOT NULL,
    expected_evidence CLOB NULL,
    entry_type VARCHAR(32) NOT NULL DEFAULT 'DOCUMENT',
    tags VARCHAR(255) NULL,
    status VARCHAR(16) NOT NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_eval_case_id ON zkb_eval_case (tenant_code, case_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_eval_case_dataset ON zkb_eval_case (tenant_code, dataset_pk);
CREATE INDEX IF NOT EXISTS idx_zkb_eval_case_no ON zkb_eval_case (tenant_code, dataset_pk, case_no);

CREATE TABLE IF NOT EXISTS zkb_eval_run (
    id VARCHAR(64) NOT NULL,
    run_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    dataset_pk VARCHAR(64) NOT NULL,
    dataset_id VARCHAR(64) NOT NULL,
    dataset_version_no INT NOT NULL,
    snapshot_id VARCHAR(64) NOT NULL,
    config_version VARCHAR(64) NOT NULL,
    task_config_version VARCHAR(64) NOT NULL,
    judge_mode VARCHAR(16) NOT NULL,
    judge_version VARCHAR(64) NOT NULL,
    judge_config CLOB NULL,
    retrieval_config CLOB NULL,
    index_generation VARCHAR(128) NOT NULL,
    input_fingerprint CHAR(64) NOT NULL,
    scope_type VARCHAR(16) NOT NULL,
    stage_code VARCHAR(16) NULL,
    baseline_run_id VARCHAR(64) NULL,
    status VARCHAR(16) NOT NULL,
    result_usable INT NOT NULL DEFAULT 0,
    unusable_reason VARCHAR(64) NULL,
    case_total INT NOT NULL DEFAULT 0,
    case_done INT NOT NULL DEFAULT 0,
    retrieval_truncated INT NOT NULL DEFAULT 0,
    started_at TIMESTAMP(3) NULL,
    finished_at TIMESTAMP(3) NULL,
    duration_ms BIGINT NULL,
    error_code VARCHAR(32) NULL,
    error_message VARCHAR(1000) NULL,
    triggered_by VARCHAR(64) NULL,
    reused_from_run_id VARCHAR(64) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_eval_run_id ON zkb_eval_run (tenant_code, run_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_eval_run_kb ON zkb_eval_run (tenant_code, kb_id, id);
CREATE INDEX IF NOT EXISTS idx_zkb_eval_run_fingerprint ON zkb_eval_run (tenant_code, kb_id, input_fingerprint, status, finished_at, id);

CREATE TABLE IF NOT EXISTS zkb_eval_result (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    run_id VARCHAR(64) NOT NULL,
    metric_code VARCHAR(64) NOT NULL,
    metric_name VARCHAR(128) NOT NULL,
    metric_layer VARCHAR(16) NOT NULL,
    stage_code VARCHAR(16) NOT NULL,
    metric_value DECIMAL(18,6) NULL,
    unit VARCHAR(16) NOT NULL DEFAULT 'ratio',
    target_value DECIMAL(18,6) NULL,
    status VARCHAR(16) NOT NULL,
    sample_size INT NOT NULL DEFAULT 0,
    attribution VARCHAR(64) NULL,
    note VARCHAR(1000) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_eval_result_metric ON zkb_eval_result (tenant_code, run_id, metric_code, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_eval_result_run ON zkb_eval_result (tenant_code, run_id, metric_layer);

CREATE TABLE IF NOT EXISTS zkb_eval_case_result (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    run_id VARCHAR(64) NOT NULL,
    case_id VARCHAR(64) NOT NULL,
    question VARCHAR(2000) NOT NULL,
    answer CLOB NULL,
    answer_mode VARCHAR(24) NOT NULL,
    retrieved CLOB NULL,
    citations CLOB NULL,
    metrics CLOB NULL,
    stage_trace CLOB NULL,
    latency_ms BIGINT NULL,
    error_message VARCHAR(1000) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_eval_case_result ON zkb_eval_case_result (tenant_code, run_id, case_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_eval_case_result_run ON zkb_eval_case_result (tenant_code, run_id);

CREATE TABLE IF NOT EXISTS zkb_eval_badcase (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    case_id VARCHAR(64) NOT NULL,
    stage_code VARCHAR(16) NOT NULL,
    category VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    owner VARCHAR(64) NULL,
    note VARCHAR(1000) NULL,
    first_seen_run_id VARCHAR(64) NOT NULL,
    last_seen_run_id VARCHAR(64) NOT NULL,
    occurrence_count INT NOT NULL DEFAULT 1,
    resolved_run_id VARCHAR(64) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_eval_badcase ON zkb_eval_badcase (tenant_code, kb_id, case_id, stage_code, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_eval_badcase_status ON zkb_eval_badcase (tenant_code, kb_id, status);

CREATE TABLE IF NOT EXISTS zkb_kb_snapshot (
    id VARCHAR(64) NOT NULL,
    snapshot_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    config_version VARCHAR(64) NOT NULL,
    ontology_version VARCHAR(64) NOT NULL,
    index_generation VARCHAR(128) NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    artifact_manifest CLOB NULL,
    material_count INT NOT NULL DEFAULT 0,
    artifact_count INT NOT NULL DEFAULT 0,
    chunk_count INT NOT NULL DEFAULT 0,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_snapshot_id ON zkb_kb_snapshot (tenant_code, snapshot_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_snapshot_kb ON zkb_kb_snapshot (tenant_code, kb_id, id);
CREATE INDEX IF NOT EXISTS idx_zkb_snapshot_fingerprint ON zkb_kb_snapshot (tenant_code, kb_id, fingerprint, index_generation, status);

CREATE TABLE IF NOT EXISTS zkb_kb_snapshot_item (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    snapshot_id VARCHAR(64) NOT NULL,
    item_type VARCHAR(16) NOT NULL,
    item_key VARCHAR(255) NOT NULL,
    material_id VARCHAR(64) NULL,
    material_version_id VARCHAR(64) NULL,
    artifact_type VARCHAR(32) NULL,
    artifact_version_id VARCHAR(64) NULL,
    index_generation VARCHAR(128) NULL,
    checksum CHAR(64) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_snapshot_item ON zkb_kb_snapshot_item (tenant_code, snapshot_id, item_key, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_snapshot_item_version ON zkb_kb_snapshot_item (tenant_code, material_version_id);
