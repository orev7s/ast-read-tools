// @ts-nocheck - Bypass TypeScript checking for Rust parser
/**
 * Rust AST Parser Module for ast-read/ast-grep tool
 * 
 * Required npm packages:
 * - npm install tree-sitter@^0.21.0
 * - npm install tree-sitter-rust@^0.21.0
 * - npm install web-tree-sitter@^0.22.0 (for WASM support if needed)
 * 
 * This module provides Rust AST parsing capabilities matching the Babel parser interface
 * used for JavaScript/TypeScript in the existing codebase.
 */

import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";

/**
 * Function information extracted from Rust code
 */
export interface FunctionInfo {
  name: string;
  line: number;
  column: number;
  async: boolean;  // async fn in Rust
  signature: string;
  type: "function_declaration" | "associated_function" | "method";
  jsdoc?: string;  // Rust doc comments (///)
  visibility?: string;  // pub, pub(crate), etc.
}

/**
 * Class/Struct information from Rust
 * Maps Rust structs and enums to "class" concept
 */
export interface ClassInfo {
  name: string;
  line: number;
  column: number;
  methods: MethodInfo[];  // From impl blocks
  extends?: string;  // Trait implementations
  jsdoc?: string;  // Rust doc comments
  type: "struct" | "enum" | "trait";
  visibility?: string;
}

/**
 * Method information from impl blocks
 */
export interface MethodInfo {
  name: string;
  line: number;
  async: boolean;
  static: boolean;  // Associated functions (no &self)
  signature: string;
  visibility?: string;
}

/**
 * Import information from use statements
 */
export interface ImportInfo {
  source: string;  // Module path
  imported: string[];  // Imported items
  line: number;
  raw: string;  // Original statement
}

/**
 * Export information (pub items)
 */
export interface ExportInfo {
  type: "named" | "default";  // Rust uses "named" for pub items
  name?: string;
  line: number;
  raw: string;
  visibility: string;  // pub, pub(crate), pub(super), etc.
}

/**
 * Match result for grep functionality
 */
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
 * Parse Rust code into an AST
 */
export function parseRust(content: string): Parser.Tree {
  const parser = new Parser();
  parser.setLanguage(Rust);
  return parser.parse(content);
}

/**
 * Extract structured outline from Rust code
 * Mirrors the Babel implementation's extractOutline functionality
 */
export function extractRustOutline(content: string): {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
} {
  const tree = parseRust(content);
  const lines = content.split("\n");
  
  const functions: FunctionInfo[] = [];
  const structs: ClassInfo[] = [];
  const enums: ClassInfo[] = [];
  const traits: ClassInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  
  // Track impl blocks to associate methods with structs/enums
  const implBlocks = new Map<string, MethodInfo[]>();
  
  // Traverse the tree
  traverseRustAST(tree.rootNode, {
    onFunctionItem: (node, parent) => {
      const funcInfo = extractFunctionInfo(node, lines, content);
      if (funcInfo) {
        functions.push(funcInfo);
        
        // Check if this is exported (pub)
        if (funcInfo.visibility && funcInfo.visibility.startsWith("pub")) {
          exports.push({
            type: "named",
            name: funcInfo.name,
            line: funcInfo.line,
            raw: getNodeText(node, content),
            visibility: funcInfo.visibility,
          });
        }
      }
    },
    
    onStructItem: (node) => {
      const structInfo = extractStructInfo(node, lines, content);
      if (structInfo) {
        structs.push(structInfo);
        
        // Check if exported
        if (structInfo.visibility && structInfo.visibility.startsWith("pub")) {
          exports.push({
            type: "named",
            name: structInfo.name,
            line: structInfo.line,
            raw: getNodeText(node, content),
            visibility: structInfo.visibility,
          });
        }
      }
    },
    
    onEnumItem: (node) => {
      const enumInfo = extractEnumInfo(node, lines, content);
      if (enumInfo) {
        enums.push(enumInfo);
        
        // Check if exported
        if (enumInfo.visibility && enumInfo.visibility.startsWith("pub")) {
          exports.push({
            type: "named",
            name: enumInfo.name,
            line: enumInfo.line,
            raw: getNodeText(node, content),
            visibility: enumInfo.visibility,
          });
        }
      }
    },
    
    onTraitItem: (node) => {
      const traitInfo = extractTraitInfo(node, lines, content);
      if (traitInfo) {
        traits.push(traitInfo);
        
        // Check if exported
        if (traitInfo.visibility && traitInfo.visibility.startsWith("pub")) {
          exports.push({
            type: "named",
            name: traitInfo.name,
            line: traitInfo.line,
            raw: getNodeText(node, content),
            visibility: traitInfo.visibility,
          });
        }
      }
    },
    
    onImplItem: (node) => {
      const implInfo = extractImplBlock(node, lines, content);
      if (implInfo) {
        const { typeName, methods } = implInfo;
        if (typeName && methods.length > 0) {
          implBlocks.set(typeName, methods);
        }
      }
    },
    
    onUseDeclaration: (node) => {
      const importInfo = extractImportInfo(node, lines, content);
      if (importInfo) {
        imports.push(importInfo);
      }
    },
  });
  
  // Associate impl block methods with their structs/enums
  for (const struct of structs) {
    const methods = implBlocks.get(struct.name);
    if (methods) {
      struct.methods = methods;
    }
  }
  
  for (const enumItem of enums) {
    const methods = implBlocks.get(enumItem.name);
    if (methods) {
      enumItem.methods = methods;
    }
  }
  
  // Combine structs, enums, and traits into "classes" for unified interface
  const classes = [...structs, ...enums, ...traits];
  
  return {
    functions,
    classes,
    imports,
    exports,
  };
}

