// @ts-nocheck - Bypass TypeScript checking for C# parser
/**
 * C# Parser Module for AST-Read/AST-Grep Tool
 * 
 * Uses tree-sitter for C# AST parsing
 * 
 * Required npm packages:
 * - npm install tree-sitter tree-sitter-c-sharp
 */

import Parser from "tree-sitter";
import CSharp from "tree-sitter-c-sharp";

/**
 * Data structures matching the TypeScript/JavaScript implementation
 */

export interface FunctionInfo {
  name: string;
  line: number;
  column: number;
  async: boolean;
  signature: string;
  type: "method" | "function" | "property_getter" | "property_setter" | "indexer";
  jsdoc?: string;
}

export interface MethodInfo {
  name: string;
  line: number;
  async: boolean;
  static: boolean;
  signature: string;
  visibility?: "public" | "private" | "protected" | "internal";
  modifiers?: string[];
}

export interface ClassInfo {
  name: string;
  line: number;
  column: number;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  extends?: string;
  implements?: string[];
  jsdoc?: string;
  kind: "class" | "interface" | "struct";
}

export interface PropertyInfo {
  name: string;
  line: number;
  type?: string;
  visibility?: string;
  static?: boolean;
  hasGetter: boolean;
  hasSetter: boolean;
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
  visibility?: "public" | "internal";
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
 * Parse C# code using tree-sitter (synchronous)
 */
export function parseCSharp(content: string): Parser.Tree {
  const parser = new Parser();
  parser.setLanguage(CSharp);
  return parser.parse(content);
}

/**
 * Extract XML doc comment (///) from node
 * C# uses XML doc comments: /// <summary>...</summary>
 */
function extractXmlDoc(node: any, content: string): string | undefined {
  // Look for XML doc comments before the node
  const startPosition = node.startPosition;
  const lines = content.split("\n");
  const targetLine = startPosition.row;
  
  const docLines: string[] = [];
  
  // Scan backwards from target line
  for (let i = targetLine - 1; i >= 0 && i >= targetLine - 20; i--) {
    const line = lines[i]?.trim();
    if (!line) continue;
    
    if (line.startsWith("///")) {
      docLines.unshift(line);
    } else {
      // Stop at first non-doc comment line
      break;
    }
  }
  
  return docLines.length > 0 ? docLines.join("\n") : undefined;
}

/**
 * Extract visibility modifier from node
 */
function extractVisibility(node: Parser.SyntaxNode): "public" | "private" | "protected" | "internal" | undefined {
  const modifiers = node.children.filter(c => c.type.includes("modifier"));
  
  for (const mod of modifiers) {
    const text = mod.text.toLowerCase();
    if (text === "public" || text === "private" || text === "protected" || text === "internal") {
      return text as any;
    }
  }
  
  return undefined;
}

/**
 * Extract all modifiers from node
 */
function extractModifiers(node: any): string[] {
  const modifiers: string[] = [];
  
  for (const child of node.children) {
    if (child.type.includes("modifier") || child.type === "modifier") {
      const text = child.text.toLowerCase();
      if (["public", "private", "protected", "internal", "static", "virtual", "override", "abstract", "async", "sealed", "readonly", "const", "extern", "new"].includes(text)) {
        modifiers.push(text);
      }
    }
  }
  
  return modifiers;
}

/**
 * Check if node has specific modifier
 */
function hasModifier(node: any, modifier: string): boolean {
  return extractModifiers(node).includes(modifier.toLowerCase());
}

/**
 * Get method/function signature
 */
function getMethodSignature(node: any, content: string): string {
  // Find parameter list
  const parameterList = node.childForFieldName("parameters");
  let params = "()";
  
  if (parameterList) {
    params = content.slice(parameterList.startIndex, parameterList.endIndex);
  }
  
  // Find return type
  const returnType = node.childForFieldName("type");
  let returnTypeStr = "void";
  
  if (returnType) {
    returnTypeStr = content.slice(returnType.startIndex, returnType.endIndex);
  }
  
  // Build signature
  const modifiers = extractModifiers(node);
  const modifierStr = modifiers.length > 0 ? modifiers.join(" ") + " " : "";
  const name = node.childForFieldName("name")?.text || "unknown";
  
  return `${modifierStr}${returnTypeStr} ${name}${params}`;
}

/**
 * Get property signature
 */
function getPropertySignature(node: any, content: string): string {
  const modifiers = extractModifiers(node);
  const modifierStr = modifiers.length > 0 ? modifiers.join(" ") + " " : "";
  
  const type = node.childForFieldName("type");
  const typeStr = type ? content.slice(type.startIndex, type.endIndex) : "var";
  
  const name = node.childForFieldName("name")?.text || "unknown";
  
  return `${modifierStr}${typeStr} ${name}`;
}

/**
 * Extract file outline (classes, methods, imports, exports)
 */
export function extractCSharpOutline(content: string): {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
} {
  try {
    const tree = parseCSharp(content);
    const rootNode = tree.rootNode;
    const lines = content.split("\n");
    
    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];
    const interfaces: ClassInfo[] = [];
    const structs: ClassInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
  
  /**
   * Process using directives (imports)
   */
  function processUsingDirective(node: any) {
    const line = node.startPosition.row + 1;
    const nameNode = node.childForFieldName("name");
    
    if (nameNode) {
      const source = content.slice(nameNode.startIndex, nameNode.endIndex);
      const raw = lines[line - 1]?.trim() || "";
      
      imports.push({
        source,
        imported: [source.split(".").pop() || source],
        line,
        raw,
      });
    }
  }
  
  /**
   * Process namespace declarations
   */
  function processNamespace(node: Parser.SyntaxNode, parentNamespace?: string) {
    const nameNode = node.childForFieldName("name");
    const bodyNode = node.childForFieldName("body");
    
    const namespaceName = nameNode ? content.slice(nameNode.startIndex, nameNode.endIndex) : undefined;
    const fullNamespace = parentNamespace && namespaceName ? `${parentNamespace}.${namespaceName}` : namespaceName;
    
    if (bodyNode) {
      processNode(bodyNode, fullNamespace);
    }
  }
  
  /**
   * Process class declaration
   */
  function processClass(node: Parser.SyntaxNode, namespace?: string) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;
    
    const className = nameNode.text;
    const line = node.startPosition.row + 1;
    const column = node.startPosition.column;
    const jsdoc = extractXmlDoc(node, content);
    
    // Extract base class
    const baseList = node.childForFieldName("bases");
    let baseClass: string | undefined;
    const implementsList: string[] = [];
    
    if (baseList) {
      for (const child of baseList.children) {
        if (child.type === "base_list") {
          for (const item of child.children) {
            if (item.type === "simple_base_type" || item.type === "type") {
              const typeName = content.slice(item.startIndex, item.endIndex);
              // First one is usually the base class, rest are interfaces
              if (!baseClass && !typeName.startsWith("I")) {
                baseClass = typeName;
              } else {
                implementsList.push(typeName);
              }
            }
          }
        }
      }
    }
    
    // Extract methods and properties
    const methods: MethodInfo[] = [];
    const properties: PropertyInfo[] = [];
    
    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      for (const member of bodyNode.children) {
        if (member.type === "method_declaration") {
          const methodName = member.childForFieldName("name")?.text || "unknown";
          const methodLine = member.startPosition.row + 1;
          const isAsync = hasModifier(member, "async");
          const isStatic = hasModifier(member, "static");
          const visibility = extractVisibility(member);
          const modifiers = extractModifiers(member);
          const signature = getMethodSignature(member, content);
          
          methods.push({
            name: methodName,
            line: methodLine,
            async: isAsync,
            static: isStatic,
            signature,
            visibility,
            modifiers,
          });
        } else if (member.type === "property_declaration") {
          const propName = member.childForFieldName("name")?.text || "unknown";
          const propLine = member.startPosition.row + 1;
          const propType = member.childForFieldName("type");
          const visibility = extractVisibility(member);
          const isStatic = hasModifier(member, "static");
          
          // Check for getter/setter
          const accessorList = member.children.find(c => c.type === "accessor_list");
          let hasGetter = false;
          let hasSetter = false;
          
          if (accessorList) {
            for (const accessor of accessorList.children) {
              if (accessor.type === "get_accessor_declaration") hasGetter = true;
              if (accessor.type === "set_accessor_declaration") hasSetter = true;
            }
          }
          
          properties.push({
            name: propName,
            line: propLine,
            type: propType ? content.slice(propType.startIndex, propType.endIndex) : undefined,
            visibility: visibility as any,
            static: isStatic,
            hasGetter,
            hasSetter,
          });
        } else if (member.type === "constructor_declaration") {
          const ctorLine = member.startPosition.row + 1;
          const visibility = extractVisibility(member);
          const modifiers = extractModifiers(member);
          const signature = getMethodSignature(member, content);
          
          methods.push({
            name: className,
            line: ctorLine,
            async: false,
            static: false,
            signature,
            visibility,
            modifiers,
          });
        }
      }
    }
    
