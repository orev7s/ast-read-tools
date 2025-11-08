# Verbose Mode Limitation & Factory CLI Feature Request

## 🚨 Current Issue

**Problem:** The `verbose: false` flag in ast-read (and other MCP tools) does NOT hide JSON output from the terminal.

**What Happens:**
```
User sets: { mode: "outline", verbose: false }

Expected in Terminal:
✅ File analyzed: 0 functions, 1 class, 4 imports, 0 exports

Actual in Terminal:
[FULL JSON OUTPUT - 50+ lines]
...
"summary": "✅ File analyzed: 0 functions, 1 class, 4 imports, 0 exports"
```

**Root Cause:** The Factory CLI controls what you see in the terminal, NOT the MCP server. The MCP server correctly adds the `summary` field, but the CLI still prints the entire JSON response.

---

## ✅ What the MCP Server Does (CORRECT)

The ast-read server correctly implements verbose mode:

1. **When `verbose: true` (default):**
   - Returns full JSON with all data
   - No summary field

2. **When `verbose: false`:**
   - Returns full JSON with all data (for AI)
   - ADDS a `summary` field (for terminal display)

**The server is working correctly!** The issue is that the CLI doesn't know to only show the summary.

---

## 🛠️ What Needs to Happen (Factory CLI Team)

The Factory CLI needs to be updated with these features:

### Feature 1: MCP Output Mode

Add to `settings.json`:
```json
{
  "mcpOutputMode": "summary",  // or "full"
  "description": "When 'summary', only show summary field from MCP responses in terminal"
}
```

**Implementation in CLI:**
```javascript
// Pseudo-code for Factory CLI
function displayMCPResult(response) {
  if (settings.mcpOutputMode === "summary" && response.summary) {
    // Only show summary to user
    console.log(response.summary);
  } else {
    // Show full JSON
    console.log(JSON.stringify(response, null, 2));
  }
  
  // ALWAYS pass full response to AI (unchanged)
  return response;
}
```

### Feature 2: Force Verbose Flag

Add to `settings.json`:
```json
{
  "mcpForceVerbose": false,  // or true
  "description": "When true, always show full MCP output regardless of server's verbose setting"
}
```

Or add to `mcp.json` per-server:
```json
{
  "mcpServers": {
    "ast-read": {
      "command": "node",
      "args": ["..."],
      "forceVerbose": true  // Always show full output for this tool
    }
  }
}
```

---

## 📋 Decision Logic (Proposed)

```
┌─────────────────────────────────────────────────────────────┐
│ Factory CLI MCP Output Display Logic                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Check settings.mcpForceVerbose                          │
│    ├─ true → Show full JSON (ignore server's verbose flag) │
│    └─ false → Continue to step 2                           │
│                                                             │
│ 2. Check response.summary exists                           │
│    ├─ exists → Show ONLY summary (concise)                 │
│    └─ not exists → Show full JSON                          │
│                                                             │
│ 3. ALWAYS pass full response to AI (no filtering)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Example: How It Should Work

### Scenario 1: User wants concise output

**settings.json:**
```json
{
  "mcpOutputMode": "summary",
  "mcpForceVerbose": false
}
```

**AI calls:**
```javascript
ast_read_file({ mode: "outline", file_path: "app.js", verbose: false })
```

**Terminal shows:**
```
✅ File analyzed: 45 functions, 3 classes, 18 imports, 5 exports
```

**AI receives:**
```json
{
  "success": true,
  "mode": "outline",
  "structure": { ... },  // Full data
  "stats": { ... },
  "summary": "✅ File analyzed: 45 functions, 3 classes, 18 imports, 5 exports"
}
```

---

### Scenario 2: User debugging, wants full output

**settings.json:**
```json
{
  "mcpForceVerbose": true
}
```

**Terminal shows:**
```json
{
  "success": true,
  "mode": "outline",
  "structure": {
    "functions": [ ... ],  // Full JSON visible
    "classes": [ ... ]
  },
  "stats": { ... },
  "summary": "✅ File analyzed: 45 functions..."
}
```

**AI receives:** Same full data

---

## 🚧 Current Workaround (NONE)

**Unfortunately, there is NO workaround** from the MCP server side. This must be implemented in the Factory CLI.

**What DOESN'T work:**
- ❌ Server returning partial data → AI wouldn't get full data
- ❌ Using ANSI escape codes → CLI-dependent, unreliable
- ❌ Encoding/hiding data → Breaks MCP protocol
- ❌ Separate response channels → Not supported by MCP

**The ONLY solution is Factory CLI implementation.**

---

## 📝 Summary for Factory Team

### Request: Implement MCP Output Mode Control

**Priority:** Medium (Quality of Life improvement)

**Impact:** 
- Reduces terminal spam for AI agents using MCP tools
- Better user experience during long AI sessions
- Maintains full data flow to AI (no functionality loss)

**Implementation Effort:** ~2-4 hours
- Add settings to settings.json
- Modify MCP response display logic
- Test with existing MCP servers

**Benefits:**
- ✅ Cleaner terminal output
- ✅ User control over verbosity
- ✅ Works with ALL MCP tools that implement summary field
- ✅ Backward compatible (default: show full output)

---

## 🔗 Related MCP Tools

This feature would benefit ALL MCP tools that return large JSON responses:

1. **ast-read** - File analysis (this tool)
2. **tree-ast-grep** - Code search results
3. **context7** - Documentation search
4. **Any custom MCP servers** users create

---

## 📞 Contact

**Issue Created:** 2025-11-07  
**Reported By:** User v80q  
**MCP Server:** ast-read-mcp (but applies to all MCP tools)  
**Status:** Awaiting Factory CLI implementation

---

## ✅ Checklist for Factory Team

- [ ] Add `mcpOutputMode` setting to settings.json schema
- [ ] Add `mcpForceVerbose` setting to settings.json schema
- [ ] Implement display logic in MCP response handler
- [ ] Test with ast-read server (has summary field)
- [ ] Test with existing MCP servers (backward compatible)
- [ ] Document in Factory CLI docs
- [ ] Release in next minor version

---

**In the meantime, users will see full JSON output in terminal.** The AI will continue to work perfectly with the data, but terminal output will be verbose.

**Server-side implementation is COMPLETE and CORRECT.** Waiting on CLI-side feature.
