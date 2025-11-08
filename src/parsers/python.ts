// @ts-nocheck - Bypass TypeScript checking for Python parser
/**
 * Python AST Parser Module
 * 
 * REQUIRED NPM PACKAGES:
 * - python-parser: JavaScript-based Python parser (npm install python-parser)
 * 
 * Alternative: If python-parser doesn't work, consider:
 * - @pashoo2/python-ast-parser
 * - filbert
 * Or use Python's ast module via subprocess for maximum accuracy
 */

import { spawnSync, execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Data structures matching the TypeScript/Babel implementation
 */
export interface FunctionInfo {
  name: string;
  line: number;
  column: number;
  async: boolean;
  signature: string;
  type: "function_declaration" | "method" | "lambda";
  jsdoc?: string;
}

export interface MethodInfo {
  name: string;
  line: number;
  async: boolean;
  static: boolean;
  signature: string;
  decorator?: string; // Python-specific: @staticmethod, @classmethod, @property
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
 * Parse Python code using Python's built-in ast module via subprocess
 * This ensures maximum accuracy and support for all Python syntax
 */
/**
 * Try to find available Python command
 */
function findPythonCommand(): string | null {
  const commands = ['python3', 'python', 'py'];
  
  for (const cmd of commands) {
    try {
      // Use execSync which handles Windows better
      execSync(`${cmd} --version`, { 
        encoding: 'utf-8', 
        timeout: 2000,
        windowsHide: true,
        stdio: 'pipe'
      });
      return cmd;
    } catch {
      continue;
    }
  }
  
  return null;
}

export function parsePython(content: string): any {
  // Check if Python is available
  const pythonCmd = findPythonCommand();
  if (!pythonCmd) {
    throw new Error('Python is not installed or not in PATH. Please install Python 3.x to parse Python files. Tried: python3, python, py');
  }
  
  // Use Python's ast module to parse the code
  const pythonScript = `
import ast
import json
import sys

try:
    code = sys.stdin.read()
    tree = ast.parse(code)
    
    def serialize_node(node):
        """Convert AST node to JSON-serializable dict"""
        result = {
            '_type': node.__class__.__name__,
        }
        
        # Add location info
        if hasattr(node, 'lineno'):
            result['lineno'] = node.lineno
        if hasattr(node, 'col_offset'):
            result['col_offset'] = node.col_offset
        if hasattr(node, 'end_lineno'):
            result['end_lineno'] = node.end_lineno
        if hasattr(node, 'end_col_offset'):
            result['end_col_offset'] = node.end_col_offset
            
        # Add attributes
        for field, value in ast.iter_fields(node):
            if isinstance(value, list):
                result[field] = [serialize_node(item) if isinstance(item, ast.AST) else item for item in value]
            elif isinstance(value, ast.AST):
                result[field] = serialize_node(value)
            else:
                result[field] = value
                
        return result
    
    serialized = serialize_node(tree)
    print(json.dumps(serialized))
    
except SyntaxError as e:
    error = {
        'error': 'SyntaxError',
        'message': str(e),
        'lineno': e.lineno,
        'offset': e.offset
    }
    print(json.dumps(error))
    sys.exit(1)
except Exception as e:
    error = {
        'error': type(e).__name__,
        'message': str(e)
    }
    print(json.dumps(error))
    sys.exit(1)
`;

  try {
    // Use temp file approach on Windows to avoid subprocess issues
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // Windows workaround: Write to temp file and execute
      const tmpFile = path.join(os.tmpdir(), `py-ast-${Date.now()}.py`);
      
      try {
        fs.writeFileSync(tmpFile, content, 'utf-8');
        const cmd = `${pythonCmd} -c "${pythonScript.replace(/"/g, '\\"')}" < "${tmpFile}"`;
        const output = execSync(cmd, {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
          timeout: 10000,
          windowsHide: true
        });
        fs.unlinkSync(tmpFile);
        return JSON.parse(output);
      } catch (error) {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        throw error;
      }
    } else {
      // Unix: Use spawnSync normally
      const result = spawnSync(pythonCmd, ["-c", pythonScript], {
        input: content,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 10000,
      });

      if (result.error) {
        if (result.error.code === 'ENOENT') {
          throw new Error(`Python command '${pythonCmd}' not found. Ensure Python is installed and in PATH.`);
        }
        throw new Error(`Failed to spawn Python: ${result.error.message}`);
      }

      if (result.status !== 0) {
        const output = result.stdout || result.stderr;
        try {
          const errorData = JSON.parse(output);
          throw new Error(`Python parse error: ${errorData.message} at line ${errorData.lineno || "unknown"}`);
        } catch {
          throw new Error(`Python parse failed: ${output}`);
        }
      }

      return JSON.parse(result.stdout);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse Python: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Extract docstring from Python node
 */
function extractDocstring(node: any): string | undefined {
  // In Python, docstrings are the first statement in a function/class if it's a string
  if (node.body && node.body.length > 0) {
    const firstStmt = node.body[0];
    if (firstStmt._type === "Expr" && firstStmt.value && firstStmt.value._type === "Constant") {
      const value = firstStmt.value.value;
      if (typeof value === "string") {
        return value;
      }
    }
    // Handle older Python AST (pre-3.8) with Str nodes
    if (firstStmt._type === "Expr" && firstStmt.value && firstStmt.value._type === "Str") {
      return firstStmt.value.s;
    }
  }
  return undefined;
}

/**
 * Get function/method signature from node
 */
function getPythonSignature(node: any): string {
  const args = node.args;
  if (!args) return "()";

  const params: string[] = [];

  // Regular arguments
  if (args.args) {
    for (const arg of args.args) {
      let param = arg.arg;
      // Add type annotation if present
      if (arg.annotation) {
        param += `: ${getAnnotationString(arg.annotation)}`;
      }
      params.push(param);
    }
  }

  // *args
  if (args.vararg) {
    let param = `*${args.vararg.arg}`;
    if (args.vararg.annotation) {
      param += `: ${getAnnotationString(args.vararg.annotation)}`;
    }
    params.push(param);
  }

  // **kwargs
  if (args.kwarg) {
    let param = `**${args.kwarg.arg}`;
    if (args.kwarg.annotation) {
      param += `: ${getAnnotationString(args.kwarg.annotation)}`;
    }
    params.push(param);
  }

  return `(${params.join(", ")})`;
}

/**
 * Convert annotation node to string
 */
function getAnnotationString(annotation: any): string {
  if (!annotation) return "";
  
  if (annotation._type === "Name") {
    return annotation.id;
  } else if (annotation._type === "Constant") {
    return String(annotation.value);
  } else if (annotation._type === "Subscript") {
    const value = getAnnotationString(annotation.value);
    const slice = getAnnotationString(annotation.slice);
    return `${value}[${slice}]`;
  } else if (annotation._type === "Attribute") {
    const value = getAnnotationString(annotation.value);
    return `${value}.${annotation.attr}`;
  }
  
  return "Any";
}

/**
 * Check if function is async
 */
function isAsyncFunction(node: any): boolean {
  return node._type === "AsyncFunctionDef";
}

/**
 * Get decorators from node
 */
function getDecorators(node: any): string[] {
  if (!node.decorator_list || node.decorator_list.length === 0) {
    return [];
  }

  return node.decorator_list.map((dec: any) => {
    if (dec._type === "Name") {
      return dec.id;
    } else if (dec._type === "Call" && dec.func && dec.func._type === "Name") {
      return dec.func.id;
    } else if (dec._type === "Attribute") {
      return dec.attr;
    }
    return "unknown";
  });
}

/**
 * Check if method is static
 */
function isStaticMethod(decorators: string[]): boolean {
  return decorators.includes("staticmethod");
}

/**
 * Check if method is classmethod
 */
function isClassMethod(decorators: string[]): boolean {
  return decorators.includes("classmethod");
}

/**
 * Check if method is property
 */
function isProperty(decorators: string[]): boolean {
  return decorators.includes("property");
}

/**
 * Extract file outline from Python code
 */
export function extractPythonOutline(content: string): {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
} {
  const ast = parsePython(content);
  const lines = content.split("\n");

  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];

  // Track lines inside class bodies to filter out methods from top-level functions
  const classBodyLines = new Set<number>();

  /**
   * Traverse AST recursively
   */
  function traverse(node: any, parent?: any, scope?: string) {
    if (!node || typeof node !== "object") return;

    const nodeType = node._type;

    // Function definitions (top-level)
    if (nodeType === "FunctionDef" || nodeType === "AsyncFunctionDef") {
      const line = node.lineno || 0;
      const column = node.col_offset || 0;
      
      // Skip if inside a class (handled separately)
      if (classBodyLines.has(line)) {
        return;
      }

      functions.push({
        name: node.name,
        line,
        column,
        async: isAsyncFunction(node),
        signature: `${node.name}${getPythonSignature(node)}`,
        type: "function_declaration",
        jsdoc: extractDocstring(node),
      });
      return; // Don't traverse into function body
    }

    // Class definitions
    if (nodeType === "ClassDeclaration" || nodeType === "ClassDef") {
      const line = node.lineno || 0;
      const column = node.col_offset || 0;
      const endLine = node.end_lineno || line;
      
      // Mark class body lines
      for (let i = line; i <= endLine; i++) {
        classBodyLines.add(i);
      }

      const methods: MethodInfo[] = [];

      // Extract methods from class body
      if (node.body) {
        for (const member of node.body) {
          if (member._type === "FunctionDef" || member._type === "AsyncFunctionDef") {
            const decorators = getDecorators(member);
            const isStatic = isStaticMethod(decorators);
            const isClass = isClassMethod(decorators);
            const isProp = isProperty(decorators);

            // Build decorator string
            let decorator = undefined;
            if (isStatic) decorator = "@staticmethod";
            else if (isClass) decorator = "@classmethod";
            else if (isProp) decorator = "@property";

            methods.push({
              name: member.name,
              line: member.lineno || 0,
              async: isAsyncFunction(member),
              static: isStatic,
              signature: `${member.name}${getPythonSignature(member)}`,
              decorator,
            });
          }
        }
      }

      // Get base classes
      let baseClass = undefined;
      if (node.bases && node.bases.length > 0) {
        const firstBase = node.bases[0];
        if (firstBase._type === "Name") {
          baseClass = firstBase.id;
        } else if (firstBase._type === "Attribute") {
          baseClass = firstBase.attr;
        }
      }

      classes.push({
        name: node.name,
        line,
        column,
        methods,
        extends: baseClass,
        jsdoc: extractDocstring(node),
      });
      return; // Don't traverse into class body (already processed)
    }

    // Import statements: import X, import X as Y
    if (nodeType === "Import") {
      const line = node.lineno || 0;
      const importedNames: string[] = [];

      for (const alias of node.names || []) {
        importedNames.push(alias.asname || alias.name);
      }

      const rawLine = lines[line - 1]?.trim() || "";
      
      imports.push({
        source: node.names[0]?.name || "unknown",
        imported: importedNames,
        line,
        raw: rawLine,
      });
    }

    // ImportFrom statements: from X import Y, Z
    if (nodeType === "ImportFrom") {
      const line = node.lineno || 0;
      const source = node.module || ".";
      const importedNames: string[] = [];

      for (const alias of node.names || []) {
        if (alias.name === "*") {
          importedNames.push("*");
        } else {
          importedNames.push(alias.asname || alias.name);
        }
      }

      const rawLine = lines[line - 1]?.trim() || "";
      
      imports.push({
        source,
        imported: importedNames,
        line,
        raw: rawLine,
      });
    }

    // Python doesn't have explicit exports like JavaScript
    // We can treat __all__ as exports or top-level assignments
    if (nodeType === "Assign") {
      // Check if this is __all__ = [...]
      if (node.targets && node.targets.length > 0) {
        const target = node.targets[0];
        if (target._type === "Name" && target.id === "__all__") {
          const line = node.lineno || 0;
          // Extract names from the list
          if (node.value && node.value._type === "List") {
            for (const elt of node.value.elts || []) {
              if (elt._type === "Constant" && typeof elt.value === "string") {
                exports.push({
                  type: "named",
                  name: elt.value,
                  line,
                  raw: lines[line - 1]?.trim() || "",
                });
              } else if (elt._type === "Str") {
                // Pre-Python 3.8
                exports.push({
                  type: "named",
                  name: elt.s,
                  line,
                  raw: lines[line - 1]?.trim() || "",
                });
              }
            }
          }
        }
      }
    }

    // Recursively traverse child nodes
    for (const key in node) {
      if (key.startsWith("_")) continue; // Skip metadata fields
      
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object") {
            traverse(item, node, scope);
          }
        }
      } else if (value && typeof value === "object") {
        traverse(value, node, scope);
      }
    }
  }

  // Start traversal
  if (ast.body) {
    for (const node of ast.body) {
      traverse(node);
    }
  }

  return {
    functions,
    classes,
    imports,
    exports,
  };
}

