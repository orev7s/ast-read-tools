# Lines Mode - Usage Examples

## 🎯 New Feature: Line-Based Reading

The `lines` mode allows you to read a specific line number with configurable context lines above and below it. Perfect for precision code inspection!

---

## 📖 Basic Usage

### Example 1: Read line 745 with default context (10 lines above/below)

```javascript
{
  mode: "lines",
  file_path: "D:/prjct/ast-read/ast-read-mcp/src/tools/read.ts",
  line: 745
}
```

**Returns:**
```json
{
  "success": true,
  "mode": "lines",
  "file_path": "D:/prjct/ast-read/ast-read-mcp/src/tools/read.ts",
  "target_line": 745,
  "start_line": 735,
  "end_line": 755,
  "total_lines": 944,
  "lines_above": 10,
  "lines_below": 10,
  "content": "... 21 lines of code ..."
}
```

---

### Example 2: Read line 745 with 45 lines above and 45 lines below

```javascript
{
  mode: "lines",
  file_path: "D:/prjct/ast-read/ast-read-mcp/src/tools/read.ts",
  line: 745,
  linesAbove: 45,
  linesBelow: 45
}
```

**Returns:**
```json
{
  "success": true,
  "mode": "lines",
  "file_path": "D:/prjct/ast-read/ast-read-mcp/src/tools/read.ts",
  "target_line": 745,
  "start_line": 700,
  "end_line": 790,
  "total_lines": 944,
  "lines_above": 45,
  "lines_below": 45,
  "content": "... 91 lines of code ..."
}
```

---

### Example 3: Read with asymmetric context (5 above, 20 below)

```javascript
{
  mode: "lines",
  file_path: "D:/prjct/bot/client.js",
  line: 150,
  linesAbove: 5,
  linesBelow: 20
}
```

**Use Case:** When you want to see more of what comes AFTER a line (like a function body)

---

### Example 4: Minimal context (2 lines above/below)

```javascript
{
  mode: "lines",
  file_path: "D:/prjct/config.js",
  line: 42,
  linesAbove: 2,
  linesBelow: 2
}
```

**Use Case:** Quick peek at a specific line without much surrounding context

---

### Example 5: Maximum context (100 lines each direction)

```javascript
{
  mode: "lines",
  file_path: "D:/prjct/app.js",
  line: 500,
  linesAbove: 100,
  linesBelow: 100
}
```

**Use Case:** Deep inspection of a critical section

---

## 🎨 Verbose Mode Integration

### With verbose: false (User-friendly summary)

```javascript
{
  mode: "lines",
  file_path: "D:/prjct/bot/commands.js",
  line: 1393,
  linesAbove: 20,
  linesBelow: 20,
  verbose: false
}
```

**User sees:**
```
✅ Showing line 1393 (1373-1413 of 9395 total lines)
```

**AI receives:**
```json
{
  "success": true,
  "mode": "lines",
  "target_line": 1393,
  "start_line": 1373,
  "end_line": 1413,
  "total_lines": 9395,
  "lines_above": 20,
  "lines_below": 20,
  "content": "... full code here ...",
  "summary": "✅ Showing line 1393 (1373-1413 of 9395 total lines)"
}
```

---

## 🚀 Advanced Use Cases

### Use Case 1: Combined with Outline Mode

**Step 1:** Get file structure
```javascript
{ mode: "outline", file_path: "bot/client.js" }
```

**Response shows:** `initializeBot` method is at line 245

**Step 2:** Read that method with context
```javascript
{
  mode: "lines",
  file_path: "bot/client.js",
  line: 245,
  linesAbove: 30,
  linesBelow: 50
}
```

**Perfect workflow!** 🎯

---

### Use Case 2: Error Location Inspection

```javascript
// Error: Syntax error at line 1872
{
  mode: "lines",
  file_path: "src/parser.js",
  line: 1872,
  linesAbove: 10,
  linesBelow: 10
}
```

---

### Use Case 3: Edge Cases (File boundaries)

**Reading near start of file:**
```javascript
{
  mode: "lines",
  file_path: "index.js",
  line: 5,
  linesAbove: 100  // Will automatically cap at line 1
}
```

