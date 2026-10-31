-- z-kb Wiki 域 MySQL 元数据表（幂等，可重复执行）
-- 与 db/h2/wiki-kb.sql 保持同构；索引随建表内联。
-- 页面表同时承载规则页（page_slug 为空）与 Agent 多页；来源表只记证据关系，
-- 目录表一物料版本一行，记录页面集合与证据块覆盖。

CREATE TABLE IF NOT EXISTS zkb_wiki_page (
    id VARCHAR(64) NOT NULL COMMENT '主键',
    wiki_id VARCHAR(64) NOT NULL COMMENT 'Wiki 页面业务标识（UUID）',
    tenant_code VARCHAR(64) NOT NULL COMMENT '租户编码',
    kb_id VARCHAR(64) NOT NULL COMMENT '所属知识库业务标识',
    material_id VARCHAR(64) NOT NULL COMMENT '主物料业务标识',
    material_version_id VARCHAR(64) NOT NULL COMMENT '生成所依据的物料版本业务标识',
    artifact_id VARCHAR(64) NULL COMMENT '对应的 WIKI_DOC 产物业务标识',
    page_slug VARCHAR(128) NULL COMMENT 'Agent 页面标识；规则页为空',
    title VARCHAR(255) NOT NULL COMMENT '页面标题',
    summary VARCHAR(255) NULL COMMENT '页面摘要',
    content MEDIUMTEXT NOT NULL COMMENT '页面正文',
    source_chunk_ids VARCHAR(2000) NULL COMMENT '证据块编码，逗号分隔',
    generator VARCHAR(16) NOT NULL DEFAULT 'RULES' COMMENT '生成方式：RULES/AGENT',
    point_count INT NOT NULL DEFAULT 0 COMMENT '正文要点数量',
    char_count INT NOT NULL DEFAULT 0 COMMENT '正文字符数',
    version_no INT NOT NULL DEFAULT 1 COMMENT '页面版本号',
    source_hash CHAR(64) NOT NULL COMMENT '来源内容哈希',
    status VARCHAR(16) NOT NULL DEFAULT 'READY' COMMENT 'READY/FAILED/DELETED',
    is_deleted INT NOT NULL DEFAULT 0 COMMENT '0-未删除 1-已删除',
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time DATETIME(3) NULL,
    update_time DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_zkb_wiki_id (tenant_code, wiki_id, is_deleted),
    KEY idx_zkb_wiki_kb (tenant_code, kb_id, is_deleted, update_time),
    KEY idx_zkb_wiki_material (tenant_code, material_id, is_deleted, page_slug),
    KEY idx_zkb_wiki_version (tenant_code, material_id, material_version_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Wiki 页面产物';

CREATE TABLE IF NOT EXISTS zkb_wiki_page_source (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    wiki_id VARCHAR(64) NOT NULL COMMENT '所属 Wiki 页面业务标识',
    material_id VARCHAR(64) NOT NULL COMMENT '来源物料业务标识',
    material_version_id VARCHAR(64) NOT NULL COMMENT '来源物料版本业务标识',
    material_title VARCHAR(255) NULL COMMENT '来源物料标题快照',
    source_version_no INT NOT NULL DEFAULT 1 COMMENT '来源物料版本序号',
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time DATETIME(3) NULL,
    update_time DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_zkb_wiki_source (tenant_code, wiki_id, material_id, is_deleted),
    KEY idx_zkb_wiki_source_material (tenant_code, material_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Wiki 页面来源资料';

CREATE TABLE IF NOT EXISTS zkb_wiki_doc (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    material_version_id VARCHAR(64) NOT NULL,
    index_md TEXT NULL COMMENT '目录正文（markdown）',
    page_count INT NOT NULL DEFAULT 0 COMMENT '页面数',
    chunk_count INT NOT NULL DEFAULT 0 COMMENT '输入证据块数',
    covered_chunk_count INT NOT NULL DEFAULT 0 COMMENT '被页面引用的块数',
    generator VARCHAR(16) NOT NULL DEFAULT 'AGENT' COMMENT '生成方式：RULES/AGENT',
    version_no INT NOT NULL DEFAULT 1 COMMENT '目录版本号，重新编译递增',
    source_hash CHAR(64) NOT NULL COMMENT '目录与页面集合指纹',
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time DATETIME(3) NULL,
    update_time DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_zkb_wiki_doc_version (tenant_code, material_id, material_version_id, is_deleted),
    KEY idx_zkb_wiki_doc_material (tenant_code, material_id, is_deleted)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Wiki 文档目录';
