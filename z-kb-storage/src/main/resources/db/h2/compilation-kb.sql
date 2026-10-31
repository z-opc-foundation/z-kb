-- z-kb 编译域 H2 元数据表（MySQL 兼容模式，幂等）
-- 与 db/mysql/compilation-kb.sql 保持同构；索引用独立语句。
-- H2 下 TEXT/MEDIUMTEXT 统一用 CLOB，长 JSON 用 VARCHAR(4000)。

CREATE TABLE IF NOT EXISTS zkb_compilation_job (
    id VARCHAR(64) NOT NULL,
    job_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    task_type VARCHAR(32) NOT NULL DEFAULT 'COMPILATION',
    scope_type VARCHAR(16) NOT NULL,
    scope_id VARCHAR(64) NULL,
    scope_count INT NOT NULL DEFAULT 1,
    material_id VARCHAR(64) NULL,
    material_version_id VARCHAR(64) NULL,
    total_count INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    input_snapshot VARCHAR(4000) NOT NULL,
    pipeline_type VARCHAR(32) NOT NULL DEFAULT 'DOCUMENT',
    config_version VARCHAR(64) NULL,
    config_snapshot VARCHAR(4000) NULL,
    compiler_version VARCHAR(64) NOT NULL,
    run_status VARCHAR(16) NOT NULL,
    milestone VARCHAR(8) NOT NULL DEFAULT 'NONE',
    current_stage VARCHAR(16) NULL,
    chunk_count INT NOT NULL DEFAULT 0,
    round_no INT NOT NULL DEFAULT 1,
    m1_at TIMESTAMP(3) NULL,
    m2_at TIMESTAMP(3) NULL,
    started_at TIMESTAMP(3) NULL,
    finished_at TIMESTAMP(3) NULL,
    failure_summary VARCHAR(1000) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_job_id ON zkb_compilation_job (tenant_code, job_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_job_kb ON zkb_compilation_job (tenant_code, kb_id, is_deleted, create_time);
CREATE INDEX IF NOT EXISTS idx_zkb_job_material ON zkb_compilation_job (tenant_code, material_id, material_version_id);
CREATE INDEX IF NOT EXISTS idx_zkb_job_scope ON zkb_compilation_job (tenant_code, kb_id, scope_type, run_status);

CREATE TABLE IF NOT EXISTS zkb_compilation_stage (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    job_id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    material_version_id VARCHAR(64) NOT NULL,
    stage VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    round_no INT NOT NULL DEFAULT 1,
    seq_no INT NOT NULL DEFAULT 0,
    input_ref VARCHAR(255) NULL,
    output_ref VARCHAR(255) NULL,
    item_count INT NOT NULL DEFAULT 0,
    detail VARCHAR(1000) NULL,
    failure_summary VARCHAR(1000) NULL,
    started_at TIMESTAMP(3) NULL,
    finished_at TIMESTAMP(3) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_stage ON zkb_compilation_stage (tenant_code, job_id, material_version_id, stage, round_no, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_stage_job ON zkb_compilation_stage (tenant_code, job_id, round_no, material_version_id, seq_no);
CREATE INDEX IF NOT EXISTS idx_zkb_stage_version ON zkb_compilation_stage (tenant_code, material_version_id, create_time);

CREATE TABLE IF NOT EXISTS zkb_artifact (
    id VARCHAR(64) NOT NULL,
    artifact_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NULL,
    material_version_id VARCHAR(64) NULL,
    artifact_type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    lifecycle_status VARCHAR(16) NOT NULL,
    retrieval_state VARCHAR(16) NOT NULL,
    current_version_id VARCHAR(64) NULL,
    evidence_ref VARCHAR(255) NOT NULL,
    created_by VARCHAR(64) NULL,
    published_at TIMESTAMP(3) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_artifact_id ON zkb_artifact (tenant_code, artifact_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_artifact_kb ON zkb_artifact (tenant_code, kb_id, artifact_type);
CREATE INDEX IF NOT EXISTS idx_zkb_artifact_material ON zkb_artifact (tenant_code, material_id);
CREATE INDEX IF NOT EXISTS idx_zkb_artifact_version ON zkb_artifact (tenant_code, material_version_id);

CREATE TABLE IF NOT EXISTS zkb_artifact_version (
    id VARCHAR(64) NOT NULL,
    artifact_version_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    artifact_id VARCHAR(64) NOT NULL,
    version_no INT NOT NULL,
    content_hash CHAR(64) NOT NULL,
    storage_ref VARCHAR(255) NOT NULL,
    compiler_version VARCHAR(64) NOT NULL,
    config_version VARCHAR(64) NOT NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_artifact_version_id ON zkb_artifact_version (tenant_code, artifact_version_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_artifact_version ON zkb_artifact_version (tenant_code, artifact_id, version_no);

CREATE TABLE IF NOT EXISTS zkb_retrieval_chunk (
    id VARCHAR(64) NOT NULL,
    chunk_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    source_type VARCHAR(16) NOT NULL DEFAULT 'MATERIAL',
    source_id VARCHAR(64) NOT NULL DEFAULT '',
    source_version_id VARCHAR(64) NULL,
    parent_chunk_id VARCHAR(64) NULL,
    chunk_role VARCHAR(16) NOT NULL DEFAULT 'PASSAGE',
    material_id VARCHAR(64) NULL,
    material_version_id VARCHAR(64) NULL,
    artifact_id VARCHAR(64) NOT NULL,
    artifact_version_id VARCHAR(64) NOT NULL,
    ordinal INT NOT NULL,
    heading VARCHAR(255) NULL,
    content CLOB NOT NULL,
    char_count INT NOT NULL,
    index_state VARCHAR(16) NOT NULL,
    embedding_model VARCHAR(64) NULL,
    embedding CLOB NULL,
    indexed_at TIMESTAMP(3) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_chunk_id ON zkb_retrieval_chunk (tenant_code, chunk_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_chunk_kb ON zkb_retrieval_chunk (tenant_code, kb_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_zkb_chunk_material ON zkb_retrieval_chunk (tenant_code, kb_id, material_id);
CREATE INDEX IF NOT EXISTS idx_zkb_chunk_version ON zkb_retrieval_chunk (tenant_code, material_version_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_zkb_chunk_parent ON zkb_retrieval_chunk (tenant_code, parent_chunk_id);
CREATE INDEX IF NOT EXISTS idx_zkb_chunk_role_state ON zkb_retrieval_chunk (tenant_code, kb_id, chunk_role, index_state, indexed_at, material_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_zkb_chunk_artifact ON zkb_retrieval_chunk (tenant_code, artifact_id);
