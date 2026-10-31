-- z-kb 资源域 H2 元数据表（MySQL 兼容模式，幂等）
-- 与 db/mysql/resource-kb.sql 保持同构；索引用独立语句（MySQL 不支持 CREATE INDEX IF NOT EXISTS）。

CREATE TABLE IF NOT EXISTS zkb_knowledge_base (
    id VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(64) NOT NULL,
    type VARCHAR(16) NOT NULL,
    description VARCHAR(500) NULL,
    owner_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    embedding_model VARCHAR(64) NULL,
    primary_graph_space_key VARCHAR(128) NULL,
    archived_at TIMESTAMP(3) NULL,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_kb_tenant_code ON zkb_knowledge_base (tenant_code, code);
CREATE INDEX IF NOT EXISTS idx_zkb_kb_tenant_status ON zkb_knowledge_base (tenant_code, status);
CREATE INDEX IF NOT EXISTS idx_zkb_kb_owner ON zkb_knowledge_base (tenant_code, owner_id);

CREATE TABLE IF NOT EXISTS zkb_knowledge_base_acl (
    id VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    principal_id VARCHAR(64) NOT NULL,
    principal_type VARCHAR(16) NOT NULL,
    role VARCHAR(16) NOT NULL,
    granted_by VARCHAR(64) NULL,
    granted_at TIMESTAMP(3) NULL,
    expires_at TIMESTAMP(3) NULL,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_acl_kb_principal ON zkb_knowledge_base_acl (tenant_code, kb_id, principal_type, principal_id);
CREATE INDEX IF NOT EXISTS idx_zkb_acl_principal ON zkb_knowledge_base_acl (tenant_code, principal_id);

CREATE TABLE IF NOT EXISTS zkb_knowledge_base_profile (
    id VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    type VARCHAR(16) NOT NULL,
    preset_version VARCHAR(32) NULL,
    parser_policy VARCHAR(4000) NULL,
    chunking_policy VARCHAR(4000) NULL,
    extraction_policy VARCHAR(4000) NULL,
    wiki_policy VARCHAR(4000) NULL,
    graph_policy VARCHAR(4000) NULL,
    review_policy VARCHAR(4000) NULL,
    freshness_policy VARCHAR(4000) NULL,
    retrieval_policy VARCHAR(4000) NULL,
    source_policy VARCHAR(4000) NULL,
    config_version INT NULL,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_profile_kb ON zkb_knowledge_base_profile (tenant_code, kb_id);

CREATE TABLE IF NOT EXISTS zkb_knowledge_base_profile_version (
    id VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    version_no INT NOT NULL,
    status VARCHAR(16) NOT NULL,
    preset_version VARCHAR(32) NULL,
    parser_policy VARCHAR(4000) NULL,
    chunking_policy VARCHAR(4000) NULL,
    extraction_policy VARCHAR(4000) NULL,
    wiki_policy VARCHAR(4000) NULL,
    graph_policy VARCHAR(4000) NULL,
    review_policy VARCHAR(4000) NULL,
    freshness_policy VARCHAR(4000) NULL,
    retrieval_policy VARCHAR(4000) NULL,
    source_policy VARCHAR(4000) NULL,
    remark VARCHAR(500) NULL,
    published_by VARCHAR(64) NULL,
    published_at TIMESTAMP(3) NULL,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_profile_version_no ON zkb_knowledge_base_profile_version (tenant_code, kb_id, version_no);
CREATE INDEX IF NOT EXISTS idx_zkb_profile_version_status ON zkb_knowledge_base_profile_version (tenant_code, kb_id, status);

CREATE TABLE IF NOT EXISTS zkb_audit_log (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NULL,
    actor_id VARCHAR(64) NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NULL,
    target_id VARCHAR(64) NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    detail VARCHAR(1000) NULL,
    created_at TIMESTAMP(3) NOT NULL,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_zkb_audit_kb_day ON zkb_audit_log (tenant_code, kb_id, created_at);
