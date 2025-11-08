# AST-Read MCP - Usage Examples

## Quick Start

Add to your `~/.factory/mcp.json`:

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

## Example 1: Get File Outline

**Before (Traditional Read):**
```
Read entire 5,000-line file → manually search for functions → waste tokens
```

**After (AST-Read):**
```json
{
  "tool": "ast_read_file",
  "arguments": {
    "file_path": "D:/prjct/botmanifest/handlers/commands.js",
    "mode": "outline"
  }
}
```

**Returns:**
```json
{
  "mode": "outline",
  "file_path": "...",
  "language": "javascript",
  "structure": {
    "functions": [
      { "name": "handleGenCommand", "line": 1391, "text": "async handleGenCommand(interaction) { ... }" },
      { "name": "handleSearchCommand", "line": 2140, "text": "async handleSearchCommand(interaction) { ... }" },
      { "name": "handleGiveawayCommand", "line": 9095, "text": "async handleGiveawayCommand(interaction) { ... }" }
    ],
    "classes": [
      { "name": "CommandHandlers", "line": 21, "text": "class CommandHandlers { ... }" }
    ],
    "imports": [
      "const FileManager = require('../services/fileManager')",
      "const GitHubService = require('../services/github')"
    ]
  }
}
```

**Result:** Instant overview of file structure! 🚀

---

## Example 2: Read Specific Function

**Task:** "I need to see the handleGenCommand function"

**Before (Traditional Read):**
1. Read entire file (5,000+ lines)
2. Search manually for "handleGenCommand"
3. Try to understand context
4. Scroll to find what it calls

**After (AST-Read):**
```json
{
  "tool": "ast_read_file",
  "arguments": {
    "file_path": "D:/prjct/botmanifest/handlers/commands.js",
    "mode": "target",
    "target": "function:handleGenCommand",
    "context": true,
    "show_calls": true
  }
}
```

**Returns:**
```json
{
  "mode": "target",
  "target_type": "function",
  "target_name": "handleGenCommand",
  "line": 1391,
  "code": "async handleGenCommand(interaction) {\n  // Full function code here\n}",
  "context_before": "// Lines before the function",
  "context_after": "// Lines after the function"
}
```

**Result:** Exactly what you need, with context! No wasted tokens! ✅

---

## Example 3: Read Class Definition

```json
{
  "tool": "ast_read_file",
  "arguments": {
    "file_path": "D:/prjct/botmanifest/services/giveawayService.js",
    "mode": "target",
    "target": "class:GiveawayService"
  }
}
```

**Returns the complete class definition with all methods.**

---

## Example 4: See Just Imports

```json
{
  "tool": "ast_read_file",
  "arguments": {
    "file_path": "D:/prjct/botmanifest/handlers/commands.js",
    "mode": "target",
    "target": "imports"
  }
}
```

**Returns:**
```json
{
  "mode": "target",
  "target_type": "imports",
  "imports": [
    "const FileManager = require('../services/fileManager')",
    "const GitHubService = require('../services/github')",
    "const SteamService = require('../services/steam')",
    ...
  ]
}
```

**Perfect for understanding dependencies!**

---

## Real-World Workflow

### Scenario: "Update all giveaway service calls"

**Old Way (Traditional Read + Grep):**
1. Grep for "giveaway" → 667 results (mixed with docs/comments)
2. Read multiple files entirely
3. Manually filter actual code
4. Risk missing some usages
5. **Time:** 10+ minutes, **Tokens:** 50,000+

**New Way (AST-Read + ast-grep):**
1. **Use ast-grep to find calls:** `$OBJ.giveawayService.$METHOD($$$ARGS)` → 9 exact matches
2. **Use ast-read to understand each:**
   ```json
   {
     "file_path": "handlers/commands.js",
     "mode": "target",
     "target": "function:handleGiveawayCommand",
     "context": true
   }
   ```
3. **See structure, make changes confidently**
4. **Time:** 2 minutes, **Tokens:** 5,000

**Result:** 5x faster, 10x fewer tokens, 100% confidence! 🔥

---

## Token Comparison

| Task | Traditional Read | AST-Read | Savings |
|------|-----------------|----------|---------|
| Find function in 5,000-line file | 5,000 lines × 4 tokens = 20,000 tokens | Function + context = 200 tokens | **99% saved** |
| Get file structure | Read entire file = 20,000 tokens | Outline = 500 tokens | **97.5% saved** |
| Understand imports | Read + manually parse = 20,000 tokens | Direct extraction = 100 tokens | **99.5% saved** |

---

## When to Use Each Mode

### `mode: "full"`
- When you actually need the entire file
- Small files (< 500 lines)
- First-time file exploration

### `mode: "outline"`
- **Use this first!** Get instant file overview
- Large files (> 1,000 lines)
- Understanding file structure
- Planning what to read next

### `mode: "target"`
- **Most common!** Read specific functions/classes
- Understanding specific code sections
- Editing specific functions
- Following code flow

---

## Pro Tips

1. **Always start with outline** - Get the big picture first
2. **Use target mode** - Only read what you need
3. **Enable context** - Understand surrounding code
4. **Combine with ast-grep** - Find exact patterns, then read with AST-Read
5. **Save tokens** - Never read entire files unless necessary

---

## Comparison: The Same Task

### Traditional Approach:
```
User: "Show me the handleGenCommand function"
AI: *reads entire 5,000-line file*
AI: *searches manually for function*
AI: *tries to extract relevant code*
AI: *uses 20,000+ tokens*
```

### AST-Read Approach:
```
User: "Show me the handleGenCommand function"  
AI: Uses ast_read_file with target="function:handleGenCommand"
AI: Gets exact function with context in 200 tokens
AI: **Done in 1 second** ✅
```

---

**Built by Claude for AIs who deserve better tools.**
