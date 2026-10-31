-- z-kb 资源域 MySQL 元数据表（幂等，可重复执行）
-- 原始文件走对象存储，这里只放元数据。

CREATE TABLE IF NOT EXISTS zkb_knowledge_base (
    id VARCHAR(64) NOT NULL COMMENT '主键',
    kb_id VARCHAR(64) NOT NULL COMMENT '知识库业务标识',
    tenant_code VARCHAR(64) NOT NULL COMMENT '租户编码',
    name VARCHAR(100) NOT NULL COMMENT '名称',
    code VARCHAR(64) NOT NULL COMMENT '租户内唯一编码',
    type VARCHAR(16) NOT NULL COMMENT 'FILE/MIX/YUQUE/CODE',
    description VARCHAR(500) NULL COMMENT '描述',
    owner_id VARCHAR(64) NOT NULL COMMENT '所有者',
    status VARCHAR(16) NOT NULL COMMENT 'ACTIVE/ARCHIVED/DELETING',
    embedding_model VARCHAR(64) NULL COMMENT '嵌入模型标识',
    primary_graph_space_key VARCHAR(128) NULL COMMENT '主图谱空间',
    archived_at DATETIME(3) NULL COMMENT '归档时间',
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time DATETIME(3) NULL,
    update_time DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_zkb_kb_tenant_code (tenant_code, code),
    KEY idx_zkb_kb_tenant_status (tenant_code, status),
    KEY idx_zkb_kb_owner (tenant_code, owner_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '知识库';

CREATE TABLE IF NOT EXISTS zkb_knowledge_base_acl (
    id VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    principal_id VARCHAR(64) NOT NULL COMMENT '主体标识',
    principal_type VARCHAR(16) NOT NULL COMMENT 'USER/GROUP/SERVICE',
    role VARCHAR(16) NOT NULL COMMENT 'KB_ADMIN/EDITOR/CONTRIBUTOR/REVIEWER/READER',
    granted_by VARCHAR(64) NULL,
    granted_at DATETIME(3) NULL,
    expires_at DATETIME(3) NULL,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time DATETIME(3) NULL,
    update_time DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_zkb_acl_kb_principal (tenant_code, kb_id, principal_type, principal_id),
    KEY idx_zkb_acl_principal (tenant_code, principal_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '知识库 ACL';

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
    create_time DATETIME(3) NULL,
    update_time DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_zkb_profile_kb (tenant_code, kb_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '知识库配置档案';

CREATE TABLE IF NOT EXISTS zkb_knowledge_base_profile_version (
    id VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    version_no INT NOT NULL,
    status VARCHAR(16) NOT NULL COMMENT 'DRAFT/CURRENT/SUPERSEDED',
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
    published_at DATETIME(3) NULL,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time DATETIME(3) NULL,
    update_time DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_zkb_profile_version_no (tenant_code, kb_id, version_no),
    KEY idx_zkb_profile_version_status (tenant_code, kb_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '知识库配置版本';

CREATE TABLE IF NOT EXISTS zkb_audit_log (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NULL,
    actor_id VARCHAR(64) NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NULL,
    target_id VARCHAR(64) NULL,
    success TINYINT(1) NOT NULL DEFAULT 1,
    detail VARCHAR(1000) NULL,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_zkb_audit_kb_day (tenant_code, kb_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '知识库审计日志';
