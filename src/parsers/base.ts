/**
 * Base interfaces for language parsers
 * Common structures shared across all language parsers
 */

export interface FunctionInfo {
  name: string;
  line: number;
  column: number;
  async: boolean;
  signature: string;
  type: string;
  jsdoc?: string;
}

export interface MethodInfo {
  name: string;
  line: number;
  async: boolean;
  static: boolean;
  signature: string;
}

export interface ClassInfo {
  name: string;
  line: number;
  column: number;
  methods: MethodInfo[];
  extends?: string;
  jsdoc?: string;
}

export interface ImportInfo {
  source: string;
  imported: string[];
  line: number;
  raw: string;
}

export interface ExportInfo {
  type: "named" | "default";
  name?: string;
  line: number;
  raw: string;
}

export interface Match {
  file: string;
  line: number;
  column: number;
  match_type: string;
  name: string;
  code: string;
  context?: {
    before: string[];
    after: string[];
  };
  scope?: string;
  jsdoc?: string;
  modifiers?: string[];
}

/**
 * Outline result structure
 */
export interface OutlineResult {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
}

/**
 * Target extraction result
 */
export interface TargetResult {
  success: boolean;
  mode: "target";
  target_type: string;
  target_name: string;
  class_name?: string;
  line: number;
  end_line: number;
  code: string;
  context_before?: string;
  context_after?: string;
}

/**
 * Base parser interface that all language parsers must implement
 */
export interface LanguageParser {
  /**
   * Parse source code and return AST
   */
  parse(content: string): any;

  /**
   * Extract outline (functions, classes, imports, exports)
   */
  extractOutline(content: string): OutlineResult;

  /**
   * Search AST for pattern matches
   */
  searchAST(
    content: string,
    pattern: string,
    searchType: string,
    modifiers: string[],
    caseInsensitive: boolean,
    contextBefore: number,
    contextAfter: number
  ): Match[];

  /**
   * Extract specific target (function, class, method)
   */
  extractTarget?(
    content: string,
    targetType: string,
    targetName: string,
    className?: string,
    contextLines?: number
  ): TargetResult | { success: false; error: string };
}

/**
 * Parser factory function type
 */
export type ParserFactory = () => LanguageParser;