**Returns:** Lines 1-15 (capped at file start)

**Reading near end of file:**
```javascript
{
  mode: "lines",
  file_path: "app.js",
  line: 990,
  linesAbove: 10,
  linesBelow: 100  // Will automatically cap at last line
}
```

**Returns:** Lines 980-1000 (capped at file end)

---

## ⚠️ Error Handling

### Error: Line out of range

```javascript
{
  mode: "lines",
  file_path: "small.js",
  line: 9999  // File only has 150 lines
}
```

**Response:**
```json
{
  "success": false,
  "error": "Line 9999 out of range (file has 150 lines)",
  "error_type": "LINE_OUT_OF_RANGE",
  "file_path": "small.js",
  "mode": "lines"
}
```

---

### Error: Missing line parameter

```javascript
{
  mode: "lines",
  file_path: "app.js"
  // Forgot to specify line!
}
```

**Response:**
```json
{
  "success": false,
  "error": "line parameter required when mode='lines'",
  "error_type": "MISSING_LINE"
}
```

---

## 📋 Parameter Reference

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `mode` | string | ✅ Yes | - | Must be `"lines"` |
| `file_path` | string | ✅ Yes | - | Absolute path to file |
| `line` | number | ✅ Yes | - | Target line number (1-based) |
| `linesAbove` | number | ❌ No | 10 | Lines to show above target |
| `linesBelow` | number | ❌ No | 10 | Lines to show below target |
| `verbose` | boolean | ❌ No | true | Show full output or summary |

---

## 🎯 Response Structure

```typescript
interface LinesResponse {
  success: true;
  mode: "lines";
  file_path: string;
  target_line: number;        // The line you requested
  start_line: number;         // First line returned
  end_line: number;           // Last line returned
  total_lines: number;        // Total lines in file
  lines_above: number;        // Actual lines shown above
  lines_below: number;        // Actual lines shown below
  content: string;            // The extracted code
  summary?: string;           // If verbose: false
}
```

---

## 💡 Tips & Best Practices

### ✅ DO:
- Use `outline` mode first to find line numbers
- Adjust context based on what you need to see
- Use `verbose: false` for user-friendly summaries
- Use symmetric context (same above/below) for balanced view
- Use asymmetric context when you need more before or after

### ❌ DON'T:
- Request massive ranges (500+ lines each direction) - use `full` mode instead
- Forget to validate line numbers before requesting
- Use `lines` mode for reading entire functions - use `target` mode instead

---

## 🔄 Comparison with Other Modes

| Mode | Best For | Line Numbers | Context Control |
|------|----------|--------------|-----------------|
| **full** | Reading entire file | ❌ No | ❌ All or nothing |
| **outline** | File structure | ✅ Yes | ❌ Structure only |
| **target** | Specific functions/classes | ✅ Yes (in response) | ⚠️ Fixed (contextLines) |
| **lines** ⭐ | Precise line inspection | ✅ Yes (required) | ✅ Full control |

---

## 🚀 Real-World Example

**Scenario:** AI agent debugging an error at line 1393 in a 9,395-line file

```javascript
// Step 1: Quick peek at error location
{
  mode: "lines",
  file_path: "handlers/commands.js",
  line: 1393,
  linesAbove: 5,
  linesBelow: 5,
  verbose: false
}

// User sees: ✅ Showing line 1393 (1388-1398 of 9395 total lines)
// AI sees: 11 lines of code

// Step 2: Need more context? Expand!
{
  mode: "lines",
  file_path: "handlers/commands.js",
  line: 1393,
  linesAbove: 30,
  linesBelow: 50
}

// Now AI sees 81 lines - the entire function!
```

**Result:** Efficient, precise debugging without loading 9,395 lines! 🎉

---

## 📚 Feature Highlights

✅ **Precise targeting** - Read exactly what you need  
✅ **Flexible context** - Asymmetric ranges supported  
✅ **Smart boundaries** - Auto-caps at file start/end  
✅ **Verbose support** - User-friendly summaries  
✅ **Fast** - No AST parsing overhead  
✅ **Simple** - Easy to use with clear errors  

---

**Added:** 2025-11-07  
**Version:** 1.1.0  
**Status:** ✅ Production Ready
