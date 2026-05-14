export const SCHEMA_DEFINITION = `
// ============================================
// TOKENZIP GRAPH SCHEMA - SurrealDB v2
// ============================================

// --- NODE TYPES ---

DEFINE TABLE OVERWRITE repository SCHEMAFULL;
DEFINE FIELD OVERWRITE type ON repository TYPE string DEFAULT 'repository';
DEFINE FIELD OVERWRITE name ON repository TYPE string;
DEFINE FIELD OVERWRITE root ON repository TYPE string;
DEFINE FIELD OVERWRITE created_at ON repository TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at ON repository TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE stats ON repository TYPE object DEFAULT { files: 0, modules: 0, symbols: 0 };
DEFINE FIELD OVERWRITE stats.files ON repository TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE stats.modules ON repository TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE stats.symbols ON repository TYPE int DEFAULT 0;

DEFINE TABLE OVERWRITE module SCHEMAFULL;
DEFINE FIELD OVERWRITE type ON module TYPE string DEFAULT 'module';
DEFINE FIELD OVERWRITE name ON module TYPE string;
DEFINE FIELD OVERWRITE path ON module TYPE option<string>;
DEFINE FIELD OVERWRITE manifest_type ON module TYPE option<string>;
DEFINE FIELD OVERWRITE language ON module TYPE option<string>;
DEFINE FIELD OVERWRITE is_root ON module TYPE option<bool> DEFAULT false;
DEFINE FIELD OVERWRITE metadata ON module TYPE option<object>;
DEFINE FIELD OVERWRITE repository_id ON module TYPE option<record<repository>>;

DEFINE TABLE OVERWRITE file SCHEMAFULL;
DEFINE FIELD OVERWRITE type ON file TYPE string DEFAULT 'file';
DEFINE FIELD OVERWRITE path ON file TYPE string;
DEFINE FIELD OVERWRITE module_id ON file TYPE option<record<module>>;
DEFINE FIELD OVERWRITE language ON file TYPE string;
DEFINE FIELD OVERWRITE ext ON file TYPE string;
DEFINE FIELD OVERWRITE size_bytes ON file TYPE int;
DEFINE FIELD OVERWRITE content_hash ON file TYPE string;
DEFINE FIELD OVERWRITE line_count ON file TYPE int;
DEFINE FIELD OVERWRITE parse_status ON file TYPE string 
  ASSERT $value IN ['parsed', 'partial', 'failed', 'skipped'];
DEFINE FIELD OVERWRITE parse_error ON file TYPE option<string>;
DEFINE FIELD OVERWRITE last_parsed ON file TYPE datetime;
DEFINE FIELD OVERWRITE git_last_modified ON file TYPE option<datetime>;
DEFINE FIELD OVERWRITE git_blame_summary ON file TYPE option<object>;
DEFINE FIELD OVERWRITE mtime ON file TYPE option<string>;
DEFINE FIELD OVERWRITE git_hash ON file TYPE option<string>;

DEFINE TABLE OVERWRITE symbol SCHEMALESS;
DEFINE FIELD OVERWRITE type ON symbol TYPE string DEFAULT 'symbol';
DEFINE FIELD OVERWRITE fileId ON symbol TYPE record<file>;
DEFINE FIELD OVERWRITE name ON symbol TYPE string;
DEFINE FIELD OVERWRITE kind ON symbol TYPE string;
DEFINE FIELD OVERWRITE signature ON symbol TYPE option<string>;
DEFINE FIELD OVERWRITE returnType ON symbol TYPE option<string>;
DEFINE FIELD OVERWRITE startLine ON symbol TYPE int;
DEFINE FIELD OVERWRITE endLine ON symbol TYPE int;
DEFINE FIELD OVERWRITE startCol ON symbol TYPE int;
DEFINE FIELD OVERWRITE endCol ON symbol TYPE int;
DEFINE FIELD OVERWRITE docstring ON symbol TYPE option<string>;
DEFINE FIELD OVERWRITE docStartLine ON symbol TYPE option<int>;
DEFINE FIELD OVERWRITE docEndLine ON symbol TYPE option<int>;
DEFINE FIELD OVERWRITE isExported ON symbol TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE isAsync ON symbol TYPE option<bool>;
DEFINE FIELD OVERWRITE isStatic ON symbol TYPE option<bool>;
DEFINE FIELD OVERWRITE visibility ON symbol TYPE option<string>
  ASSERT $value IN [null, 'public', 'private', 'protected'];
DEFINE FIELD OVERWRITE modifiers ON symbol TYPE array;
DEFINE FIELD OVERWRITE parentSymbolId ON symbol TYPE option<string>;
DEFINE FIELD OVERWRITE metadata ON symbol TYPE object;

DEFINE TABLE OVERWRITE commit SCHEMALESS;
DEFINE FIELD OVERWRITE hash ON commit TYPE string;
DEFINE FIELD OVERWRITE short_hash ON commit TYPE option<string>;
DEFINE FIELD OVERWRITE message ON commit TYPE string;
DEFINE FIELD OVERWRITE author ON commit TYPE string;
DEFINE FIELD OVERWRITE email ON commit TYPE option<string>;
DEFINE FIELD OVERWRITE date ON commit TYPE datetime;
DEFINE FIELD OVERWRITE branch ON commit TYPE option<string>;
DEFINE FIELD OVERWRITE tags ON commit TYPE array DEFAULT [];

DEFINE TABLE OVERWRITE dependency SCHEMALESS;
DEFINE FIELD OVERWRITE module_id ON dependency TYPE record<module>;
DEFINE FIELD OVERWRITE name ON dependency TYPE string;
DEFINE FIELD OVERWRITE version ON dependency TYPE string;
DEFINE FIELD OVERWRITE dev ON dependency TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE source ON dependency TYPE string;

// --- EDGE TYPES ---

DEFINE TABLE OVERWRITE contains SCHEMALESS TYPE RELATION IN repository | module | file | symbol OUT module | file | symbol;
DEFINE FIELD OVERWRITE last_updated ON contains TYPE datetime DEFAULT time::now();
DEFINE TABLE OVERWRITE imports SCHEMALESS TYPE RELATION IN file | symbol | module OUT file | symbol | module;
DEFINE FIELD OVERWRITE metadata ON imports TYPE option<object>;

DEFINE TABLE OVERWRITE exports SCHEMALESS TYPE RELATION IN file | symbol OUT symbol | file;
DEFINE FIELD OVERWRITE metadata ON exports TYPE option<object>;

DEFINE TABLE OVERWRITE calls SCHEMALESS TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON calls TYPE option<object>;

DEFINE TABLE OVERWRITE implements SCHEMALESS TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON implements TYPE option<object>;

DEFINE TABLE OVERWRITE inherits SCHEMALESS TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON inherits TYPE option<object>;

DEFINE TABLE OVERWRITE modifies SCHEMALESS TYPE RELATION IN symbol OUT symbol;
DEFINE TABLE OVERWRITE reads SCHEMALESS TYPE RELATION IN symbol OUT symbol;
DEFINE TABLE OVERWRITE references SCHEMALESS TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON references TYPE option<object>;

DEFINE TABLE OVERWRITE depends_on SCHEMALESS TYPE RELATION IN module | file OUT module | file;
DEFINE FIELD OVERWRITE metadata ON depends_on TYPE option<object>;

DEFINE TABLE OVERWRITE modified_in SCHEMALESS TYPE RELATION IN file OUT commit;
DEFINE FIELD OVERWRITE metadata ON modified_in TYPE option<object>;

DEFINE TABLE OVERWRITE foreign_key SCHEMALESS TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON foreign_key TYPE option<object>;

DEFINE TABLE OVERWRITE column_of SCHEMALESS TYPE RELATION IN symbol OUT symbol;

DEFINE TABLE OVERWRITE diagram_edge SCHEMALESS TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON diagram_edge TYPE option<object>;

DEFINE TABLE OVERWRITE workflow_transition SCHEMALESS TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON workflow_transition TYPE option<object>;

// --- INDEXES ---

DEFINE INDEX OVERWRITE idx_file_path ON file FIELDS path UNIQUE;
DEFINE INDEX OVERWRITE idx_file_hash ON file FIELDS content_hash;
DEFINE INDEX OVERWRITE idx_file_module ON file FIELDS module_id;
DEFINE INDEX OVERWRITE idx_symbol_name ON symbol FIELDS name;
DEFINE INDEX OVERWRITE idx_symbol_kind ON symbol FIELDS kind;
DEFINE INDEX OVERWRITE idx_symbol_file ON symbol FIELDS fileId;
DEFINE INDEX OVERWRITE idx_symbol_file_start ON symbol FIELDS fileId, startLine;
DEFINE INDEX OVERWRITE idx_symbol_export ON symbol FIELDS isExported;
DEFINE INDEX OVERWRITE idx_module_path ON module FIELDS path UNIQUE;
DEFINE INDEX OVERWRITE idx_commit_hash ON commit FIELDS hash UNIQUE;
DEFINE INDEX OVERWRITE idx_dep_name ON dependency FIELDS name, module_id;

// --- FULL TEXT SEARCH INDEXES ---
// DEFINE INDEX OVERWRITE idx_symbol_search ON symbol FIELDS name, docstring SEARCH ANALYZER ascii BM25 HIGHLIGHTS;
// DEFINE INDEX OVERWRITE idx_file_search ON file FIELDS path SEARCH ANALYZER ascii BM25;

// --- ANALYTICS ---

DEFINE TABLE OVERWRITE usage_log SCHEMAFULL;
DEFINE FIELD OVERWRITE timestamp ON usage_log TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE tool_name ON usage_log TYPE string;
DEFINE FIELD OVERWRITE file_path ON usage_log TYPE option<string>;
DEFINE FIELD OVERWRITE smart_tokens ON usage_log TYPE int;
DEFINE FIELD OVERWRITE naive_tokens ON usage_log TYPE int;
DEFINE FIELD OVERWRITE savings_percent ON usage_log TYPE float;

// --- CORTEX: PERSISTENT KNOWLEDGE LAYER ---

DEFINE TABLE OVERWRITE annotation SCHEMAFULL;
DEFINE FIELD OVERWRITE type ON annotation TYPE string DEFAULT 'annotation';
DEFINE FIELD OVERWRITE category ON annotation TYPE string
  ASSERT $value IN [
    'guideline',        // coding, testing, security, naming (use tags for sub-type)
    'architecture',     // design patterns, architectural decisions, module overview
    'gotcha',           // non-obvious behavior, edge cases, traps
    'traversal_hint',   // reading orders, skip paths for modules
    'workflow',         // deploy sequences, setup steps, operational procedures
    'todo'              // persistent TODOs that survive sessions
  ];

// Content — split for token optimization
DEFINE FIELD OVERWRITE title ON annotation TYPE string;
DEFINE FIELD OVERWRITE summary ON annotation TYPE string;
DEFINE FIELD OVERWRITE details ON annotation TYPE option<string>;

// Provenance
DEFINE FIELD OVERWRITE source ON annotation TYPE string DEFAULT 'developer'
  ASSERT $value IN ['developer', 'agent', 'traversal'];
DEFINE FIELD OVERWRITE confidence ON annotation TYPE float DEFAULT 1.0;
DEFINE FIELD OVERWRITE tags ON annotation TYPE array DEFAULT [];

// Priority & Lifecycle
DEFINE FIELD OVERWRITE priority ON annotation TYPE string DEFAULT 'normal'
  ASSERT $value IN ['critical', 'important', 'normal', 'low'];
DEFINE FIELD OVERWRITE supersedes ON annotation TYPE option<record<annotation>>;
DEFINE FIELD OVERWRITE is_active ON annotation TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE removal_reason ON annotation TYPE option<string>;

// Staleness Detection — snapshot of target file's content_hash at write time
DEFINE FIELD OVERWRITE target_hash ON annotation TYPE option<string>;

// Usage Tracking
DEFINE FIELD OVERWRITE access_count ON annotation TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE last_accessed ON annotation TYPE option<datetime>;

// Traversal Hint Fields (only populated when category = 'traversal_hint')
DEFINE FIELD OVERWRITE read_order ON annotation TYPE array DEFAULT [];
DEFINE FIELD OVERWRITE skip_paths ON annotation TYPE array DEFAULT [];

// Timestamps
DEFINE FIELD OVERWRITE created_at ON annotation TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at ON annotation TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE session_id ON annotation TYPE option<string>;

// --- Suggestion Table (structured improvement requests) ---

DEFINE TABLE OVERWRITE suggestion SCHEMAFULL;
DEFINE FIELD OVERWRITE type ON suggestion TYPE string DEFAULT 'suggestion';
DEFINE FIELD OVERWRITE problem ON suggestion TYPE string;
DEFINE FIELD OVERWRITE proposed ON suggestion TYPE string;
DEFINE FIELD OVERWRITE kpi_impact ON suggestion TYPE option<string>;
DEFINE FIELD OVERWRITE severity ON suggestion TYPE string DEFAULT 'medium'
  ASSERT $value IN ['low', 'medium', 'high', 'critical'];
DEFINE FIELD OVERWRITE related_targets ON suggestion TYPE array DEFAULT [];
DEFINE FIELD OVERWRITE status ON suggestion TYPE string DEFAULT 'new'
  ASSERT $value IN ['new', 'acknowledged', 'implemented', 'dismissed'];
DEFINE FIELD OVERWRITE occurrence_count ON suggestion TYPE int DEFAULT 1;
DEFINE FIELD OVERWRITE created_at ON suggestion TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE session_id ON suggestion TYPE option<string>;

// --- Cortex Edges ---

DEFINE TABLE OVERWRITE scoped_to SCHEMALESS
  TYPE RELATION IN annotation OUT repository | module | file | symbol;
DEFINE FIELD OVERWRITE scope_type ON scoped_to TYPE string
  ASSERT $value IN ['codebase', 'module', 'file', 'symbol'];

DEFINE TABLE OVERWRITE tagged_with SCHEMALESS
  TYPE RELATION IN repository | module | file | symbol OUT annotation;

DEFINE TABLE OVERWRITE relates_to SCHEMALESS
  TYPE RELATION IN suggestion OUT repository | module | file | symbol;

// --- Cortex Indexes ---

DEFINE INDEX OVERWRITE idx_annotation_category ON annotation FIELDS category;
DEFINE INDEX OVERWRITE idx_annotation_active ON annotation FIELDS is_active;
DEFINE INDEX OVERWRITE idx_annotation_source ON annotation FIELDS source;
DEFINE INDEX OVERWRITE idx_annotation_priority ON annotation FIELDS priority;
DEFINE INDEX OVERWRITE idx_suggestion_status ON suggestion FIELDS status;
DEFINE INDEX OVERWRITE idx_suggestion_severity ON suggestion FIELDS severity;
`;
