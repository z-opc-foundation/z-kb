-- z-***REMOVED*** 物料域 H2 元数据表（MySQL 兼容模式，幂等）
-- 与 db/mysql/material-***REMOVED***.sql 保持同构；索引用独立语句。
-- H2 下 TEXT/MEDIUMTEXT 统一用 CLOB，长 JSON 用 VARCHAR(4000)。

CREATE TABLE IF NOT EXISTS z***REMOVED***_material (
    id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    ***REMOVED***_id VARCHAR(64) NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS uk_z***REMOVED***_material_id ON z***REMOVED***_material (tenant_code, material_id, is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS uk_z***REMOVED***_material_fp ON z***REMOVED***_material (tenant_code, ***REMOVED***_id, material_type, fingerprint, is_deleted);
CREATE INDEX IF NOT EXISTS idx_z***REMOVED***_material_***REMOVED*** ON z***REMOVED***_material (tenant_code, ***REMOVED***_id, is_deleted, create_time);
CREATE INDEX IF NOT EXISTS idx_z***REMOVED***_material_category ON z***REMOVED***_material (tenant_code, ***REMOVED***_id, category_id);
CREATE INDEX IF NOT EXISTS idx_z***REMOVED***_material_source ON z***REMOVED***_material (tenant_code, ***REMOVED***_id, source_binding_id);

CREATE TABLE IF NOT EXISTS z***REMOVED***_material_version (
    id VARCHAR(64) NOT NULL,
    version_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    ***REMOVED***_id VARCHAR(64) NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS uk_z***REMOVED***_material_version_id ON z***REMOVED***_material_version (tenant_code, version_id, is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS uk_z***REMOVED***_material_version_no ON z***REMOVED***_material_version (tenant_code, material_id, version_no, is_deleted);
CREATE INDEX IF NOT EXISTS idx_z***REMOVED***_material_version ON z***REMOVED***_material_version (tenant_code, material_id, version_no);
CREATE INDEX IF NOT EXISTS idx_z***REMOVED***_material_version_status ON z***REMOVED***_material_version (tenant_code, ***REMOVED***_id, version_status);

CREATE TABLE IF NOT EXISTS z***REMOVED***_material_parsed_draft (
    id VARCHAR(64) NOT NULL,
    draft_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    ***REMOVED***_id VARCHAR(64) NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS uk_z***REMOVED***_draft_id ON z***REMOVED***_material_parsed_draft (tenant_code, draft_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_z***REMOVED***_draft_version ON z***REMOVED***_material_parsed_draft (tenant_code, material_version_id, parsed_at);
CREATE INDEX IF NOT EXISTS idx_z***REMOVED***_draft_material ON z***REMOVED***_material_parsed_draft (tenant_code, material_id);

CREATE TABLE IF NOT EXISTS z***REMOVED***_category (
    id VARCHAR(64) NOT NULL,
    category_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    ***REMOVED***_id VARCHAR(64) NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS uk_z***REMOVED***_category_id ON z***REMOVED***_category (tenant_code, category_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_z***REMOVED***_category_parent ON z***REMOVED***_category (tenant_code, ***REMOVED***_id, parent_id, sort_no);
