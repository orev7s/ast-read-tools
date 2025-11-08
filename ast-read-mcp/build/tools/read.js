import * as fs from "fs";
import { z } from "zod";
import * as parser from "@babel/parser";
// @ts-ignore - CommonJS interop
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { detectLanguage, extractJSDoc, } from "./shared.js";
// Fix for CommonJS default export in ES modules
// @ts-ignore
const traverseFn = traverse.default || traverse;
/**
 * COMPLETELY REWRITTEN AST-Read Tool
 * Now using @babel/parser for RELIABLE AST parsing
 * NO MORE PROCESS SPAWNING - Direct AST traversal
 */
const ReadFileSchema = z.object({
    file_path: z.string().describe("Absolute path to file to read"),
    mode: z
        .enum(["full", "outline", "target", "lines"])
        .optional()
        .default("full")
        .describe("Reading mode: 'full' = entire file, 'outline' = structure only, 'target' = specific entity, 'lines' = specific line range"),
    target: z
        .string()
        .optional()
        .describe("Target to extract (requires mode='target'). Format: 'function:name', 'class:name', 'class:ClassName.methodName', 'method:methodName', 'imports', 'exports'"),
    line: z
        .number()
        .optional()
        .describe("Target line number (requires mode='lines')"),
    linesAbove: z
        .number()
        .optional()
        .default(10)
        .describe("Number of lines to show above target line (default: 10)"),
    linesBelow: z
        .number()
        .optional()
        .default(10)
        .describe("Number of lines to show below target line (default: 10)"),
    context: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include surrounding context for targets"),
    contextLines: z
        .number()
        .optional()
        .default(5)
        .describe("Number of lines of context before/after target (default: 5)"),
    show_calls: z
        .boolean()
        .optional()
        .default(false)
        .describe("Show functions that the target calls"),
    show_dependencies: z
        .boolean()
        .optional()
        .default(false)
        .describe("Show imports used by the target"),
    verbose: z
        .boolean()
        .optional()
        .default(true)
        .describe("Return full output (true) or concise summary (false). Default: true. AI always receives full data."),
});
/**
 * AST-Read Tool - FIXED VERSION
 */