/**
 * Search Python AST for patterns
 */
export function searchPythonAST(
  content: string,
  pattern: string,
  searchType: string = "all",
  modifiers: string[] = [],
  caseInsensitive: boolean = false
): Match[] {
  const ast = parsePython(content);
  const lines = content.split("\n");
  const matches: Match[] = [];

  // Create regex from pattern
  const flags = caseInsensitive ? "i" : "";
  const regex = new RegExp(pattern, flags);

  // Normalize search type
  const type = searchType.toLowerCase();
  const requiredModifiers = modifiers.map(m => m.toLowerCase());

  /**
   * Check if node matches required modifiers
   */
  function matchesModifiers(node: any, decorators: string[] = []): boolean {
    if (requiredModifiers.length === 0) return true;

    const nodeModifiers: string[] = [];

    // Check async
    if (node._type === "AsyncFunctionDef") {
      nodeModifiers.push("async");
    }

    // Check decorators
    for (const dec of decorators) {
      const decLower = dec.toLowerCase();
      if (decLower === "staticmethod") nodeModifiers.push("static");
      if (decLower === "classmethod") nodeModifiers.push("classmethod");
      if (decLower === "property") nodeModifiers.push("property");
    }

    // Check for private (underscore prefix)
    if (node.name && node.name.startsWith("_") && !node.name.startsWith("__")) {
      nodeModifiers.push("private");
    }

    // Check if all required modifiers are present
    return requiredModifiers.every(mod => nodeModifiers.includes(mod));
  }

  /**
   * Get context lines around a line number
   */
  function getContext(line: number, before: number = 3, after: number = 3) {
    const startLine = Math.max(0, line - 1 - before);
    const endLine = Math.min(lines.length, line + after);
    
    return {
      before: lines.slice(startLine, line - 1),
      after: lines.slice(line, endLine),
    };
  }

  /**
   * Traverse AST and collect matches
   */
  function traverse(node: any, scope: string[] = []) {
    if (!node || typeof node !== "object") return;

    const nodeType = node._type;

    // Function definitions
    if (nodeType === "FunctionDef" || nodeType === "AsyncFunctionDef") {
      if (type === "all" || type === "function") {
        const decorators = getDecorators(node);
        
        if (matchesModifiers(node, decorators)) {
          const isModifierPattern = requiredModifiers.includes(pattern.toLowerCase());
          const nameMatches = regex.test(node.name);
          
          if (isModifierPattern || nameMatches) {
            const line = node.lineno || 0;
            const context = getContext(line);
            
            const mods: string[] = [];
            if (node._type === "AsyncFunctionDef") mods.push("async");
            mods.push(...decorators.map(d => d.toLowerCase()));
            
            matches.push({
              file: "",
              line,
              column: node.col_offset || 0,
              match_type: scope.length > 0 ? "method" : "function_declaration",
              name: node.name,
              code: lines[line - 1] || "",
              context,
              scope: scope.length > 0 ? scope.join(" > ") : undefined,
              jsdoc: extractDocstring(node),
              modifiers: mods.length > 0 ? mods : undefined,
            });
          }
        }
      }
      
      // Don't traverse into function body
      return;
    }

    // Class definitions
    if (nodeType === "ClassDef") {
      if (type === "all" || type === "class") {
        if (regex.test(node.name)) {
          const line = node.lineno || 0;
          const context = getContext(line);
          
          matches.push({
            file: "",
            line,
            column: node.col_offset || 0,
            match_type: "class_declaration",
            name: node.name,
            code: lines[line - 1] || "",
            context,
            jsdoc: extractDocstring(node),
          });
        }
      }
      
      // Traverse class body for methods
      if (node.body) {
        const newScope = [...scope, `class:${node.name}`];
        for (const member of node.body) {
          traverse(member, newScope);
        }
      }
      return;
    }

    // Import statements
    if (nodeType === "Import" || nodeType === "ImportFrom") {
      if (type === "all" || type === "import") {
        const source = nodeType === "ImportFrom" ? node.module : node.names[0]?.name;
        
        if (source && regex.test(source)) {
          const line = node.lineno || 0;
          const context = getContext(line);
          
          matches.push({
            file: "",
            line,
            column: node.col_offset || 0,
            match_type: "import",
            name: source,
            code: lines[line - 1] || "",
            context,
          });
        }
      }
    }

    // Variable assignments
    if (nodeType === "Assign" && type === "variable") {
      if (node.targets && node.targets.length > 0) {
        const target = node.targets[0];
        if (target._type === "Name" && regex.test(target.id)) {
          const line = node.lineno || 0;
          const context = getContext(line);
          
          matches.push({
            file: "",
            line,
            column: node.col_offset || 0,
            match_type: "variable",
            name: target.id,
            code: lines[line - 1] || "",
            context,
            scope: scope.length > 0 ? scope.join(" > ") : undefined,
          });
        }
      }
    }

    // Function calls
    if (nodeType === "Call" && (type === "all" || type === "call")) {
      let calleeName = "";
      
      // Extract function name from call
      if (node.func) {
        if (node.func._type === "Name") {
          calleeName = node.func.id;
        } else if (node.func._type === "Attribute") {
          // For method calls like obj.method()
          calleeName = node.func.attr;
          // Also try to get full qualified name
          let fullName = node.func.attr;
          let current = node.func.value;
          while (current) {
            if (current._type === "Name") {
              fullName = `${current.id}.${fullName}`;
              break;
            } else if (current._type === "Attribute") {
              fullName = `${current.attr}.${fullName}`;
              current = current.value;
            } else {
              break;
            }
          }
          calleeName = fullName;
        }
      }
      
      if (calleeName && regex.test(calleeName)) {
        const line = node.lineno || 0;
        const context = getContext(line);
        
        matches.push({
          file: "",
          line,
          column: node.col_offset || 0,
          match_type: "function_call",
          name: calleeName,
          code: lines[line - 1] || "",
          context,
          scope: scope.length > 0 ? scope.join(" > ") : undefined,
        });
      }
    }

    // Recursively traverse child nodes
    for (const key in node) {
      if (key.startsWith("_")) continue;
      
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object") {
            traverse(item, scope);
          }
        }
      } else if (value && typeof value === "object") {
        traverse(value, scope);
      }
    }
  }

  // Start traversal
  if (ast.body) {
    for (const node of ast.body) {
      traverse(node);
    }
  }

  return matches;
}

