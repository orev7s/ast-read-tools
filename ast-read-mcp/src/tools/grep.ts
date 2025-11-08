/**
 * AST-aware grep tool for intelligent code search
 */

import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
// @ts-ignore - CommonJS interop
import traverse from "@babel/traverse";
import * as t from "@babel/types";

// Fix for CommonJS default export in ES modules
// @ts-ignore
const traverseFn = traverse.default || traverse;
import {
  detectLanguage,
  parseWithBabel,
  extractJSDoc,
  readFileContent,
  getLinesWithContext,
  findCodeFiles,
  findSearchableFiles,
  getCodeSnippet,
  isCodeFile,
  isSearchableFile,
} from "./shared.js";

/**
 * Input schema for ast_grep tool
 */
const AstGrepInputSchema = z.object({
  pattern: z.string().describe("Search pattern (supports regex)"),
  path: z
    .string()
    .optional()
    .describe("File or directory path to search (defaults to current directory)"),
  glob_pattern: z
    .string()
    .optional()
    .describe("Glob pattern to filter files (e.g., '*.tsx')"),
  case_insensitive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Case-insensitive matching"),
  context: z
    .number()
    .optional()
    .describe("Number of lines to show before and after each match"),
  context_before: z
    .number()
    .optional()
    .describe("Number of lines to show before each match"),
  context_after: z
    .number()
    .optional()
    .describe("Number of lines to show after each match"),
  line_numbers: z
    .boolean()
    .optional()
    .default(true)
    .describe("Show line numbers in output"),
  output_mode: z
    .enum(["file_paths", "content"])
    .optional()
    .default("content")
    .describe("Output format: file_paths (list files) or content (show matches)"),
  type: z
    .string()
    .optional()
    .describe("Filter by code structure type: function, class, import, export, variable, call, all"),
  modifiers: z
    .array(z.string())
    .optional()
    .describe("Filter by modifiers: async, static, export, const, let, var, private, public, protected"),
  head_limit: z
    .number()
    .optional()
    .describe("Limit output to first N matches"),
  include_non_code: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include non-code files (markdown, configs, etc.) in search"),
});

type AstGrepInput = z.infer<typeof AstGrepInputSchema>;

/**
 * Match result structure
 */
