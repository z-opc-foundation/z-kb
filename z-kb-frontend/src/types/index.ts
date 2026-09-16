export interface Document {
  id: string;
  title: string;
  content?: string;
  body?: string;
  frontmatter?: Record<string, any>;
  tags?: string[];
  workspace: string;
  author?: string;
  sourceUrl?: string;
  path?: string;
  category?: string;
  status?: string;
  wordCount?: number;
  chunkCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportResult {
  documentId: string;
  title: string;
  chunkCount: number;
  entityCount: number;
  relationCount: number;
  elapsedMillis: number;
  success: boolean;
  errorMessage?: string;
}

export interface SearchQuery {
  query: string;
  workspace?: string;
  topK?: number;
  mode?: 'VECTOR' | 'KEYWORD' | 'GRAPH' | 'HYBRID' | 'FUSION';
  vectorWeight?: number;
  keywordWeight?: number;
  graphWeight?: number;
  tags?: string[];
  includeContent?: boolean;
}

export interface SearchHit {
  chunkId: string;
  documentId: string;
  documentTitle?: string;
  content?: string;
  contextTitle?: string;
  headingPath?: string[];
  score: number;
  source: string;
  matchedKeywords?: string[];
  matchedEntities?: string[];
}

export interface SearchResult {
  query: string;
  mode: string;
  totalHits: number;
  hits: SearchHit[];
  elapsedMillis: number;
  stats?: Record<string, number>;
  matchedEntities?: Entity[];
}

export interface Entity {
  id?: string;
  canonicalName: string;
  displayName?: string;
  type: string;
  description?: string;
  frequency?: number;
  importance?: number;
}

export interface Relation {
  id?: string;
  sourceEntityName: string;
  targetEntityName: string;
  type: string;
  weight?: number;
}

export interface GraphQueryResult {
  nodes: Entity[];
  edges: Relation[];
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  documentCount?: number;
  chunkCount?: number;
  entityCount?: number;
  relationCount?: number;
  embeddingProvider?: string;
}

export interface KBStatistics {
  workspace: string;
  documentCount: number;
  chunkCount: number;
  entityCount: number;
  relationCount: number;
  totalSizeBytes: number;
  embeddingProvider?: string;
  tagCloud?: Record<string, number>;
  entityTypeDistribution?: Record<string, number>;
}

export interface ChatSession {
  id: string;
  workspace?: string;
  title?: string;
  messages?: ChatMessage[];
  createdAt?: string;
}

export interface ChatMessage {
  id?: string;
  sessionId?: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  references?: SearchHit[];
  mentionedEntities?: Entity[];
  createdAt?: string;
}

export interface ChatResponse {
  sessionId?: string;
  messageId?: string;
  answer: string;
  references?: SearchHit[];
  relatedEntities?: Entity[];
  model?: string;
  elapsedMillis?: number;
}