/**
 * Extract specific target from Python code
 */
export function extractPythonTarget(
  content: string,
  targetType: string,
  targetName: string,
  className?: string,
  contextLines: number = 5
): any {
  const ast = parsePython(content);
  const lines = content.split("\n");

  let result: any = null;

  /**
   * Extract code with context
   */
  function extractCode(startLine: number, endLine: number, type: string, name: string, cls?: string) {
    const contextStart = Math.max(0, startLine - contextLines - 1);
    const contextEnd = Math.min(lines.length, endLine + contextLines);

    return {
      success: true,
      mode: "target",
      target_type: type,
      target_name: name,
      ...(cls && { class_name: cls }),
      line: startLine,
      end_line: endLine,
      code: lines.slice(startLine - 1, endLine).join("\n"),
      context_before: lines.slice(contextStart, startLine - 1).join("\n"),
      context_after: lines.slice(endLine, contextEnd).join("\n"),
    };
  }

  /**
   * Traverse AST to find target
   */
  function traverse(node: any, currentClass?: string): boolean {
    if (!node || typeof node !== "object") return false;

    const nodeType = node._type;

    // Search for class
    if (targetType === "class" && (nodeType === "ClassDef")) {
      if (node.name === targetName) {
        const startLine = node.lineno || 0;
        const endLine = node.end_lineno || startLine;
        result = extractCode(startLine, endLine, "class", targetName);
        return true;
      }
    }

    // Search for function/method
    if ((targetType === "function" || targetType === "method") && 
        (nodeType === "FunctionDef" || nodeType === "AsyncFunctionDef")) {
      
      // If className is specified, only match within that class
      if (className && currentClass !== className) {
        // Continue searching
      } else if (node.name === targetName) {
        const startLine = node.lineno || 0;
        const endLine = node.end_lineno || startLine;
        result = extractCode(startLine, endLine, currentClass ? "method" : "function", targetName, currentClass);
        return true;
      }
    }

    // Traverse into class body
    if (nodeType === "ClassDef") {
      if (node.body) {
        for (const member of node.body) {
          if (traverse(member, node.name)) {
            return true;
          }
        }
      }
    }

    // Traverse child nodes
    for (const key in node) {
      if (key.startsWith("_")) continue;
      
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object") {
            if (traverse(item, currentClass)) {
              return true;
            }
          }
        }
      } else if (value && typeof value === "object") {
        if (traverse(value, currentClass)) {
          return true;
        }
      }
    }

    return false;
  }

  // Start traversal
  if (ast.body) {
    for (const node of ast.body) {
      if (traverse(node)) {
        break;
      }
    }
  }

  return result;
}
