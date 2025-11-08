/**
 * Shared utilities for AST-based tools
 */
import * as fs from "fs";
import * as path from "path";
import * as parser from "@babel/parser";
/**
 * Detect language from file extension
 */
export function detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const langMap = {
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".mjs": "javascript",
        ".cjs": "javascript",
    };
    return langMap[ext] || "javascript";
}
/**
 * Check if file is a JavaScript/TypeScript file
 */
export function isCodeFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext);
}
/**
 * Check if file is searchable (includes code, docs, configs, etc.)
 */
export function isSearchableFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const searchableExtensions = [
        // JavaScript/TypeScript
        ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
        // Documentation
        ".md", ".mdx", ".txt", ".rst",
        // Configuration files
        ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
        // Web files
        ".html", ".htm", ".xml", ".svg",
        // Style files
        ".css", ".scss", ".sass", ".less",
        // Shell scripts
        ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd",
        // Python
        ".py", ".pyw",
        // Ruby
        ".rb", ".rake",
        // Go
        ".go",
        // Rust
        ".rs",
        // C/C++
        ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx",
        // Java
        ".java",
        // C#
        ".cs",
        // PHP
        ".php",
        // Swift/Objective-C
        ".swift", ".m", ".mm",
        // Kotlin
        ".kt", ".kts",
        // Scala
        ".scala",
        // Vue
        ".vue",
        // Other
        ".sql", ".graphql", ".gql", ".proto"
    ];
    // Also check for files without extensions that are commonly searchable
    const basename = path.basename(filePath);
    const noExtFiles = [
        "Dockerfile", "Makefile", "Rakefile", "Procfile",
        ".gitignore", ".dockerignore", ".eslintrc", ".prettierrc",
        ".babelrc", ".env", ".env.example", ".env.local",
        "LICENSE", "README", "CHANGELOG", "TODO", "AUTHORS"
    ];
    return searchableExtensions.includes(ext) || noExtFiles.includes(basename);
}
/**
 * Parse code with Babel parser
 */
export function parseWithBabel(content, filePath) {
    return parser.parse(content, {
        sourceType: "unambiguous", // Auto-detect: ES6 modules OR CommonJS
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
}
/**
 * Extract JSDoc comment from node
 */
export function extractJSDoc(node) {
    if (!node.leadingComments || node.leadingComments.length === 0) {
        return undefined;
    }
    // Get the last comment before the node
    const lastComment = node.leadingComments[node.leadingComments.length - 1];
    // Check if it's a JSDoc-style block comment
    if (lastComment.type === "CommentBlock" &&
        lastComment.value.startsWith("*")) {
        return `/*${lastComment.value}*/`;
    }
    return undefined;
}
/**
 * Read file content
 */
export function readFileContent(filePath) {
    return fs.readFileSync(filePath, "utf-8");
}
/**
 * Get lines with context around a target line
 */
export function getLinesWithContext(lines, targetLine, contextBefore = 3, contextAfter = 3) {
    const lineIndex = targetLine - 1; // Convert to 0-based
    const startIndex = Math.max(0, lineIndex - contextBefore);
    const endIndex = Math.min(lines.length - 1, lineIndex + contextAfter);
    return {
        before: lines.slice(startIndex, lineIndex),
        line: lines[lineIndex] || "",
        after: lines.slice(lineIndex + 1, endIndex + 1),
        startLine: startIndex + 1,
        endLine: endIndex + 1,
    };
}
/**
 * Recursively find all code files in directory
 */
export function findCodeFiles(dirPath, pattern) {
    const results = [];
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            // Skip node_modules, .git, and other common ignored directories
            if (entry.isDirectory()) {
                const dirName = entry.name;
                if (dirName === "node_modules" ||
                    dirName === ".git" ||
                    dirName === "dist" ||
                    dirName === "build" ||
                    dirName === ".next" ||
                    dirName.startsWith(".")) {
                    continue;
                }
                results.push(...findCodeFiles(fullPath, pattern));
            }
            else if (entry.isFile()) {
                if (isCodeFile(fullPath)) {
                    // Apply glob pattern if provided
                    if (pattern) {
                        const regex = globToRegex(pattern);
                        if (regex.test(fullPath)) {
                            results.push(fullPath);
                        }
                    }
                    else {
                        results.push(fullPath);
                    }
                }
            }
        }
    }
    catch (error) {
        // Skip directories we can't read
    }
    return results;
}
/**
 * Recursively find all searchable files in directory (includes docs, configs, etc.)
 */
export function findSearchableFiles(dirPath, pattern, includeNonCode = false) {
    const results = [];
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            // Skip node_modules, .git, and other common ignored directories
            if (entry.isDirectory()) {
                const dirName = entry.name;
                if (dirName === "node_modules" ||
                    dirName === ".git" ||
                    dirName === "dist" ||
                    dirName === "build" ||
                    dirName === ".next" ||
                    dirName.startsWith(".")) {
                    continue;
                }
                results.push(...findSearchableFiles(fullPath, pattern, includeNonCode));
            }
            else if (entry.isFile()) {
                const shouldInclude = includeNonCode ? isSearchableFile(fullPath) : isCodeFile(fullPath);
                if (shouldInclude) {
                    // Apply glob pattern if provided
                    if (pattern) {
                        const regex = globToRegex(pattern);
                        if (regex.test(fullPath)) {
                            results.push(fullPath);
                        }
                    }
                    else {
                        results.push(fullPath);
                    }
                }
            }
        }
    }
    catch (error) {
        // Skip directories we can't read
    }
    return results;
}
/**
 * Convert glob pattern to RegExp
 * Simple implementation for basic patterns
 */
function globToRegex(pattern) {
    const escaped = pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
    return new RegExp(escaped, "i");
}
/**
 * Get code snippet from content
 */
export function getCodeSnippet(content, startLine, endLine) {
    const lines = content.split("\n");
    return lines.slice(startLine - 1, endLine).join("\n");
}
//# sourceMappingURL=shared.js.map