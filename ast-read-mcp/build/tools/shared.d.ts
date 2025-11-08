/**
 * Shared utilities for AST-based tools
 */
import * as parser from "@babel/parser";
import * as t from "@babel/types";
/**
 * Detect language from file extension
 */
export declare function detectLanguage(filePath: string): string;
/**
 * Check if file is a JavaScript/TypeScript file
 */
export declare function isCodeFile(filePath: string): boolean;
/**
 * Check if file is searchable (includes code, docs, configs, etc.)
 */
export declare function isSearchableFile(filePath: string): boolean;
/**
 * Parse code with Babel parser
 */
export declare function parseWithBabel(content: string, filePath?: string): parser.ParseResult<t.File>;
/**
 * Extract JSDoc comment from node
 */
export declare function extractJSDoc(node: any): string | undefined;
/**
 * Read file content
 */
export declare function readFileContent(filePath: string): string;
/**
 * Get lines with context around a target line
 */
export declare function getLinesWithContext(lines: string[], targetLine: number, contextBefore?: number, contextAfter?: number): {
    before: string[];
    line: string;
    after: string[];
    startLine: number;
    endLine: number;
};
/**
 * Recursively find all code files in directory
 */
export declare function findCodeFiles(dirPath: string, pattern?: string): string[];
/**
 * Recursively find all searchable files in directory (includes docs, configs, etc.)
 */
export declare function findSearchableFiles(dirPath: string, pattern?: string, includeNonCode?: boolean): string[];
/**
 * Get code snippet from content
 */
export declare function getCodeSnippet(content: string, startLine: number, endLine: number): string;
//# sourceMappingURL=shared.d.ts.map