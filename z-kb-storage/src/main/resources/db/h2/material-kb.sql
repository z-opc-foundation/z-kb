-- z-kb 物料域 H2 元数据表（MySQL 兼容模式，幂等）
-- 与 db/mysql/material-kb.sql 保持同构；索引用独立语句。
-- H2 下 TEXT/MEDIUMTEXT 统一用 CLOB，长 JSON 用 VARCHAR(4000)。

CREATE TABLE IF NOT EXISTS zkb_material (
    id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    material_type VARCHAR(16) NOT NULL,
    entry_type VARCHAR(16) NOT NULL,
    title VARCHAR(255) NOT NULL,
    source_type VARCHAR(32) NULL,
    source_binding_id VARCHAR(64) NULL,
    category_id VARCHAR(64) NULL,
    material_status VARCHAR(16) NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    current_version_id VARCHAR(64) NULL,
    metadata VARCHAR(4000) NULL,
    registered_by VARCHAR(64) NULL,
    registered_at TIMESTAMP(3) NOT NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_material_id ON zkb_material (tenant_code, material_id, is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_material_fp ON zkb_material (tenant_code, kb_id, material_type, fingerprint, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_material_kb ON zkb_material (tenant_code, kb_id, is_deleted, create_time);
CREATE INDEX IF NOT EXISTS idx_zkb_material_category ON zkb_material (tenant_code, kb_id, category_id);
CREATE INDEX IF NOT EXISTS idx_zkb_material_source ON zkb_material (tenant_code, kb_id, source_binding_id);

CREATE TABLE IF NOT EXISTS zkb_material_version (
    id VARCHAR(64) NOT NULL,
    version_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    version_no INT NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    source_version VARCHAR(64) NULL,
    current_parsed_draft_id VARCHAR(64) NULL,
    version_status VARCHAR(16) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_ext VARCHAR(16) NULL,
    size_bytes BIGINT NOT NULL,
    original_url VARCHAR(1024) NULL,
    registered_at TIMESTAMP(3) NOT NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_material_version_id ON zkb_material_version (tenant_code, version_id, is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_material_version_no ON zkb_material_version (tenant_code, material_id, version_no, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_material_version ON zkb_material_version (tenant_code, material_id, version_no);
CREATE INDEX IF NOT EXISTS idx_zkb_material_version_status ON zkb_material_version (tenant_code, kb_id, version_status);

CREATE TABLE IF NOT EXISTS zkb_material_parsed_draft (
    id VARCHAR(64) NOT NULL,
    draft_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    material_version_id VARCHAR(64) NOT NULL,
    parser_name VARCHAR(64) NOT NULL,
    parser_version VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    text_content CLOB NULL,
    failure_reason VARCHAR(1000) NULL,
    parsed_at TIMESTAMP(3) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_draft_id ON zkb_material_parsed_draft (tenant_code, draft_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_draft_version ON zkb_material_parsed_draft (tenant_code, material_version_id, parsed_at);
CREATE INDEX IF NOT EXISTS idx_zkb_draft_material ON zkb_material_parsed_draft (tenant_code, material_id);

CREATE TABLE IF NOT EXISTS zkb_category (
    id VARCHAR(64) NOT NULL,
    category_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    parent_id VARCHAR(64) NULL,
    name VARCHAR(50) NOT NULL,
    sort_no INT NOT NULL DEFAULT 0,
    node_kind VARCHAR(16) NOT NULL DEFAULT 'FOLDER',
    ext_json VARCHAR(4000) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_category_id ON zkb_category (tenant_code, category_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_category_parent ON zkb_category (tenant_code, kb_id, parent_id, sort_no);
