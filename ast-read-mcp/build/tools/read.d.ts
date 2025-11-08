/**
 * AST-Read Tool - FIXED VERSION
 */
export declare class AstReadTool {
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                file_path: {
                    type: string;
                    description: string;
                };
                mode: {
                    type: string;
                    enum: string[];
                    description: string;
                    default: string;
                };
                target: {
                    type: string;
                    description: string;
                };
                context: {
                    type: string;
                    description: string;
                    default: boolean;
                };
            };
            required: string[];
        };
    };
    execute(input: Record<string, unknown>): Promise<any>;
    /**
     * Create error response (NO MORE SILENT FAILURES!)
     */
    private createError;
    /**
     * Get helpful hint for common errors
     */
    private getHelpfulHint;
    /**
     * Read full file
     */
    private readFull;
    /**
     * Read specific line range
     */
    private readLines;
    /**
     * Read file outline using Babel parser
     */
    private readOutline;
    /**
     * Read specific target (function, class, method, etc.)
     */
    private readTarget;
    /**
     * Get function signature string
     */
    private getFunctionSignature;
    /**
     * Get method signature string
     */
    private getMethodSignature;
    /**
     * Deduplicate functions (remove duplicates by name, line, and type)
     * Also handles nearby duplicates (within ±2 lines) that represent the same function
     */
    private deduplicateFunctions;
}
//# sourceMappingURL=read.d.ts.map