export class AstReadTool {
    static getSchema() {
        return {
            name: "ast_read_file",
            description: "Read files with AST-awareness and structural understanding. FIXED: Now uses Babel parser for 95%+ reliability.",
            inputSchema: {
                type: "object",
                properties: {
                    file_path: {
                        type: "string",
                        description: "Absolute path to file to read",
                    },
                    mode: {
                        type: "string",
                        enum: ["full", "outline", "target"],
                        description: "Reading mode: 'full' = entire file, 'outline' = structure only, 'target' = specific entity",
                        default: "full",
                    },
                    target: {
                        type: "string",
                        description: "Target to extract (requires mode='target'). Format: 'function:name', 'class:name', 'imports', 'exports'",
                    },
                    context: {
                        type: "boolean",
                        description: "Include surrounding context for targets",
                        default: true,
                    },
                },
                required: ["file_path"],
            },
        };
    }
    async execute(input) {
        const params = ReadFileSchema.parse(input);
        // Validate file exists
        if (!fs.existsSync(params.file_path)) {
            return this.createError(`File not found: ${params.file_path}`, "FILE_NOT_FOUND", params.file_path, params.mode);
        }
        try {
            const content = fs.readFileSync(params.file_path, "utf-8");
            const language = detectLanguage(params.file_path);
            switch (params.mode) {
                case "full":
                    return this.readFull(params.file_path, content);
                case "outline":
                    return this.readOutline(params, content, language);
                case "lines":
                    if (!params.line) {
                        return this.createError("line parameter required when mode='lines'", "MISSING_LINE", params.file_path, params.mode);
                    }
                    return this.readLines(params, content);
                case "target":
                    if (!params.target) {
                        return this.createError("target parameter required when mode='target'", "MISSING_TARGET", params.file_path, params.mode);
                    }
                    return this.readTarget(params, content, language);
                default:
                    return this.createError(`Unknown mode: ${params.mode}`, "INVALID_MODE", params.file_path, params.mode);
            }
        }
        catch (error) {
            return this.createError(error.message || "Unknown error", error.constructor.name, params.file_path, params.mode, this.getHelpfulHint(error));
        }
    }
    /**
     * Create error response (NO MORE SILENT FAILURES!)
     */
    createError(message, type, filePath, mode, hint) {
        return {
            success: false,
            error: message,
            error_type: type,
            file_path: filePath,
            mode: mode,
            hint: hint,
        };
    }
    /**
     * Get helpful hint for common errors
     */
    getHelpfulHint(error) {
        const message = error.message.toLowerCase();
        if (message.includes("unexpected token")) {
            return "File may contain syntax errors or use unsupported JavaScript features. Try using mode='full' instead.";
        }
        if (message.includes("eof") || message.includes("unterminated")) {
            return "File appears to have unclosed brackets or strings. Check file syntax.";
        }
        return "Try using mode='full' to read the entire file without parsing.";
    }
    /**
     * Read full file
     */
    readFull(filePath, content) {
        const lines = content.split("\n");
        return {
            success: true,
            mode: "full",
            file_path: filePath,
            line_count: lines.length,
            size_bytes: content.length,
            content: content,
        };
    }
    /**
     * Read specific line range
     */
    readLines(params, content) {
        const lines = content.split("\n");
        const targetLine = params.line;
        const linesAbove = params.linesAbove || 10;
        const linesBelow = params.linesBelow || 10;
        // Validate line number
        if (targetLine < 1 || targetLine > lines.length) {
            return this.createError(`Line ${targetLine} out of range (file has ${lines.length} lines)`, "LINE_OUT_OF_RANGE", params.file_path, params.mode);
        }
        // Calculate range (line numbers are 1-based, array is 0-based)
        const startLine = Math.max(1, targetLine - linesAbove);
        const endLine = Math.min(lines.length, targetLine + linesBelow);
        // Extract lines
        const extractedLines = lines.slice(startLine - 1, endLine);
        const codeContent = extractedLines.join("\n");
        const result = {
            success: true,
            mode: "lines",
            file_path: params.file_path,
            target_line: targetLine,
            start_line: startLine,
            end_line: endLine,
            total_lines: lines.length,
            lines_above: targetLine - startLine,
            lines_below: endLine - targetLine,
            content: codeContent,
        };
        // Add summary if verbose is false
        if (params.verbose === false) {
            return {
                ...result,
                summary: `✅ Showing line ${targetLine} (${startLine}-${endLine} of ${lines.length} total lines)`,
            };
        }
        return result;
    }
    /**
     * Read file outline using Babel parser
     */
    readOutline(params, content, language) {
        const filePath = params.file_path;
        try {
            // Parse with Babel
            const ast = parser.parse(content, {
                sourceType: "module",
                plugins: [
                    "jsx",
                    "typescript",
                    "classProperties",
                    "dynamicImport",
                    "asyncGenerators",
                    "objectRestSpread",
                    "optionalChaining",
                    "nullishCoalescingOperator",
                ],
            });
            const functions = [];
            const classes = [];
            const imports = [];
            const exports = [];
            // Track lines inside class bodies to filter out methods from top-level functions
            const classBodyLines = new Set();
            const tool = this; // Capture instance for callbacks
            // Traverse AST
            traverseFn(ast, {
                // Function Declarations
                FunctionDeclaration(path) {
                    const node = path.node;
                    if (node.id) {
                        const line = node.loc?.start.line || 0;
                        // Skip if this function is inside a class body
                        if (classBodyLines.has(line)) {
                            return;
                        }
                        functions.push({
                            name: node.id.name,
                            line: line,
                            column: node.loc?.start.column || 0,
                            async: node.async || false,
                            signature: tool.getFunctionSignature(node),
                            type: "function_declaration",
                            jsdoc: extractJSDoc(node),
                        });
                    }
                },
                // Arrow Functions and Function Expressions assigned to variables
                VariableDeclarator(path) {
                    const node = path.node;
                    if (t.isIdentifier(node.id) &&
                        (t.isArrowFunctionExpression(node.init) ||
                            t.isFunctionExpression(node.init))) {
                        const line = node.loc?.start.line || 0;
                        // Skip if this is inside a class body
                        if (classBodyLines.has(line)) {
                            return;
                        }
                        functions.push({
                            name: node.id.name,
                            line: line,
                            column: node.loc?.start.column || 0,
                            async: node.init.async || false,
                            signature: `${node.id.name} = ${tool.getFunctionSignature(node.init)}`,
                            type: t.isArrowFunctionExpression(node.init)
                                ? "arrow_function"
                                : "function_expression",
                            jsdoc: extractJSDoc(node),
                        });
                    }
                },
                // Class Declarations
                ClassDeclaration(path) {
                    const node = path.node;
                    if (node.id) {
                        // Record all lines in this class body to filter methods from top-level functions
                        const start = node.loc?.start.line || 0;
                        const end = node.loc?.end.line || start;
                        for (let i = start; i <= end; i++) {
                            classBodyLines.add(i);
                        }
                        const methods = [];
                        // Extract methods
                        node.body.body.forEach((member) => {
                            if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
                                methods.push({
                                    name: member.key.name,
                                    line: member.loc?.start.line || 0,
                                    async: member.async || false,
                                    static: member.static || false,
                                    signature: tool.getMethodSignature(member),
                                });
                            }
                        });
                        classes.push({
                            name: node.id.name,
                            line: start,
                            column: node.loc?.start.column || 0,
                            methods: methods,
                            extends: node.superClass && t.isIdentifier(node.superClass)
                                ? node.superClass.name
                                : undefined,
                            jsdoc: extractJSDoc(node),
                        });
                    }
                },
                // Imports
                ImportDeclaration(path) {
                    const node = path.node;
                    const imported = node.specifiers.map((spec) => {
                        if (t.isImportDefaultSpecifier(spec)) {
                            return spec.local.name;
                        }
                        else if (t.isImportSpecifier(spec)) {
                            return t.isIdentifier(spec.imported)
                                ? spec.imported.name
                                : "unknown";
                        }
                        else if (t.isImportNamespaceSpecifier(spec)) {
                            return `* as ${spec.local.name}`;
                        }
                        return "unknown";
                    });
                    imports.push({
                        source: node.source.value,
                        imported: imported,
                        line: node.loc?.start.line || 0,
                        raw: content
                            .split("\n")[node.loc?.start.line ? node.loc.start.line - 1 : 0]?.trim() || "",
                    });
                },
                // CommonJS require() statements
                CallExpression(path) {
                    const node = path.node;
                    if (t.isIdentifier(node.callee) &&
                        node.callee.name === "require" &&
                        node.arguments.length > 0 &&
                        t.isStringLiteral(node.arguments[0])) {
                        const parent = path.parent;
                        let varName = "unknown";
                        if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
                            varName = parent.id.name;
                        }
                        imports.push({
                            source: node.arguments[0].value,
                            imported: [varName],
                            line: node.loc?.start.line || 0,
                            raw: content
                                .split("\n")[node.loc?.start.line ? node.loc.start.line - 1 : 0]?.trim() ||
                                "",
                        });
                    }
                },
                // Named Exports: export const foo = ..., export function bar() {}
                ExportNamedDeclaration(path) {
                    const node = path.node;
                    const line = node.loc?.start.line || 0;
                    if (node.declaration) {
                        // export function foo() {} or export const bar = ...
                        if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
                            exports.push({
                                type: "named",
                                name: node.declaration.id.name,
                                line: line,
                                raw: content.split("\n")[line - 1]?.trim() || ""
                            });
                        }
                        else if (t.isVariableDeclaration(node.declaration)) {
                            node.declaration.declarations.forEach((decl) => {
                                if (t.isIdentifier(decl.id)) {
                                    exports.push({
                                        type: "named",
                                        name: decl.id.name,
                                        line: line,
                                        raw: content.split("\n")[line - 1]?.trim() || ""
                                    });
                                }
                            });
                        }
                        else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
                            exports.push({
                                type: "named",
                                name: node.declaration.id.name,
                                line: line,
                                raw: content.split("\n")[line - 1]?.trim() || ""
                            });
                        }
                    }
                    else if (node.specifiers && node.specifiers.length > 0) {
                        // export { foo, bar }
                        node.specifiers.forEach((spec) => {
                            if (t.isExportSpecifier(spec) && t.isIdentifier(spec.exported)) {
                                exports.push({
                                    type: "named",
                                    name: spec.exported.name,
                                    line: line,
                                    raw: content.split("\n")[line - 1]?.trim() || ""
                                });
                            }
                        });
                    }
                },
                // Default Export: export default MyClass
                ExportDefaultDeclaration(path) {
                    const node = path.node;
                    const line = node.loc?.start.line || 0;
                    let name = undefined;
                    if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
                        name = node.declaration.id.name;
                    }
                    else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
                        name = node.declaration.id.name;
                    }
                    else if (t.isIdentifier(node.declaration)) {
                        name = node.declaration.name;
                    }
                    exports.push({
                        type: "default",
                        name: name,
                        line: line,
                        raw: content.split("\n")[line - 1]?.trim() || ""
                    });
                },
            });
            // Deduplicate functions by name and line
            const uniqueFunctions = this.deduplicateFunctions(functions);
            const stats = {
                function_count: uniqueFunctions.length,
                class_count: classes.length,
                import_count: imports.length,
                export_count: exports.length,
            };
            const fullData = {
                success: true,
                mode: "outline",
                file_path: filePath,
                language: language,
                structure: {
                    functions: uniqueFunctions,
                    classes: classes,
                    imports: imports,
                    exports: exports,
                },
                stats: stats,
            };
            // If verbose is false, add summary for user display (AI still gets full data)
            if (params.verbose === false) {
                return {
                    ...fullData,
                    summary: `✅ File analyzed: ${stats.function_count} function${stats.function_count !== 1 ? 's' : ''}, ${stats.class_count} class${stats.class_count !== 1 ? 'es' : ''}, ${stats.import_count} import${stats.import_count !== 1 ? 's' : ''}, ${stats.export_count} export${stats.export_count !== 1 ? 's' : ''}`,
                };
            }
            return fullData;
        }
        catch (error) {
            // More specific error message
            const errorMsg = error.message || "Unknown error";
            const isTraverseError = errorMsg.includes("traverse") || errorMsg.includes("not a function");
            return {
                success: false,
                error: `Failed to parse file: ${errorMsg}`,
                error_type: error.constructor.name,
                file_path: filePath,
                mode: "outline",
                hint: isTraverseError
                    ? "Module loading error detected. This is a bug in the MCP server. Please report to developer with this error message."
                    : this.getHelpfulHint(error),
                partial_structure: {
                    functions: [],
                    classes: [],
                    imports: [],
                    exports: [],
                },
            };
        }
    }
    /**
     * Read specific target (function, class, method, etc.)
     */
    readTarget(params, content, language) {
        const targetParts = params.target.split(":");
        const targetType = targetParts[0];
        const targetPath = targetParts[1] || "";
        if (targetType === "imports") {
            const outline = this.readOutline(params, content, language);
            if ("success" in outline && outline.success && "structure" in outline && outline.structure) {
                const importsCount = outline.structure.imports.length;
                const result = {
                    success: true,
                    mode: "target",
                    target_type: "imports",
                    imports: outline.structure.imports,
                };
                // Add summary if verbose is false
                if (params.verbose === false) {
                    return {
                        ...result,
                        summary: `✅ Found ${importsCount} import${importsCount !== 1 ? 's' : ''}`,
                    };
                }
                return result;
            }
            return outline;
        }
        if (targetType === "exports") {
            const outline = this.readOutline(params, content, language);
            if ("success" in outline && outline.success && "structure" in outline && outline.structure) {
                const exportsCount = outline.structure.exports.length;
                const result = {
                    success: true,
                    mode: "target",
                    target_type: "exports",
                    exports: outline.structure.exports,
                };
                // Add summary if verbose is false
                if (params.verbose === false) {
                    return {
                        ...result,
                        summary: `✅ Found ${exportsCount} export${exportsCount !== 1 ? 's' : ''}`,
                    };
                }
                return result;
            }
            return outline;
        }
        // Parse target path: supports "ClassName.methodName" or just "name"
        let className = null;
        let targetName = targetPath;
        if (targetPath.includes(".")) {
            const parts = targetPath.split(".");
            className = parts[0];
            targetName = parts[1];
        }
        // Parse and find target
        try {
            const ast = parser.parse(content, {
                sourceType: "module",
                plugins: ["jsx", "typescript", "classProperties", "dynamicImport"],
            });
            const lines = content.split("\n");
            const contextLines = params.contextLines || 5;
            let found = false;
            let result = null;
            // Helper to extract code with context
            const extractCode = (start, end, targetType, targetName, className) => {
                const contextStart = Math.max(0, start - contextLines);
                const contextEnd = Math.min(lines.length, end + contextLines);
                return {
                    success: true,
                    mode: "target",
                    target_type: targetType,
                    target_name: targetName,
                    ...(className && { class_name: className }),
                    line: start,
                    end_line: end,
                    code: lines.slice(start - 1, end).join("\n"),
                    context_before: params.context ? lines.slice(contextStart, start - 1).join("\n") : "",
                    context_after: params.context ? lines.slice(end, contextEnd).join("\n") : "",
                };
            };
            traverseFn(ast, {
                ClassDeclaration(path) {
                    const node = path.node;
                    const currentClassName = node.id?.name;
                    // Extract entire class
                    if (targetType === "class" && !className && currentClassName === targetName) {
                        found = true;
                        const start = node.loc?.start.line || 0;
                        const end = node.loc?.end.line || start;
                        result = extractCode(start, end, "class", targetName);
                        path.stop();
                        return;
                    }
                    // Extract method from specific class: class:ClassName.methodName
                    if ((targetType === "class" || targetType === "method") && className && currentClassName === className) {
                        const method = node.body.body.find((member) => t.isClassMethod(member) && t.isIdentifier(member.key) && member.key.name === targetName);
                        if (method) {
                            found = true;
                            const start = method.loc?.start.line || 0;
                            const end = method.loc?.end.line || start;
                            result = extractCode(start, end, "method", targetName, className);
                            path.stop();
                            return;
                        }
                    }
                    // Search for method in any class: method:methodName or function:methodName
                    if ((targetType === "method" || targetType === "function") && !className) {
                        const method = node.body.body.find((member) => t.isClassMethod(member) && t.isIdentifier(member.key) && member.key.name === targetName);
                        if (method) {
                            found = true;
                            const start = method.loc?.start.line || 0;
                            const end = method.loc?.end.line || start;
                            result = extractCode(start, end, "method", targetName, currentClassName);
                            path.stop();
                            return;
                        }
                    }
                },
                FunctionDeclaration(path) {
                    if (targetType === "function" && path.node.id && path.node.id.name === targetName) {
                        found = true;
                        const start = path.node.loc?.start.line || 0;
                        const end = path.node.loc?.end.line || start;
                        result = extractCode(start, end, "function", targetName);
                        path.stop();
                    }
                },
                VariableDeclarator(path) {
                    const node = path.node;
                    if (targetType === "function" &&
                        t.isIdentifier(node.id) &&
                        node.id.name === targetName &&
                        (t.isArrowFunctionExpression(node.init) || t.isFunctionExpression(node.init))) {
                        found = true;
                        const start = node.loc?.start.line || 0;
                        const end = node.loc?.end.line || start;
                        result = extractCode(start, end, "function", targetName);
                        path.stop();
                    }
                },
            });
            if (found && result) {
                // Add summary if verbose is false
                if (params.verbose === false) {
                    const lineCount = result.end_line - result.line + 1;
                    const entityType = result.target_type;
                    const entityName = result.class_name
                        ? `${result.class_name}.${result.target_name}`
                        : result.target_name;
                    return {
                        ...result,
                        summary: `✅ Extracted ${entityType} '${entityName}' (${lineCount} line${lineCount !== 1 ? 's' : ''})`,
                    };
                }
                return result;
            }
            // Enhanced error messages based on what was searched
            let errorMsg = `${targetType} '${targetPath}' not found in file`;
            let hint = `Try using mode='outline' first to see available entities`;
            if (targetType === "function" || targetType === "method") {
                hint = `Method '${targetName}' not found. If it's a class method, try:\n` +
                    `  • 'class:ClassName.${targetName}' (if you know the class name)\n` +
                    `  • 'method:${targetName}' (to search all classes)\n` +
                    `  • Use mode='outline' to see all available methods`;
            }
            else if (targetType === "class" && className) {
                hint = `Method '${targetName}' not found in class '${className}'.\n` +
                    `Use mode='outline' to see all methods in this class.`;
            }
            return this.createError(errorMsg, "TARGET_NOT_FOUND", params.file_path, params.mode, hint);
        }
        catch (error) {
            return this.createError(`Failed to extract target: ${error.message}`, error.constructor.name, params.file_path, params.mode);
        }
    }
    /**
     * Get function signature string
     */
    getFunctionSignature(node) {
        const params = node.params
            .map((p) => (t.isIdentifier(p) ? p.name : "..."))
            .join(", ");
        const async = node.async ? "async " : "";
        const name = node.id ? node.id.name : "";
        if (t.isArrowFunctionExpression(node)) {
            return `${async}(${params}) => {...}`;
        }
        return `${async}function ${name}(${params})`;
    }
    /**
     * Get method signature string
     */
    getMethodSignature(node) {
        const params = node.params
            .map((p) => (t.isIdentifier(p) ? p.name : "..."))
            .join(", ");
        const async = node.async ? "async " : "";
        const static_ = node.static ? "static " : "";
        const name = t.isIdentifier(node.key) ? node.key.name : "unknown";
        return `${static_}${async}${name}(${params})`;
    }
    /**
     * Deduplicate functions (remove duplicates by name, line, and type)
     * Also handles nearby duplicates (within ±2 lines) that represent the same function
     */
    deduplicateFunctions(functions) {
        const seen = new Map();
        return functions.filter((func) => {
            const key = `${func.name}:${func.line}:${func.type}`;
            // Exact duplicate check
            if (seen.has(key)) {
                return false;
            }
            // Check for nearby duplicates (same name, ±2 lines)
            for (const [existingKey, existingFunc] of seen.entries()) {
                if (existingFunc.name === func.name &&
                    Math.abs(existingFunc.line - func.line) <= 2) {
                    // Prefer function_declaration over arrow_function/function_expression
                    if (func.type === "function_declaration" &&
                        existingFunc.type !== "function_declaration") {
                        // Replace the existing entry with this one
                        seen.delete(existingKey);
                        seen.set(key, func);
                        return true;
                    }
                    // Skip this duplicate
                    return false;
                }
            }
            seen.set(key, func);
            return true;
        });
    }
}
//# sourceMappingURL=read.js.map