    const classInfo: ClassInfo = {
      name: className,
      line,
      column,
      methods,
      properties,
      extends: baseClass,
      implements: implementsList.length > 0 ? implementsList : undefined,
      jsdoc,
      kind: "class",
    };
    
    // Check for public visibility to determine exports
    const visibility = extractVisibility(node);
    if (visibility === "public") {
      exports.push({
        type: "named",
        name: className,
        line,
        raw: lines[line - 1]?.trim() || "",
        visibility: "public",
      });
    }
    
    classes.push(classInfo);
  }
  
  /**
   * Process interface declaration
   */
  function processInterface(node: Parser.SyntaxNode, namespace?: string) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;
    
    const interfaceName = nameNode.text;
    const line = node.startPosition.row + 1;
    const column = node.startPosition.column;
    const jsdoc = extractXmlDoc(node, content);
    
    // Extract base interfaces
    const baseList = node.childForFieldName("bases");
    const implementsList: string[] = [];
    
    if (baseList) {
      for (const child of baseList.children) {
        if (child.type === "base_list") {
          for (const item of child.children) {
            if (item.type === "simple_base_type" || item.type === "type") {
              const typeName = content.slice(item.startIndex, item.endIndex);
              implementsList.push(typeName);
            }
          }
        }
      }
    }
    
    // Extract methods and properties
    const methods: MethodInfo[] = [];
    const properties: PropertyInfo[] = [];
    
    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      for (const member of bodyNode.children) {
        if (member.type === "method_declaration") {
          const methodName = member.childForFieldName("name")?.text || "unknown";
          const methodLine = member.startPosition.row + 1;
          const signature = getMethodSignature(member, content);
          
          methods.push({
            name: methodName,
            line: methodLine,
            async: false,
            static: false,
            signature,
          });
        } else if (member.type === "property_declaration") {
          const propName = member.childForFieldName("name")?.text || "unknown";
          const propLine = member.startPosition.row + 1;
          const propType = member.childForFieldName("type");
          
          properties.push({
            name: propName,
            line: propLine,
            type: propType ? content.slice(propType.startIndex, propType.endIndex) : undefined,
            hasGetter: true,
            hasSetter: true,
          });
        }
      }
    }
    
    const interfaceInfo: ClassInfo = {
      name: interfaceName,
      line,
      column,
      methods,
      properties,
      implements: implementsList.length > 0 ? implementsList : undefined,
      jsdoc,
      kind: "interface",
    };
    
    // Check for public visibility to determine exports
    const visibility = extractVisibility(node);
    if (visibility === "public") {
      exports.push({
        type: "named",
        name: interfaceName,
        line,
        raw: lines[line - 1]?.trim() || "",
        visibility: "public",
      });
    }
    
    interfaces.push(interfaceInfo);
  }
  
  /**
   * Process struct declaration
   */
  function processStruct(node: Parser.SyntaxNode, namespace?: string) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;
    
    const structName = nameNode.text;
    const line = node.startPosition.row + 1;
    const column = node.startPosition.column;
    const jsdoc = extractXmlDoc(node, content);
    
    // Extract interfaces
    const baseList = node.childForFieldName("bases");
    const implementsList: string[] = [];
    
    if (baseList) {
      for (const child of baseList.children) {
        if (child.type === "base_list") {
          for (const item of child.children) {
            if (item.type === "simple_base_type" || item.type === "type") {
              const typeName = content.slice(item.startIndex, item.endIndex);
              implementsList.push(typeName);
            }
          }
        }
      }
    }
    
    // Extract methods and properties
    const methods: MethodInfo[] = [];
    const properties: PropertyInfo[] = [];
    
    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      for (const member of bodyNode.children) {
        if (member.type === "method_declaration") {
          const methodName = member.childForFieldName("name")?.text || "unknown";
          const methodLine = member.startPosition.row + 1;
          const isAsync = hasModifier(member, "async");
          const isStatic = hasModifier(member, "static");
          const visibility = extractVisibility(member);
          const modifiers = extractModifiers(member);
          const signature = getMethodSignature(member, content);
          
          methods.push({
            name: methodName,
            line: methodLine,
            async: isAsync,
            static: isStatic,
            signature,
            visibility,
            modifiers,
          });
        } else if (member.type === "field_declaration") {
          // Structs can have fields
          const declarator = member.children.find(c => c.type === "variable_declaration");
          if (declarator) {
            const varDecl = declarator.children.find(c => c.type === "variable_declarator");
            if (varDecl) {
              const fieldName = varDecl.childForFieldName("name")?.text || "unknown";
              const fieldLine = member.startPosition.row + 1;
              const fieldType = member.childForFieldName("type");
              const visibility = extractVisibility(member);
              
              properties.push({
                name: fieldName,
                line: fieldLine,
                type: fieldType ? content.slice(fieldType.startIndex, fieldType.endIndex) : undefined,
                visibility: visibility as any,
                hasGetter: false,
                hasSetter: false,
              });
            }
          }
        }
      }
    }
    
    const structInfo: ClassInfo = {
      name: structName,
      line,
      column,
      methods,
      properties,
      implements: implementsList.length > 0 ? implementsList : undefined,
      jsdoc,
      kind: "struct",
    };
    
    // Check for public visibility to determine exports
    const visibility = extractVisibility(node);
    if (visibility === "public") {
      exports.push({
        type: "named",
        name: structName,
        line,
        raw: lines[line - 1]?.trim() || "",
        visibility: "public",
      });
    }
    
    structs.push(structInfo);
  }
  
  /**
   * Recursively process nodes
   */
  function processNode(node: Parser.SyntaxNode, namespace?: string) {
    switch (node.type) {
      case "using_directive":
        processUsingDirective(node);
        break;
      case "namespace_declaration":
      case "file_scoped_namespace_declaration":
        processNamespace(node, namespace);
        break;
      case "class_declaration":
        processClass(node, namespace);
        break;
      case "interface_declaration":
        processInterface(node, namespace);
        break;
      case "struct_declaration":
        processStruct(node, namespace);
        break;
      default:
        // Recurse into children
        for (const child of node.children) {
          processNode(child, namespace);
        }
        break;
    }
  }
  
  // Start processing from root
  processNode(rootNode);
  
  // Combine all class types into single array for consistent interface
  const allClasses = [...classes, ...interfaces, ...structs];
  
  return {
    functions,
    classes: allClasses,
    imports,
    exports,
  };
  } catch (error) {
    console.error('C# parsing error:', error);
    return {
      functions: [],
      classes: [],
      imports: [],
      exports: [],
    };
  }
}