interface Match {
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
 * AST-aware grep tool
 */
export class AstGrepTool {
  static getSchema() {
    return {
      name: "ast_grep",
      description: `AST-aware code search tool. Searches code by structure, not text. 
      
Understands:
- Function declarations and calls
- Class definitions
- Import/export statements
- Variable declarations

Filters:
- By code structure type (function, class, etc.)
- Case-sensitive/insensitive
- Glob patterns for file filtering
- Context lines around matches

Output modes:
- file_paths: List files with matches
- content: Show matched code with context (default)

Example: Find all functions named "handle*":
  { pattern: "handle.*", type: "function", path: "./src" }`,
      inputSchema: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Search pattern (supports regex)",
          },
          path: {
            type: "string",
            description: "File or directory path to search (defaults to current directory)",
          },
          glob_pattern: {
            type: "string",
            description: "Glob pattern to filter files (e.g., '*.tsx')",
          },
          case_insensitive: {
            type: "boolean",
            description: "Case-insensitive matching",
            default: false,
          },
          context: {
            type: "number",
            description: "Number of lines to show before and after each match",
          },
          context_before: {
            type: "number",
            description: "Number of lines to show before each match",
          },
          context_after: {
            type: "number",
            description: "Number of lines to show after each match",
          },
          line_numbers: {
            type: "boolean",
            description: "Show line numbers in output",
            default: true,
          },
          output_mode: {
            type: "string",
            enum: ["file_paths", "content"],
            description: "Output format: file_paths or content",
            default: "content",
          },
          type: {
            type: "string",
            description: "Filter by type: function, class, import, export, variable, all",
          },
          head_limit: {
            type: "number",
            description: "Limit output to first N matches",
          },
          modifiers: {
            type: "array",
            items: { type: "string" },
            description: "Filter by modifiers (async, static, export, const, etc.)",
          },
          include_non_code: {
            type: "boolean",
            description: "Include non-code files (markdown, configs, etc.) in search",
            default: false,
          },
        },
        required: ["pattern"],
      },
    };
  }

  async execute(input: Record<string, unknown>) {
    try {
      const params = AstGrepInputSchema.parse(input);
      
      // Resolve path
      const searchPath = params.path || process.cwd();
      
      // Validate path exists
      if (!fs.existsSync(searchPath)) {
        return this.createError(
          `Path not found: ${searchPath}`,
          "PATH_NOT_FOUND",
          searchPath
        );
      }

      // Determine if single file or directory
      const stats = fs.statSync(searchPath);
      const filesToSearch = stats.isFile()
        ? [searchPath]
        : params.include_non_code
        ? findSearchableFiles(searchPath, params.glob_pattern, true)
        : findCodeFiles(searchPath, params.glob_pattern);

      if (filesToSearch.length === 0) {
        return {
          success: true,
          total_matches: 0,
          files_searched: 0,
          matches: [],
          message: "No code files found in search path",
        };
      }

      // Search all files
      const allMatches: Match[] = [];
      const filesWithMatches = new Set<string>();

      for (const file of filesToSearch) {
        const matches = this.searchFile(file, params);
        allMatches.push(...matches);
        if (matches.length > 0) {
          filesWithMatches.add(file);
        }
      }

      // Apply head_limit if specified
      const limitedMatches = params.head_limit
        ? allMatches.slice(0, params.head_limit)
        : allMatches;

      // Return based on output mode
      if (params.output_mode === "file_paths") {
        return {
          success: true,
          total_matches: allMatches.length,
          files_searched: filesToSearch.length,
          files: Array.from(filesWithMatches),
        };
      }

      // Format content output
      return {
        success: true,
        total_matches: allMatches.length,
        files_searched: filesToSearch.length,
        matches: limitedMatches,
        truncated: params.head_limit && allMatches.length > params.head_limit,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.createError(
          `Invalid input: ${error.issues.map((e: z.ZodIssue) => e.message).join(", ")}`,
          "VALIDATION_ERROR"
        );
      }
      return this.createError(
        error instanceof Error ? error.message : "Unknown error",
        "UNKNOWN_ERROR"
      );
    }
  }

  /**
   * Search a single file for matches
   */
  private searchFile(filePath: string, params: AstGrepInput): Match[] {
    try {
      const content = readFileContent(filePath);
      const lines = content.split("\n");
      
      // Check if this is a code file that can be parsed
      if (!isCodeFile(filePath)) {
        // For non-code files, use text-based search
        return this.searchFileAsText(filePath, content, lines, params);
      }
      
      const ast = parseWithBabel(content, filePath);
      const matches: Match[] = [];

      // Create regex pattern
      const flags = params.case_insensitive ? "i" : "";
      const regex = new RegExp(params.pattern, flags);

      // Determine context settings
      const contextBefore = params.context ?? params.context_before ?? 3;
      const contextAfter = params.context ?? params.context_after ?? 3;

      // Track what we're looking for
      const searchType = params.type?.toLowerCase() || "all";
      const requiredModifiers = params.modifiers?.map(m => m.toLowerCase()) || [];

      // Helper function to check if node matches required modifiers
      const matchesModifiers = (node: any, parent?: any): boolean => {
        if (requiredModifiers.length === 0) return true;
        
        const nodeModifiers: string[] = [];
        
        // Check for async
        if (node.async) nodeModifiers.push('async');
        
        // Check for static (class methods)
        if (node.static) nodeModifiers.push('static');
        
        // Check for export
        if (parent && t.isExportNamedDeclaration(parent)) nodeModifiers.push('export');
        if (parent && t.isExportDefaultDeclaration(parent)) nodeModifiers.push('export');
        
        // Check for variable keywords (const, let, var)
        if (parent && t.isVariableDeclaration(parent)) {
          nodeModifiers.push(parent.kind); // 'const', 'let', or 'var'
        }
        
        // Check for class member visibility
        if (node.accessibility) {
          nodeModifiers.push(node.accessibility); // 'private', 'public', 'protected'
        }
        
        // Check if all required modifiers are present
        return requiredModifiers.every(mod => nodeModifiers.includes(mod));
      };

      // Traverse AST and collect matches
      traverseFn(ast, {
        // Function declarations
        FunctionDeclaration: (path: any) => {
          if (searchType !== "all" && searchType !== "function") return;

          const node = path.node;
          const parent = path.parent;
          
          // Check modifiers first
          if (!matchesModifiers(node, parent)) return;
          
          // If pattern is for modifiers (like "async"), match any function with that modifier
          const isModifierPattern = requiredModifiers.includes(params.pattern?.toLowerCase());
          const nameMatches = node.id && regex.test(node.id.name);
          
          if (isModifierPattern || nameMatches) {
            if (node.id || isModifierPattern) {
              const line = node.loc?.start.line || 0;
              const contextData = getLinesWithContext(
                lines,
                line,
                contextBefore,
                contextAfter
              );

              matches.push({
                file: filePath,
                line,
                column: node.loc?.start.column || 0,
                match_type: "function_declaration",
                name: node.id?.name || "(anonymous)",
                code: contextData.line,
                context: {
                  before: contextData.before,
                  after: contextData.after,
                },
                scope: this.getScope(path),
                jsdoc: extractJSDoc(node),
                modifiers: node.async ? ['async'] : undefined,
              });
            }
          }
        },

        // Variable declarators (arrow functions, function expressions)
        VariableDeclarator: (path: any) => {
          if (searchType !== "all" && searchType !== "function" && searchType !== "variable") return;

          const node = path.node;
          const parent = path.parent; // VariableDeclaration
          const grandParent = path.parentPath?.parent; // Could be ExportNamedDeclaration
          
          if (t.isIdentifier(node.id)) {
            const isFunctionValue =
              t.isArrowFunctionExpression(node.init) ||
              t.isFunctionExpression(node.init);

            // Check modifiers for functions and variables
            if (!matchesModifiers(node.init || node, grandParent || parent)) return;

            // Match functions or variables
            if (
              (searchType === "function" && isFunctionValue) ||
              (searchType === "variable" && !isFunctionValue) ||
              searchType === "all"
            ) {
              // Support searching by modifiers
              const isModifierPattern = requiredModifiers.includes(params.pattern?.toLowerCase());
              const nameMatches = regex.test(node.id.name);
              
              if (isModifierPattern || nameMatches) {
                const line = node.loc?.start.line || 0;
                const contextData = getLinesWithContext(
                  lines,
                  line,
                  contextBefore,
                  contextAfter
                );

                // Collect modifiers for this node
                const modifiers: string[] = [];
                if (parent && t.isVariableDeclaration(parent)) {
                  modifiers.push(parent.kind); // const, let, var
                }
                if (node.init?.async) modifiers.push('async');
                if (grandParent && (t.isExportNamedDeclaration(grandParent) || t.isExportDefaultDeclaration(grandParent))) {
                  modifiers.push('export');
                }

                matches.push({
                  file: filePath,
                  line,
                  column: node.loc?.start.column || 0,
                  match_type: isFunctionValue
                    ? t.isArrowFunctionExpression(node.init)
                      ? "arrow_function"
                      : "function_expression"
                    : "variable",
                  name: node.id.name,
                  code: contextData.line,
                  context: {
                    before: contextData.before,
                    after: contextData.after,
                  },
                  scope: this.getScope(path),
                  jsdoc: extractJSDoc(node),
                  modifiers: modifiers.length > 0 ? modifiers : undefined,
                });
              }
            }
          }
        },

        // Class declarations
        ClassDeclaration: (path: any) => {
          if (searchType !== "all" && searchType !== "class") return;

          const node = path.node;
          if (node.id && regex.test(node.id.name)) {
            const line = node.loc?.start.line || 0;
            const contextData = getLinesWithContext(
              lines,
              line,
              contextBefore,
              contextAfter
            );

            matches.push({
              file: filePath,
              line,
              column: node.loc?.start.column || 0,
              match_type: "class_declaration",
              name: node.id.name,
              code: contextData.line,
              context: {
                before: contextData.before,
                after: contextData.after,
              },
              jsdoc: extractJSDoc(node),
            });
          }
        },

        // Class methods
        ClassMethod: (path: any) => {
          if (searchType !== "all" && searchType !== "function") return;

          const node = path.node;
          
          // Check modifiers
          if (!matchesModifiers(node, path.parent)) return;
          
          if (t.isIdentifier(node.key)) {
            // Support searching by modifiers
            const isModifierPattern = requiredModifiers.includes(params.pattern?.toLowerCase());
            const nameMatches = regex.test(node.key.name);
            
            if (isModifierPattern || nameMatches) {
              const line = node.loc?.start.line || 0;
              const contextData = getLinesWithContext(
                lines,
                line,
                contextBefore,
                contextAfter
              );

              // Collect modifiers for this method
              const modifiers: string[] = [];
              if (node.static) modifiers.push('static');
              if (node.async) modifiers.push('async');
              if (node.accessibility) modifiers.push(node.accessibility); // private, public, protected
              if (node.kind === 'get') modifiers.push('get');
              if (node.kind === 'set') modifiers.push('set');

              matches.push({
                file: filePath,
                line,
                column: node.loc?.start.column || 0,
                match_type: "class_method",
                name: node.key.name,
                code: contextData.line,
                context: {
                  before: contextData.before,
                  after: contextData.after,
                },
                scope: this.getScope(path),
                jsdoc: extractJSDoc(node),
                modifiers: modifiers.length > 0 ? modifiers : undefined,
              });
            }
          }
        },

        // Import declarations
        ImportDeclaration: (path: any) => {
          if (searchType !== "all" && searchType !== "import") return;

          const node = path.node;
          const sourceName = node.source.value;

          if (regex.test(sourceName)) {
            const line = node.loc?.start.line || 0;
            const contextData = getLinesWithContext(
              lines,
              line,
              contextBefore,
              contextAfter
            );

            matches.push({
              file: filePath,
              line,
              column: node.loc?.start.column || 0,
              match_type: "import",
              name: sourceName,
              code: contextData.line,
              context: {
                before: contextData.before,
                after: contextData.after,
              },
            });
          }
        },

        // Export declarations
        ExportNamedDeclaration: (path: any) => {
          if (searchType !== "all" && searchType !== "export") return;

          const node = path.node;
          const line = node.loc?.start.line || 0;

          // Check if declaration has a name that matches
          if (node.declaration) {
            let name = "";
            if (
              t.isFunctionDeclaration(node.declaration) ||
              t.isClassDeclaration(node.declaration)
            ) {
              name = node.declaration.id?.name || "";
            } else if (t.isVariableDeclaration(node.declaration)) {
              const declarator = node.declaration.declarations[0];
              if (t.isIdentifier(declarator.id)) {
                name = declarator.id.name;
              }
            }

            if (name && regex.test(name)) {
              const contextData = getLinesWithContext(
                lines,
                line,
                contextBefore,
                contextAfter
              );

              matches.push({
                file: filePath,
                line,
                column: node.loc?.start.column || 0,
                match_type: "export",
                name,
                code: contextData.line,
                context: {
                  before: contextData.before,
                  after: contextData.after,
                },
              });
            }
          }
        },

        // CommonJS exports (module.exports and exports.xyz)
        AssignmentExpression: (path: any) => {
          if (searchType !== "all" && searchType !== "export") return;

          const node = path.node;
          const left = node.left;
          
          // Check if this is module.exports or exports.something
          let isCommonJSExport = false;
          let exportName = "";
          
          if (t.isMemberExpression(left)) {
            if (t.isIdentifier(left.object)) {
              // exports.something
              if (left.object.name === "exports" && t.isIdentifier(left.property)) {
                isCommonJSExport = true;
                exportName = left.property.name;
              }
              // module.exports
              else if (left.object.name === "module" && t.isIdentifier(left.property) && left.property.name === "exports") {
                isCommonJSExport = true;
                // If assigning an object with properties, match against property names
                if (t.isObjectExpression(node.right)) {
                  // For object exports, check each property
                  for (const prop of node.right.properties) {
                    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                      if (regex.test(prop.key.name)) {
                        const propLine = prop.loc?.start.line || 0;
                        const propContextData = getLinesWithContext(
                          lines,
                          propLine,
                          contextBefore,
                          contextAfter
                        );
                        
                        matches.push({
                          file: filePath,
                          line: propLine,
                          column: prop.loc?.start.column || 0,
                          match_type: "commonjs_export",
                          name: prop.key.name,
                          code: propContextData.line,
                          context: {
                            before: propContextData.before,
                            after: propContextData.after,
                          },
                        });
                      }
                    }
                  }
                  return; // Already handled the object properties
                }
                // If assigning a function or class
                else if (t.isFunctionExpression(node.right) || t.isArrowFunctionExpression(node.right) || t.isClassExpression(node.right)) {
                  exportName = "default";
                }
                // If assigning an identifier (e.g., module.exports = someFunction)
                else if (t.isIdentifier(node.right)) {
                  exportName = node.right.name;
                }
                else {
                  exportName = "module.exports";
                }
              }
            }
            // Handle module.exports.something
            else if (t.isMemberExpression(left.object)) {
              const obj = left.object;
              if (t.isIdentifier(obj.object) && obj.object.name === "module" && 
                  t.isIdentifier(obj.property) && obj.property.name === "exports" &&
                  t.isIdentifier(left.property)) {
                isCommonJSExport = true;
                exportName = left.property.name;
              }
            }
          }
          
          if (isCommonJSExport && exportName && regex.test(exportName)) {
            const line = node.loc?.start.line || 0;
            const contextData = getLinesWithContext(
              lines,
              line,
              contextBefore,
              contextAfter
            );

            matches.push({
              file: filePath,
              line,
              column: node.loc?.start.column || 0,
              match_type: "commonjs_export",
              name: exportName,
              code: contextData.line,
              context: {
                before: contextData.before,
                after: contextData.after,
              },
            });
          }
        },

        // Call expressions (function calls AND CommonJS require)
        CallExpression: (path: any) => {
          const node = path.node;
          
          // Handle CommonJS require() for import type
          if ((searchType === "import" || searchType === "all") && t.isIdentifier(node.callee) && node.callee.name === "require") {
            // Check if this is a require() call with a string argument
            if (node.arguments.length > 0 && t.isStringLiteral(node.arguments[0])) {
              const sourceName = node.arguments[0].value;
              
              if (regex.test(sourceName)) {
                const line = node.loc?.start.line || 0;
                const contextData = getLinesWithContext(
                  lines,
                  line,
                  contextBefore,
                  contextAfter
                );

                matches.push({
                  file: filePath,
                  line,
                  column: node.loc?.start.column || 0,
                  match_type: "commonjs_import",
                  name: sourceName,
                  code: contextData.line,
                  context: {
                    before: contextData.before,
                    after: contextData.after,
                  },
                });
              }
            }
          }

          // Handle normal function calls
          if (searchType === "call" || searchType === "all") {
            let calleeName = "";
            let fullCalleeName = "";

            // Extract the full member expression chain (e.g., console.log, console.error)
            const extractFullName = (node: any): string => {
              if (t.isIdentifier(node)) {
                return node.name;
              } else if (t.isMemberExpression(node)) {
                const obj = extractFullName(node.object);
                const prop = t.isIdentifier(node.property) ? node.property.name : "";
                return obj && prop ? `${obj}.${prop}` : prop || obj;
              }
              return "";
            };

            // Get both the method name and full qualified name
            if (t.isIdentifier(node.callee)) {
              calleeName = node.callee.name;
              fullCalleeName = calleeName;
            } else if (t.isMemberExpression(node.callee)) {
              fullCalleeName = extractFullName(node.callee);
              // Also extract just the method name for matching
              if (t.isIdentifier(node.callee.property)) {
                calleeName = node.callee.property.name;
              }
            }

            // Match against both the method name and full qualified name
            if ((calleeName && regex.test(calleeName)) || 
                (fullCalleeName && regex.test(fullCalleeName))) {
              const line = node.loc?.start.line || 0;
              const contextData = getLinesWithContext(
                lines,
                line,
                contextBefore,
                contextAfter
              );

              matches.push({
                file: filePath,
                line,
                column: node.loc?.start.column || 0,
                match_type: "function_call",
                name: fullCalleeName || calleeName,
                code: contextData.line,
                context: {
                  before: contextData.before,
                  after: contextData.after,
                },
                scope: this.getScope(path),
              });
            }
          }
        },

        // Generic Identifier matching for better pattern coverage when no type specified
        Identifier: (path: any) => {
          // Only use this for "all" search type to improve coverage
          if (searchType !== "all") return;
          
          const node = path.node;
          const parent = path.parent;
          
          // Skip if already handled by other visitors
          if (
            t.isFunctionDeclaration(parent) ||
            t.isClassDeclaration(parent) ||
            t.isVariableDeclarator(parent) ||
            t.isClassMethod(parent) ||
            (t.isCallExpression(parent) && parent.callee === node) ||
            t.isImportSpecifier(parent) ||
            t.isImportDefaultSpecifier(parent)
          ) {
            return;
          }
          
          // Match the identifier
          if (regex.test(node.name)) {
            const line = node.loc?.start.line || 0;
            const contextData = getLinesWithContext(
              lines,
              line,
              contextBefore,
              contextAfter
            );
            
            // Deduplicate - check if we already have a match at this exact position
            const isDuplicate = matches.some(
              m => m.line === line && m.column === (node.loc?.start.column || 0)
            );
            
            if (!isDuplicate) {
              matches.push({
                file: filePath,
                line,
                column: node.loc?.start.column || 0,
                match_type: "identifier",
                name: node.name,
                code: contextData.line,
                context: {
                  before: contextData.before,
                  after: contextData.after,
                },
                scope: this.getScope(path),
              });
            }
          }
        },

        // String literals matching for better coverage
        StringLiteral: (path: any) => {
          // Only use this for "all" search type
          if (searchType !== "all") return;
          
          const node = path.node;
          
          if (regex.test(node.value)) {
            const line = node.loc?.start.line || 0;
            const contextData = getLinesWithContext(
              lines,
              line,
              contextBefore,
              contextAfter
            );
            
            // Deduplicate
            const isDuplicate = matches.some(
              m => m.line === line && m.column === (node.loc?.start.column || 0)
            );
            
            if (!isDuplicate) {
              matches.push({
                file: filePath,
                line,
                column: node.loc?.start.column || 0,
                match_type: "string_literal",
                name: node.value,
                code: contextData.line,
                context: {
                  before: contextData.before,
                  after: contextData.after,
                },
              });
            }
          }
        },
      });

      return matches;
    } catch (error) {
      // Log parse error but continue (don't fail entire search)
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ast_grep] Failed to parse ${filePath}: ${errorMsg}`);
      return [];
    }
  }

  /**
   * Text-based search for non-code files (markdown, configs, etc.)
   */
  private searchFileAsText(
    filePath: string,
    content: string,
    lines: string[],
    params: AstGrepInput
  ): Match[] {
    const matches: Match[] = [];
    
    // Create regex pattern
    const flags = params.case_insensitive ? "gi" : "g";
    const regex = new RegExp(params.pattern, flags);
    
    // Determine context settings
    const contextBefore = params.context ?? params.context_before ?? 3;
    const contextAfter = params.context ?? params.context_after ?? 3;
    
    // Search line by line
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      let match;
      
      // Reset regex for each line
      regex.lastIndex = 0;
      
      while ((match = regex.exec(line)) !== null) {
        const contextData = getLinesWithContext(
          lines,
          lineNumber,
          contextBefore,
          contextAfter
        );
        
        matches.push({
          file: filePath,
          line: lineNumber,
          column: match.index,
          match_type: "text_match",
          name: match[0],
          code: contextData.line,
          context: {
            before: contextData.before,
            after: contextData.after,
          },
        });
      }
    });
    
    return matches;
  }

  /**
   * Get scope information for a node
   */
  private getScope(path: any): string | undefined {
    let scope = path.scope;
    const scopes: string[] = [];

    while (scope && scope.path) {
      const node = scope.path.node;

      if (t.isClassDeclaration(node) && node.id) {
        scopes.unshift(`class:${node.id.name}`);
      } else if (t.isFunctionDeclaration(node) && node.id) {
        scopes.unshift(`function:${node.id.name}`);
      }

      scope = scope.parent;
    }

    return scopes.length > 0 ? scopes.join(" > ") : undefined;
  }

  /**
   * Create error response
   */
  private createError(
    message: string,
    type: string,
    filePath?: string
  ): object {
    return {
      success: false,
      error: {
        message,
        type,
        file_path: filePath,
      },
    };
  }
}
