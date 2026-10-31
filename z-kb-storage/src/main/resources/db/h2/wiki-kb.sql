-- z-kb Wiki 域 H2 元数据表（MySQL 兼容模式，幂等）
-- 与 db/mysql/wiki-kb.sql 保持同构；索引用独立语句。

CREATE TABLE IF NOT EXISTS zkb_wiki_page (
    id VARCHAR(64) NOT NULL,
    wiki_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    material_version_id VARCHAR(64) NOT NULL,
    artifact_id VARCHAR(64) NULL,
    page_slug VARCHAR(128) NULL,
    title VARCHAR(255) NOT NULL,
    summary VARCHAR(255) NULL,
    content CLOB NOT NULL,
    source_chunk_ids VARCHAR(2000) NULL,
    generator VARCHAR(16) NOT NULL DEFAULT 'RULES',
    point_count INT NOT NULL DEFAULT 0,
    char_count INT NOT NULL DEFAULT 0,
    version_no INT NOT NULL DEFAULT 1,
    source_hash CHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'READY',
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_wiki_id ON zkb_wiki_page (tenant_code, wiki_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_wiki_kb ON zkb_wiki_page (tenant_code, kb_id, is_deleted, update_time);
CREATE INDEX IF NOT EXISTS idx_zkb_wiki_material ON zkb_wiki_page (tenant_code, material_id, is_deleted, page_slug);
CREATE INDEX IF NOT EXISTS idx_zkb_wiki_version ON zkb_wiki_page (tenant_code, material_id, material_version_id);

CREATE TABLE IF NOT EXISTS zkb_wiki_page_source (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    wiki_id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    material_version_id VARCHAR(64) NOT NULL,
    material_title VARCHAR(255) NULL,
    source_version_no INT NOT NULL DEFAULT 1,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_wiki_source ON zkb_wiki_page_source (tenant_code, wiki_id, material_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_wiki_source_material ON zkb_wiki_page_source (tenant_code, material_id);

CREATE TABLE IF NOT EXISTS zkb_wiki_doc (
    id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    material_version_id VARCHAR(64) NOT NULL,
    index_md CLOB NULL,
    page_count INT NOT NULL DEFAULT 0,
    chunk_count INT NOT NULL DEFAULT 0,
    covered_chunk_count INT NOT NULL DEFAULT 0,
    generator VARCHAR(16) NOT NULL DEFAULT 'AGENT',
    version_no INT NOT NULL DEFAULT 1,
    source_hash CHAR(64) NOT NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_wiki_doc_version ON zkb_wiki_doc (tenant_code, material_id, material_version_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_wiki_doc_material ON zkb_wiki_doc (tenant_code, material_id, is_deleted);