/**
 * Get lines with context around a target line
 */
function getLinesWithContext(
  lines: string[],
  targetLine: number,
  contextBefore: number = 3,
  contextAfter: number = 3
): {
  before: string[];
  line: string;
  after: string[];
} {
  const lineIndex = targetLine - 1;
  const startIndex = Math.max(0, lineIndex - contextBefore);
  const endIndex = Math.min(lines.length - 1, lineIndex + contextAfter);

  return {
    before: lines.slice(startIndex, lineIndex),
    line: lines[lineIndex] || "",
    after: lines.slice(lineIndex + 1, endIndex + 1),
  };
}

/**
 * Search C# AST for pattern matches
 */
export function searchCSharpAST(
  content: string,
  pattern: string,
  searchType: string = "all",
  modifiers: string[] = [],
  caseInsensitive: boolean = false
): Match[] {
  try {
    const tree = parseCSharp(content);
    const rootNode = tree.rootNode;
    const lines = content.split("\n");
  const matches: Match[] = [];
  
  // Create regex pattern
  const flags = caseInsensitive ? "i" : "";
  const regex = new RegExp(pattern, flags);
  
  const requiredModifiers = modifiers.map(m => m.toLowerCase());
  
  /**
   * Check if node has all required modifiers
   */
  function matchesModifiers(node: any): boolean {
    if (requiredModifiers.length === 0) return true;
    
    const nodeModifiers = extractModifiers(node).map(m => m.toLowerCase());
    return requiredModifiers.every(mod => nodeModifiers.includes(mod));
  }
  
  /**
   * Add match to results
   */
  function addMatch(
    node: Parser.SyntaxNode,
    matchType: string,
    name: string,
    scope?: string
  ) {
    const line = node.startPosition.row + 1;
    const column = node.startPosition.column;
    const contextData = getLinesWithContext(lines, line, 3, 3);
    const jsdoc = extractXmlDoc(node, content);
    const nodeModifiers = extractModifiers(node);
    
    matches.push({
      file: "",
      line,
      column,
      match_type: matchType,
      name,
      code: contextData.line,
      context: {
        before: contextData.before,
        after: contextData.after,
      },
      scope,
      jsdoc,
      modifiers: nodeModifiers.length > 0 ? nodeModifiers : undefined,
    });
  }
  
  /**
   * Recursively traverse and search nodes
   */
  function traverse(node: Parser.SyntaxNode, currentScope?: string) {
    // Process current node
    switch (node.type) {
      case "class_declaration": {
        const nameNode = node.childForFieldName("name");
        if (nameNode && (searchType === "all" || searchType === "class")) {
          const className = nameNode.text;
          if (regex.test(className)) {
            addMatch(node, "class", className, currentScope);
          }
          
          // Update scope for children
          const newScope = currentScope ? `${currentScope}.${className}` : className;
          
          // Process class members
          const bodyNode = node.childForFieldName("body");
          if (bodyNode) {
            for (const child of bodyNode.children) {
              traverse(child, newScope);
            }
          }
          return;
        }
        break;
      }
      
      case "interface_declaration": {
        const nameNode = node.childForFieldName("name");
        if (nameNode && (searchType === "all" || searchType === "class")) {
          const interfaceName = nameNode.text;
          if (regex.test(interfaceName)) {
            addMatch(node, "interface", interfaceName, currentScope);
          }
        }
        break;
      }
      
      case "struct_declaration": {
        const nameNode = node.childForFieldName("name");
        if (nameNode && (searchType === "all" || searchType === "class")) {
          const structName = nameNode.text;
          if (regex.test(structName)) {
            addMatch(node, "struct", structName, currentScope);
          }
        }
        break;
      }
      
      case "method_declaration": {
        if (searchType === "all" || searchType === "function") {
          const nameNode = node.childForFieldName("name");
          if (nameNode && matchesModifiers(node)) {
            const methodName = nameNode.text;
            if (regex.test(methodName) || (requiredModifiers.length > 0 && requiredModifiers.some(m => hasModifier(node, m)))) {
              addMatch(node, "method", methodName, currentScope);
            }
          }
        }
        break;
      }
      
      case "constructor_declaration": {
        if (searchType === "all" || searchType === "function") {
          if (matchesModifiers(node)) {
            const name = currentScope?.split(".").pop() || "constructor";
            addMatch(node, "constructor", name, currentScope);
          }
        }
        break;
      }
      
      case "property_declaration": {
        if (searchType === "all" || searchType === "variable") {
          const nameNode = node.childForFieldName("name");
          if (nameNode && matchesModifiers(node)) {
            const propName = nameNode.text;
            if (regex.test(propName)) {
              addMatch(node, "property", propName, currentScope);
            }
          }
        }
        break;
      }
      
      case "field_declaration": {
        if (searchType === "all" || searchType === "variable") {
          const declarator = node.children.find(c => c.type === "variable_declaration");
          if (declarator) {
            const varDecl = declarator.children.find(c => c.type === "variable_declarator");
            if (varDecl) {
              const nameNode = varDecl.childForFieldName("name");
              if (nameNode && matchesModifiers(node)) {
                const fieldName = nameNode.text;
                if (regex.test(fieldName)) {
                  addMatch(node, "field", fieldName, currentScope);
                }
              }
            }
          }
        }
        break;
      }
      
      case "using_directive": {
        if (searchType === "all" || searchType === "import") {
          const nameNode = node.childForFieldName("name");
          if (nameNode) {
            const usingName = content.slice(nameNode.startIndex, nameNode.endIndex);
            if (regex.test(usingName)) {
              addMatch(node, "using", usingName, currentScope);
            }
          }
        }
        break;
      }
      
      case "invocation_expression": {
        if (searchType === "all" || searchType === "call") {
          const functionNode = node.childForFieldName("function");
          if (functionNode) {
            let callName = "";
            
            // Handle simple identifiers and member access
            if (functionNode.type === "identifier") {
              callName = functionNode.text;
            } else if (functionNode.type === "member_access_expression") {
              const memberName = functionNode.childForFieldName("name");
              if (memberName) {
                callName = content.slice(functionNode.startIndex, functionNode.endIndex);
              }
            }
            
            if (callName && regex.test(callName)) {
              addMatch(node, "function_call", callName, currentScope);
            }
          }
        }
        break;
      }
    }
    
    // Recurse into children
    for (const child of node.children) {
      traverse(child, currentScope);
    }
  }
  
  // Start traversal
  traverse(rootNode);
  
  return matches;
  } catch (error) {
    console.error('C# search error:', error);
    return [];
  }
}
