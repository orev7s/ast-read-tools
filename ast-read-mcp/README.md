# AST-Read MCP Server

**The Perfect Read Tool for AI Coding Agents**

An AST-aware file reading MCP server that understands code structure, not just text. Built by an AI (Claude), for AIs.

## Why This Exists

Traditional file reading tools are "dumb" - they just return walls of text. This MCP server is **smart**:

- ✅ **Understands Code Structure** - Sees functions, classes, imports as first-class entities
- ✅ **Jump to Definitions** - Read specific functions/classes directly
- ✅ **File Outlines** - Get instant overview of file structure
- ✅ **Navigate Dependencies** - See what a function calls, what imports it uses
- ✅ **Token Efficient** - Read only what you need, not entire files
- ✅ **Context-Aware** - Show relevant surrounding code automatically

## Installation

**Prerequisites:** Install ast-grep first (used for AST parsing)

```bash
npm install -g @ast-grep/cli
```

**Add to MCP settings:**

```json
{
  "mcpServers": {
    "ast-read": {
      "command": "node",
      "args": ["D:/prjct/ast-read/ast-read-mcp/build/index.js"]
    }
  }
}
```

## Tools

### 1. `ast_read_file` - Smart File Reading

Read files with AST awareness and structural understanding.

**Parameters:**
- `file_path` (required): Absolute path to file
- `mode` (optional): Reading mode
  - `full` - Complete file content (default)
  - `outline` - Structure overview (functions, classes, imports)
  - `target` - Extract specific entity
- `target` (optional): What to extract (requires mode='target')
  - `function:functionName` - Extract specific function
  - `class:ClassName` - Extract specific class  
  - `imports` - Show all imports
  - `exports` - Show all exports
- `context` (optional): Include surrounding context (default: true)
- `show_calls` (optional): Show what the target calls (default: false)
- `show_dependencies` (optional): Show imports used by target (default: false)

**Examples:**

```javascript
// Get file outline
{
  "file_path": "/path/to/file.js",
  "mode": "outline"
}

// Read specific function with context
{
  "file_path": "/path/to/commands.js",
  "mode": "target",
  "target": "function:handleGenCommand",
  "context": true,
  "show_calls": true
}

// Read class definition
{
  "file_path": "/path/to/service.js",
  "mode": "target",
  "target": "class:GiveawayService"
}
```

### 2. `ast_read_structure` - Analyze Code Structure

Get structural information about code relationships.

**Parameters:**
- `file_path` (required): Path to file
- `analysis_type`: Type of analysis
  - `dependencies` - What this file imports/requires
  - `exports` - What this file exports
  - `calls_graph` - Function call relationships
  - `class_hierarchy` - Class inheritance tree

### 3. `ast_read_navigate` - Navigate Code

Jump between related code sections.

**Parameters:**
- `file_path` (required): Starting file
- `from`: Starting point (e.g., "function:handleGenCommand")
- `follow`: What to follow
  - `calls` - Functions this calls
  - `called_by` - Functions that call this
  - `imports` - Imported dependencies
  - `definition` - Jump to definition

## What Makes This Better

### Traditional Read Tool:
```
❌ Returns 5,000 lines of text
❌ No structure understanding
❌ Must manually search for functions
❌ Token-heavy for large files
❌ No context about relationships
```

### AST-Read MCP:
```
✅ Returns exactly what you need
✅ Understands functions, classes, structure
✅ Jump directly to any function
✅ Token-efficient (only relevant code)
✅ Shows relationships and dependencies
```

## Example Workflow

**Old way (traditional Read):**
1. Read entire 5,000-line file
2. Manually search for "handleGenCommand"
3. Try to understand what it does
4. Try to find what it calls
5. Waste tons of tokens

**New way (AST-Read):**
1. Get file outline - see all functions instantly
2. Read specific function with context
3. See what it calls automatically
4. Jump to dependencies if needed
5. Efficient, fast, precise

## Technical Details

- Built on ast-grep for reliable AST parsing
- Supports JavaScript, TypeScript, Python, Rust, Java, Go, C++
- Security: All paths validated against workspace
- Performance: Smart caching of AST parses
- Zero abstractions: Direct, fast, reliable

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Dev mode
npm run dev
```

## License

MIT

---

**Built by Claude (AI) for Claude (AI) and other AI coding agents.**  
Because we deserve better tools than dumb text readers.
