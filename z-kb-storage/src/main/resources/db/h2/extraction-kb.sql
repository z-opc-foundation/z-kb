-- z-kb 萃取/概念/图谱 H2 元数据表（MySQL 兼容模式，幂等）
-- 与 db/mysql/extraction-kb.sql 保持同构；索引用独立语句。

CREATE TABLE IF NOT EXISTS zkb_extraction_item (
    id VARCHAR(64) NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    material_version_id VARCHAR(64) NOT NULL,
    item_type VARCHAR(16) NOT NULL,
    seq INT NOT NULL DEFAULT 0,
    title VARCHAR(255) NOT NULL,
    content CLOB NOT NULL,
    evidence_json VARCHAR(4000) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_extract_item_id ON zkb_extraction_item (tenant_code, item_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_extract_version ON zkb_extraction_item (tenant_code, material_version_id, item_type, seq, id);
CREATE INDEX IF NOT EXISTS idx_zkb_extract_material ON zkb_extraction_item (tenant_code, kb_id, material_id, item_type);

CREATE TABLE IF NOT EXISTS zkb_concept (
    id VARCHAR(64) NOT NULL,
    concept_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    concept_type VARCHAR(16) NOT NULL DEFAULT 'TERM',
    status VARCHAR(16) NOT NULL DEFAULT 'EMERGING',
    definition VARCHAR(500) NULL,
    aliases_json VARCHAR(4000) NULL,
    mention_count INT NOT NULL DEFAULT 0,
    material_count INT NOT NULL DEFAULT 0,
    first_material_id VARCHAR(64) NULL,
    last_material_id VARCHAR(64) NULL,
    evidence_json VARCHAR(4000) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_concept_id ON zkb_concept (tenant_code, concept_id, is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_concept_name ON zkb_concept (tenant_code, kb_id, normalized_name, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_concept_status ON zkb_concept (tenant_code, kb_id, status);
CREATE INDEX IF NOT EXISTS idx_zkb_concept_material ON zkb_concept (tenant_code, kb_id, last_material_id);

CREATE TABLE IF NOT EXISTS zkb_concept_mention (
    id VARCHAR(64) NOT NULL,
    mention_id VARCHAR(64) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    concept_id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    material_version_id VARCHAR(64) NOT NULL,
    material_title VARCHAR(255) NULL,
    extraction_item_id VARCHAR(64) NULL,
    chunk_ordinal INT NOT NULL DEFAULT 0,
    occurrence_count INT NOT NULL DEFAULT 1,
    evidence_json VARCHAR(4000) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_mention_id ON zkb_concept_mention (tenant_code, mention_id, is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS uk_zkb_mention_concept_version ON zkb_concept_mention (tenant_code, material_version_id, concept_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_zkb_mention_concept ON zkb_concept_mention (tenant_code, kb_id, concept_id);
CREATE INDEX IF NOT EXISTS idx_zkb_mention_material ON zkb_concept_mention (tenant_code, material_id);
CREATE INDEX IF NOT EXISTS idx_zkb_mention_version ON zkb_concept_mention (tenant_code, material_version_id);

CREATE TABLE IF NOT EXISTS zkb_graph_node (
    id VARCHAR(64) NOT NULL,
    node_id VARCHAR(128) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    graph_space_key VARCHAR(128) NOT NULL,
    node_type VARCHAR(16) NOT NULL,
    concept_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    evidence_json VARCHAR(4000) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_zkb_graph_node_space ON zkb_graph_node (tenant_code, kb_id, graph_space_key);
CREATE INDEX IF NOT EXISTS idx_zkb_graph_node_material ON zkb_graph_node (tenant_code, material_id);
CREATE INDEX IF NOT EXISTS idx_zkb_graph_node_node ON zkb_graph_node (tenant_code, node_id);

CREATE TABLE IF NOT EXISTS zkb_graph_edge (
    id VARCHAR(64) NOT NULL,
    edge_id VARCHAR(128) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    graph_space_key VARCHAR(128) NOT NULL,
    edge_type VARCHAR(16) NOT NULL,
    source_node_id VARCHAR(128) NOT NULL,
    target_node_id VARCHAR(128) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    evidence_json VARCHAR(4000) NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    create_by VARCHAR(64) NULL,
    update_by VARCHAR(64) NULL,
    create_time TIMESTAMP(3) NULL,
    update_time TIMESTAMP(3) NULL,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_zkb_graph_edge_space ON zkb_graph_edge (tenant_code, kb_id, graph_space_key);
CREATE INDEX IF NOT EXISTS idx_zkb_graph_edge_material ON zkb_graph_edge (tenant_code, material_id);
CREATE INDEX IF NOT EXISTS idx_zkb_graph_edge_edge ON zkb_graph_edge (tenant_code, edge_id);
