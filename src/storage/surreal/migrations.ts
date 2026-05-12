export const SCHEMA_DEFINITION = `
// ============================================
// TOKENZIP GRAPH SCHEMA - SurrealDB v2
// ============================================

// --- NODE TYPES ---

DEFINE TABLE OVERWRITE repository SCHEMAFULL;
DEFINE FIELD OVERWRITE name ON repository TYPE string;
DEFINE FIELD OVERWRITE root ON repository TYPE string;
DEFINE FIELD OVERWRITE created_at ON repository TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at ON repository TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE stats ON repository TYPE object DEFAULT { files: 0, modules: 0, symbols: 0 };
DEFINE FIELD OVERWRITE stats.files ON repository TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE stats.modules ON repository TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE stats.symbols ON repository TYPE int DEFAULT 0;

DEFINE TABLE OVERWRITE module SCHEMAFULL;
DEFINE FIELD OVERWRITE name ON module TYPE string;
DEFINE FIELD OVERWRITE path ON module TYPE option<string>;
DEFINE FIELD OVERWRITE manifest_type ON module TYPE option<string>;
DEFINE FIELD OVERWRITE language ON module TYPE option<string>;
DEFINE FIELD OVERWRITE is_root ON module TYPE option<bool> DEFAULT false;
DEFINE FIELD OVERWRITE metadata ON module TYPE option<object>;
DEFINE FIELD OVERWRITE repository_id ON module TYPE option<record<repository>>;

DEFINE TABLE OVERWRITE file SCHEMAFULL;
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

DEFINE TABLE OVERWRITE symbol SCHEMAFULL;
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
DEFINE FIELD OVERWRITE isExported ON symbol TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE isAsync ON symbol TYPE option<bool>;
DEFINE FIELD OVERWRITE isStatic ON symbol TYPE option<bool>;
DEFINE FIELD OVERWRITE visibility ON symbol TYPE option<string>
  ASSERT $value IN [null, 'public', 'private', 'protected'];
DEFINE FIELD OVERWRITE modifiers ON symbol TYPE array;
DEFINE FIELD OVERWRITE parentSymbolId ON symbol TYPE option<string>;
DEFINE FIELD OVERWRITE metadata ON symbol TYPE object;

DEFINE TABLE OVERWRITE commit SCHEMAFULL;
DEFINE FIELD OVERWRITE hash ON commit TYPE string;
DEFINE FIELD OVERWRITE short_hash ON commit TYPE option<string>;
DEFINE FIELD OVERWRITE message ON commit TYPE string;
DEFINE FIELD OVERWRITE author ON commit TYPE string;
DEFINE FIELD OVERWRITE email ON commit TYPE option<string>;
DEFINE FIELD OVERWRITE date ON commit TYPE datetime;
DEFINE FIELD OVERWRITE branch ON commit TYPE option<string>;
DEFINE FIELD OVERWRITE tags ON commit TYPE array DEFAULT [];

DEFINE TABLE OVERWRITE dependency SCHEMAFULL;
DEFINE FIELD OVERWRITE module_id ON dependency TYPE record<module>;
DEFINE FIELD OVERWRITE name ON dependency TYPE string;
DEFINE FIELD OVERWRITE version ON dependency TYPE string;
DEFINE FIELD OVERWRITE dev ON dependency TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE source ON dependency TYPE string;

// --- EDGE TYPES ---

DEFINE TABLE OVERWRITE contains SCHEMAFULL TYPE RELATION IN repository | module | file | symbol OUT module | file | symbol;
DEFINE TABLE OVERWRITE imports SCHEMAFULL TYPE RELATION IN file | symbol | module OUT file | symbol | module;
DEFINE FIELD OVERWRITE metadata ON imports TYPE option<object>;

DEFINE TABLE OVERWRITE exports SCHEMAFULL TYPE RELATION IN file | symbol OUT symbol | file;
DEFINE FIELD OVERWRITE metadata ON exports TYPE option<object>;

DEFINE TABLE OVERWRITE calls SCHEMAFULL TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON calls TYPE option<object>;

DEFINE TABLE OVERWRITE implements SCHEMAFULL TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON implements TYPE option<object>;

DEFINE TABLE OVERWRITE inherits SCHEMAFULL TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON inherits TYPE option<object>;

DEFINE TABLE OVERWRITE modifies SCHEMAFULL TYPE RELATION IN symbol OUT symbol;
DEFINE TABLE OVERWRITE reads SCHEMAFULL TYPE RELATION IN symbol OUT symbol;
DEFINE TABLE OVERWRITE references SCHEMAFULL TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON references TYPE option<object>;

DEFINE TABLE OVERWRITE depends_on SCHEMAFULL TYPE RELATION IN module | file OUT module | file;
DEFINE FIELD OVERWRITE metadata ON depends_on TYPE option<object>;

DEFINE TABLE OVERWRITE modified_in SCHEMAFULL TYPE RELATION IN file OUT commit;
DEFINE FIELD OVERWRITE metadata ON modified_in TYPE option<object>;

DEFINE TABLE OVERWRITE foreign_key SCHEMAFULL TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON foreign_key TYPE option<object>;

DEFINE TABLE OVERWRITE column_of SCHEMAFULL TYPE RELATION IN symbol OUT symbol;

DEFINE TABLE OVERWRITE diagram_edge SCHEMAFULL TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON diagram_edge TYPE option<object>;

DEFINE TABLE OVERWRITE workflow_transition SCHEMAFULL TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD OVERWRITE metadata ON workflow_transition TYPE option<object>;

// --- INDEXES ---

DEFINE INDEX OVERWRITE idx_file_path ON file FIELDS path UNIQUE;
DEFINE INDEX OVERWRITE idx_file_hash ON file FIELDS content_hash;
DEFINE INDEX OVERWRITE idx_file_module ON file FIELDS module_id;
DEFINE INDEX OVERWRITE idx_symbol_name ON symbol FIELDS name;
DEFINE INDEX OVERWRITE idx_symbol_kind ON symbol FIELDS kind;
DEFINE INDEX OVERWRITE idx_symbol_file ON symbol FIELDS fileId;
DEFINE INDEX OVERWRITE idx_symbol_export ON symbol FIELDS isExported;
DEFINE INDEX OVERWRITE idx_module_path ON module FIELDS path UNIQUE;
DEFINE INDEX OVERWRITE idx_commit_hash ON commit FIELDS hash UNIQUE;
DEFINE INDEX OVERWRITE idx_dep_name ON dependency FIELDS name, module_id;
`;