/**
 * Search Rust AST for patterns
 * Mirrors ast_grep functionality from grep.ts
 */
export function searchRustAST(
  content: string,
  pattern: string,
  searchType: string,
  modifiers: string[],
  caseInsensitive: boolean
): Match[] {
  const tree = parseRust(content);
  const lines = content.split("\n");
  const matches: Match[] = [];
  
  // Create regex pattern
  const flags = caseInsensitive ? "i" : "";
  const regex = new RegExp(pattern, flags);
  
  // Normalize search type
  const type = searchType.toLowerCase();
  const requiredModifiers = modifiers.map(m => m.toLowerCase());
  
  traverseRustAST(tree.rootNode, {
    onFunctionItem: (node) => {
      if (type !== "all" && type !== "function") return;
      
      const funcInfo = extractFunctionInfo(node, lines, content);
      if (!funcInfo) return;
      
      // Check if name matches pattern
      if (!regex.test(funcInfo.name)) return;
      
      // Check modifiers
      const nodeModifiers = getFunctionModifiers(funcInfo);
      if (!matchesModifiers(nodeModifiers, requiredModifiers)) return;
      
      matches.push({
        file: "",  // Will be set by caller
        line: funcInfo.line,
        column: funcInfo.column,
        match_type: funcInfo.type,
        name: funcInfo.name,
        code: lines[funcInfo.line - 1] || "",
        jsdoc: funcInfo.jsdoc,
        modifiers: nodeModifiers,
      });
    },
    
    onStructItem: (node) => {
      if (type !== "all" && type !== "class") return;
      
      const structInfo = extractStructInfo(node, lines, content);
      if (!structInfo) return;
      
      if (!regex.test(structInfo.name)) return;
      
      matches.push({
        file: "",
        line: structInfo.line,
        column: structInfo.column,
        match_type: "struct",
        name: structInfo.name,
        code: lines[structInfo.line - 1] || "",
        jsdoc: structInfo.jsdoc,
        modifiers: structInfo.visibility ? [structInfo.visibility] : undefined,
      });
    },
    
    onEnumItem: (node) => {
      if (type !== "all" && type !== "class") return;
      
      const enumInfo = extractEnumInfo(node, lines, content);
      if (!enumInfo) return;
      
      if (!regex.test(enumInfo.name)) return;
      
      matches.push({
        file: "",
        line: enumInfo.line,
        column: enumInfo.column,
        match_type: "enum",
        name: enumInfo.name,
        code: lines[enumInfo.line - 1] || "",
        jsdoc: enumInfo.jsdoc,
        modifiers: enumInfo.visibility ? [enumInfo.visibility] : undefined,
      });
    },
    
    onUseDeclaration: (node) => {
      if (type !== "all" && type !== "import") return;
      
      const importInfo = extractImportInfo(node, lines, content);
      if (!importInfo) return;
      
      if (!regex.test(importInfo.source)) return;
      
      matches.push({
        file: "",
        line: importInfo.line,
        column: 0,
        match_type: "use_declaration",
        name: importInfo.source,
        code: lines[importInfo.line - 1] || "",
      });
    },
  });
  
  return matches;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Traverse Rust AST with callbacks
 */
function traverseRustAST(node: Parser.SyntaxNode, callbacks: {
  onFunctionItem?: (node: Parser.SyntaxNode, parent?: Parser.SyntaxNode) => void;
  onStructItem?: (node: Parser.SyntaxNode) => void;
  onEnumItem?: (node: Parser.SyntaxNode) => void;
  onTraitItem?: (node: Parser.SyntaxNode) => void;
  onImplItem?: (node: Parser.SyntaxNode) => void;
  onUseDeclaration?: (node: Parser.SyntaxNode) => void;
}) {
  const visit = (node: Parser.SyntaxNode, parent?: Parser.SyntaxNode) => {
    // Handle different node types
    switch (node.type) {
      case "function_item":
        callbacks.onFunctionItem?.(node, parent);
        break;
      case "struct_item":
        callbacks.onStructItem?.(node);
        break;
      case "enum_item":
        callbacks.onEnumItem?.(node);
        break;
      case "trait_item":
        callbacks.onTraitItem?.(node);
        break;
      case "impl_item":
        callbacks.onImplItem?.(node);
        break;
      case "use_declaration":
        callbacks.onUseDeclaration?.(node);
        break;
    }
    
    // Recursively visit children
    for (const child of node.children) {
      visit(child, node);
    }
  };
  
  visit(node);
}

/**
 * Extract function information from function_item node
 */
function extractFunctionInfo(
  node: Parser.SyntaxNode,
  lines: string[],
  content: string
): FunctionInfo | null {
  const nameNode = findChildByType(node, "identifier");
  if (!nameNode) return null;
  
  const name = getNodeText(nameNode, content);
  const line = nameNode.startPosition.row + 1;
  const column = nameNode.startPosition.column;
  
  // Check for async
  const isAsync = hasChildWithText(node, "async");
  
  // Extract visibility
  const visibility = extractVisibility(node, content);
  
  // Extract doc comments
  const jsdoc = extractDocComments(node, lines);
  
  // Build signature
  const signature = buildFunctionSignature(node, content);
  
  // Determine if it's a method or standalone function
  const hasReceiver = hasChildByType(node, "self_parameter");
  const type = hasReceiver ? "method" : "associated_function";
  
  return {
    name,
    line,
    column,
    async: isAsync,
    signature,
    type,
    jsdoc,
    visibility,
  };
}

/**
 * Extract struct information
 */
function extractStructInfo(
  node: Parser.SyntaxNode,
  lines: string[],
  content: string
): ClassInfo | null {
  const nameNode = findChildByType(node, "type_identifier");
  if (!nameNode) return null;
  
  const name = getNodeText(nameNode, content);
  const line = nameNode.startPosition.row + 1;
  const column = nameNode.startPosition.column;
  
  const visibility = extractVisibility(node, content);
  const jsdoc = extractDocComments(node, lines);
  
  return {
    name,
    line,
    column,
    methods: [],
    type: "struct",
    jsdoc,
    visibility,
  };
}

/**
 * Extract enum information
 */
function extractEnumInfo(
  node: Parser.SyntaxNode,
  lines: string[],
  content: string
): ClassInfo | null {
  const nameNode = findChildByType(node, "type_identifier");
  if (!nameNode) return null;
  
  const name = getNodeText(nameNode, content);
  const line = nameNode.startPosition.row + 1;
  const column = nameNode.startPosition.column;
  
  const visibility = extractVisibility(node, content);
  const jsdoc = extractDocComments(node, lines);
  
  return {
    name,
    line,
    column,
    methods: [],
    type: "enum",
    jsdoc,
    visibility,
  };
}

/**
 * Extract trait information
 */
function extractTraitInfo(
  node: Parser.SyntaxNode,
  lines: string[],
  content: string
): ClassInfo | null {
  const nameNode = findChildByType(node, "type_identifier");
  if (!nameNode) return null;
  
  const name = getNodeText(nameNode, content);
  const line = nameNode.startPosition.row + 1;
  const column = nameNode.startPosition.column;
  
  const visibility = extractVisibility(node, content);
  const jsdoc = extractDocComments(node, lines);
  
  // Extract trait methods
  const methods: MethodInfo[] = [];
  const declarationList = findChildByType(node, "declaration_list");
  if (declarationList) {
    for (const child of declarationList.children) {
      if (child.type === "function_item" || child.type === "function_signature_item") {
        const methodInfo = extractMethodInfo(child, lines, content);
        if (methodInfo) {
          methods.push(methodInfo);
        }
      }
    }
  }
  
  return {
    name,
    line,
    column,
    methods,
    type: "trait",
    jsdoc,
    visibility,
  };
}

/**
 * Extract impl block information
 */
function extractImplBlock(
  node: Parser.SyntaxNode,
  lines: string[],
  content: string
): { typeName: string; methods: MethodInfo[] } | null {
  // Find the type being implemented
  const typeNode = findChildByType(node, "type_identifier");
  if (!typeNode) return null;
  
  const typeName = getNodeText(typeNode, content);
  const methods: MethodInfo[] = [];
  
  // Extract methods from declaration_list
  const declarationList = findChildByType(node, "declaration_list");
  if (declarationList) {
    for (const child of declarationList.children) {
      if (child.type === "function_item") {
        const methodInfo = extractMethodInfo(child, lines, content);
        if (methodInfo) {
          methods.push(methodInfo);
        }
      }
    }
  }
  
  return { typeName, methods };
}

/**
 * Extract method information from function_item in impl or trait
 */
function extractMethodInfo(
  node: Parser.SyntaxNode,
  lines: string[],
  content: string
): MethodInfo | null {
  const nameNode = findChildByType(node, "identifier");
  if (!nameNode) return null;
  
  const name = getNodeText(nameNode, content);
  const line = nameNode.startPosition.row + 1;
  
  const isAsync = hasChildWithText(node, "async");
  const visibility = extractVisibility(node, content);
  
  // Check if it's a static method (no self parameter)
  const hasReceiver = hasChildByType(node, "self_parameter");
  const isStatic = !hasReceiver;
  
  const signature = buildFunctionSignature(node, content);
  
  return {
    name,
    line,
    async: isAsync,
    static: isStatic,
    signature,
    visibility,
  };
}

/**
 * Extract import/use information
 */
function extractImportInfo(
  node: Parser.SyntaxNode,
  lines: string[],
  content: string
): ImportInfo | null {
  const line = node.startPosition.row + 1;
  const raw = lines[line - 1] || "";
  
  // Extract the use path
  const useClause = findChildByType(node, "use_clause");
  if (!useClause) return null;
  
  const path = extractUsePath(useClause, content);
  const imported = extractUseItems(useClause, content);
  
  return {
    source: path,
    imported,
    line,
    raw,
  };
}

/**
 * Extract use path from use_clause
 */
function extractUsePath(node: Parser.SyntaxNode, content: string): string {
  // Handle different use statement patterns:
  // use std::collections::HashMap;
  // use std::collections::{HashMap, HashSet};
  // use std::io::*;
  
  const parts: string[] = [];
  
  const collectPath = (node: Parser.SyntaxNode) => {
    if (node.type === "identifier" || node.type === "scoped_identifier") {
      parts.push(getNodeText(node, content));
    } else {
      for (const child of node.children) {
        if (child.type !== "use_list" && child.type !== "use_as_clause") {
          collectPath(child);
        }
      }
    }
  };
  
  collectPath(node);
  
  return parts.join("::");
}

/**
 * Extract imported items from use_clause
 */
function extractUseItems(node: Parser.SyntaxNode, content: string): string[] {
  const items: string[] = [];
  
  const collectItems = (node: Parser.SyntaxNode) => {
    if (node.type === "identifier") {
      items.push(getNodeText(node, content));
    } else if (node.type === "use_wildcard") {
      items.push("*");
    } else {
      for (const child of node.children) {
        collectItems(child);
      }
    }
  };
  
  // Look for use_list (curly braces import)
  const useList = findChildByType(node, "use_list");
  if (useList) {
    collectItems(useList);
  } else {
    // Single import
    collectItems(node);
  }
  
  return items.length > 0 ? items : ["*"];
}

/**
 * Extract visibility modifier (pub, pub(crate), etc.)
 */
function extractVisibility(node: Parser.SyntaxNode, content: string): string | undefined {
  const visibilityModifier = findChildByType(node, "visibility_modifier");
  if (visibilityModifier) {
    return getNodeText(visibilityModifier, content);
  }
  return undefined;
}

/**
 * Extract Rust doc comments (/// and //!)
 */
function extractDocComments(node: Parser.SyntaxNode, lines: string[]): string | undefined {
  const line = node.startPosition.row;
  const docComments: string[] = [];
  
  // Look backwards for doc comments
  for (let i = line - 1; i >= 0; i--) {
    const lineText = lines[i].trim();
    if (lineText.startsWith("///") || lineText.startsWith("//!")) {
      docComments.unshift(lineText);
    } else if (lineText === "" || lineText.startsWith("//")) {
      continue;
    } else {
      break;
    }
  }
  
  if (docComments.length > 0) {
    return docComments.join("\n");
  }
  
  return undefined;
}

/**
 * Build function signature string
 */
function buildFunctionSignature(node: Parser.SyntaxNode, content: string): string {
  const parts: string[] = [];
  
  // Add async if present
  if (hasChildWithText(node, "async")) {
    parts.push("async");
  }
  
  // Add fn keyword
  parts.push("fn");
  
  // Add name
  const nameNode = findChildByType(node, "identifier");
  if (nameNode) {
    parts.push(getNodeText(nameNode, content));
  }
  
  // Add parameters
  const paramsNode = findChildByType(node, "parameters");
  if (paramsNode) {
    parts.push(getNodeText(paramsNode, content));
  } else {
    parts.push("()");
  }
  
  // Add return type
  const returnTypeNode = findChildByType(node, "return_type");
  if (returnTypeNode) {
    parts.push(getNodeText(returnTypeNode, content));
  }
  
  return parts.join(" ");
}

/**
 * Get text content of a node
 */
function getNodeText(node: Parser.SyntaxNode, content: string): string {
  return content.substring(node.startIndex, node.endIndex);
}

/**
 * Find child node by type
 */
function findChildByType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
  for (const child of node.children) {
    if (child.type === type) {
      return child;
    }
  }
  return null;
}

/**
 * Check if node has child with specific text
 */
function hasChildWithText(node: Parser.SyntaxNode, text: string): boolean {
  for (const child of node.children) {
    if (child.text === text) {
      return true;
    }
  }
  return false;
}

/**
 * Check if node has child of specific type
 */
function hasChildByType(node: Parser.SyntaxNode, type: string): boolean {
  return findChildByType(node, type) !== null;
}

/**
 * Get function modifiers for matching
 */
function getFunctionModifiers(funcInfo: FunctionInfo): string[] {
  const modifiers: string[] = [];
  
  if (funcInfo.async) modifiers.push("async");
  if (funcInfo.visibility) modifiers.push(funcInfo.visibility);
  if (funcInfo.type === "associated_function") modifiers.push("static");
  
  return modifiers;
}

/**
 * Check if node modifiers match required modifiers
 */
function matchesModifiers(nodeModifiers: string[], requiredModifiers: string[]): boolean {
  if (requiredModifiers.length === 0) return true;
  
  return requiredModifiers.every(required => {
    // Handle pub variations (pub, pub(crate), pub(super))
    if (required === "pub") {
      return nodeModifiers.some(mod => mod.startsWith("pub"));
    }
    return nodeModifiers.includes(required);
  });
}
