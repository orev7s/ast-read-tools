#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AstReadTool } from "./tools/read.js";
import { AstGrepTool } from "./tools/grep.js";

/**
 * AST-Read MCP Server
 * 
 * An intelligent file reading and searching server that understands code structure.
 * Built by Claude (AI) for AI coding agents.
 */
async function main(): Promise<void> {
  try {
    // Create MCP server
    const server = new Server(
      {
        name: "ast-read-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize tools
    const readTool = new AstReadTool();
    const grepTool = new AstGrepTool();

    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [AstReadTool.getSchema(), AstGrepTool.getSchema()],
      };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "ast_read_file": {
            const result = await readTool.execute(
              args as Record<string, unknown>
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "ast_grep": {
            const result = await grepTool.execute(
              args as Record<string, unknown>
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("AST-Read MCP Server started successfully (ast_read_file, ast_grep)");
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.error("Shutting down AST-Read MCP server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("Shutting down AST-Read MCP server...");
  process.exit(0);
});

// Start
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
