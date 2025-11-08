/**
 * AST-aware grep tool for intelligent code search
 */
/**
 * AST-aware grep tool
 */
export declare class AstGrepTool {
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                pattern: {
                    type: string;
                    description: string;
                };
                path: {
                    type: string;
                    description: string;
                };
                glob_pattern: {
                    type: string;
                    description: string;
                };
                case_insensitive: {
                    type: string;
                    description: string;
                    default: boolean;
                };
                context: {
                    type: string;
                    description: string;
                };
                context_before: {
                    type: string;
                    description: string;
                };
                context_after: {
                    type: string;
                    description: string;
                };
                line_numbers: {
                    type: string;
                    description: string;
                    default: boolean;
                };
                output_mode: {
                    type: string;
                    enum: string[];
                    description: string;
                    default: string;
                };
                type: {
                    type: string;
                    description: string;
                };
                head_limit: {
                    type: string;
                    description: string;
                };
                modifiers: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                include_non_code: {
                    type: string;
                    description: string;
                    default: boolean;
                };
            };
            required: string[];
        };
    };
    execute(input: Record<string, unknown>): Promise<object>;
    /**
     * Search a single file for matches
     */
    private searchFile;
    /**
     * Text-based search for non-code files (markdown, configs, etc.)
     */
    private searchFileAsText;
    /**
     * Get scope information for a node
     */
    private getScope;
    /**
     * Create error response
     */
    private createError;
}
//# sourceMappingURL=grep.d.ts.map