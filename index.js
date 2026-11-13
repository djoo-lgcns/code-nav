#!/usr/bin/env node
import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/index.ts
import { spawnSync } from "child_process";
import * as readline from "readline";
var IGNORE_PATTERNS = [
  /(^|[/\\])(node_modules|build|dist|target|\.git|\.gradle|__pycache__|\.venv|venv|\.pytest_cache)($|[/\\])/i
];
function isIgnoredPath(filePath) {
  return IGNORE_PATTERNS.some((pat) => pat.test(filePath));
}
function runAstGrepRule(yamlRule, targetPath = ".") {
  const res = spawnSync("ast-grep", ["scan", "--inline-rules", yamlRule, "--json", targetPath], {
    encoding: "utf-8",
    maxBuffer: 30 * 1024 * 1024
  });
  if (res.error) {
    if (res.error.code === "ENOENT") {
      throw new Error("'ast-grep' binary is not found in PATH. Please install it to use code-nav: 'npm install -g @ast-grep/cli' or 'winget install ast-grep.ast-grep' (Windows) or 'brew install ast-grep' (macOS).");
    }
    throw res.error;
  }
  if (!res.stdout)
    return [];
  try {
    const list = JSON.parse(res.stdout);
    if (!Array.isArray(list))
      return [];
    return list.map((item) => {
      const firstLine = (item.lines || item.text || "").split(`
`)[0].trim();
      return {
        file: item.file,
        line: (item.range?.start?.line ?? 0) + 1,
        kind: item.ruleId || "Symbol",
        signature: firstLine.length > 120 ? firstLine.slice(0, 117) + "..." : firstLine
      };
    });
  } catch {
    return [];
  }
}
function runAstGrepOutline(targetPath = ".") {
  const res = spawnSync("ast-grep", ["outline", "--items", "structure", "--view", "expanded", "--json", targetPath], {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024
  });
  if (res.error) {
    if (res.error.code === "ENOENT") {
      throw new Error("'ast-grep' binary is not found in PATH. Please install it to use code-nav: 'npm install -g @ast-grep/cli' or 'winget install ast-grep.ast-grep' (Windows) or 'brew install ast-grep' (macOS).");
    }
    throw res.error;
  }
  if (!res.stdout)
    return [];
  try {
    const list = JSON.parse(res.stdout);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function findDefinitions(symbol, targetPath = ".") {
  const outlineResults = runAstGrepOutline(targetPath);
  const matches = [];
  const seen = new Set;
  for (const fileResult of outlineResults) {
    if (isIgnoredPath(fileResult.path))
      continue;
    const checkItem = (item, parentName) => {
      const isMatch = item.name === symbol || (parentName ? `${parentName}.${item.name}` === symbol : false);
      if (isMatch) {
        const line = (item.range?.start?.line ?? 0) + 1;
        const key = `${fileResult.path}:${line}`;
        if (!seen.has(key)) {
          seen.add(key);
          const rawSig = item.signature || (parentName ? `${parentName}.${item.name}` : item.name);
          const firstLine = rawSig.split(`
`)[0].trim();
          matches.push({
            file: fileResult.path,
            line,
            kind: item.symbolType || item.astKind || "Symbol",
            signature: firstLine.length > 120 ? firstLine.slice(0, 117) + "..." : firstLine
          });
        }
      }
      if (item.members && Array.isArray(item.members)) {
        for (const member of item.members) {
          checkItem(member, item.name);
        }
      }
    };
    for (const item of fileResult.items || []) {
      checkItem(item);
    }
  }
  matches.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return matches;
}
function findReferences(symbol, targetPath = ".") {
  const javaRule = `
id: JavaRef
language: java
rule:
  any:
    - pattern: "$OBJ.${symbol}($$$)"
    - pattern: "${symbol}($$$)"
    - pattern: "new ${symbol}($$$)"
`;
  const tsRule = `
id: TSRef
language: ts
rule:
  any:
    - pattern: "$OBJ.${symbol}($$$)"
    - pattern: "${symbol}($$$)"
    - pattern: "new ${symbol}($$$)"
`;
  const pythonRule = `
id: PyRef
language: python
rule:
  any:
    - pattern: "$OBJ.${symbol}($$$)"
    - pattern: "${symbol}($$$)"
`;
  const results = [
    ...runAstGrepRule(javaRule, targetPath),
    ...runAstGrepRule(tsRule, targetPath),
    ...runAstGrepRule(pythonRule, targetPath)
  ];
  const seen = new Set;
  return results.filter((r) => {
    if (isIgnoredPath(r.file))
      return false;
    const key = `${r.file}:${r.line}`;
    if (seen.has(key))
      return false;
    seen.add(key);
    return true;
  });
}
function outlineFile(filePath) {
  const fileResults = runAstGrepOutline(filePath);
  const results = [];
  for (const fileResult of fileResults) {
    const collectItems = (item, depth = 0) => {
      const line = (item.range?.start?.line ?? 0) + 1;
      const rawSig = item.signature || `${item.symbolType} ${item.name}`;
      const firstLine = rawSig.split(`
`)[0].trim();
      const indent = "  ".repeat(depth);
      const prefix = depth > 0 ? `${indent}└─ ` : "";
      results.push({
        file: fileResult.path,
        line,
        kind: item.symbolType || item.astKind || "Symbol",
        signature: `${prefix}[${item.symbolType}] ${firstLine}`
      });
      if (item.members && Array.isArray(item.members)) {
        for (const member of item.members) {
          collectItems(member, depth + 1);
        }
      }
    };
    for (const item of fileResult.items || []) {
      collectItems(item);
    }
  }
  results.sort((a, b) => a.line - b.line);
  return results;
}
function generateRepoMap(targetPath = ".") {
  const fileResults = runAstGrepOutline(targetPath);
  const map = new Map;
  for (const fileResult of fileResults) {
    if (isIgnoredPath(fileResult.path))
      continue;
    const items = [];
    for (const item of fileResult.items || []) {
      const line = (item.range?.start?.line ?? 0) + 1;
      const rawSig = item.signature || `${item.symbolType} ${item.name}`;
      const firstLine = rawSig.split(`
`)[0].trim();
      items.push(`L${line}: [${item.symbolType}] ${firstLine}`);
    }
    if (items.length > 0) {
      map.set(fileResult.path, items);
    }
  }
  return map;
}
function runMcpServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });
  const sendMcp = (response) => {
    process.stdout.write(JSON.stringify(response) + `
`);
  };
  rl.on("line", (line) => {
    if (!line.trim())
      return;
    try {
      const req = JSON.parse(line);
      const { id, method, params } = req;
      if (method === "initialize") {
        sendMcp({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "code-nav-mcp", version: "1.0.0" }
          }
        });
        return;
      }
      if (method === "notifications/initialized")
        return;
      if (method === "tools/list") {
        sendMcp({
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "code_nav_def",
                description: "CRITICAL: Always use this tool FIRST instead of grep when finding where a class, interface, function, or method is declared. Eliminates comment, variable, and import noise using AST.",
                inputSchema: {
                  type: "object",
                  properties: {
                    symbol: { type: "string", description: "Symbol name to find definition for (e.g. MemberContext, cancel)" },
                    path: { type: "string", description: "Optional directory or file path to scope the search" }
                  },
                  required: ["symbol"]
                }
              },
              {
                name: "code_nav_refs",
                description: "Find call sites, method invocations, and new instantiations for a symbol across the codebase.",
                inputSchema: {
                  type: "object",
                  properties: {
                    symbol: { type: "string", description: "Symbol name to find references for" },
                    path: { type: "string", description: "Optional directory or file path" }
                  },
                  required: ["symbol"]
                }
              },
              {
                name: "code_nav_outline",
                description: "Inspect the structure and line numbers of all symbols in a file without reading the entire content. Use before read_file to avoid token waste.",
                inputSchema: {
                  type: "object",
                  properties: {
                    filePath: { type: "string", description: "Path to the file to outline" }
                  },
                  required: ["filePath"]
                }
              },
              {
                name: "code_nav_repomap",
                description: "Generate a compact high-level summary map of primary classes and interfaces across the directory.",
                inputSchema: {
                  type: "object",
                  properties: {
                    path: { type: "string", description: "Target directory (default: '.')" }
                  }
                }
              }
            ]
          }
        });
        return;
      }
      if (method === "tools/call") {
        const { name, arguments: toolArgs } = params;
        try {
          if (name === "code_nav_def") {
            const defs = findDefinitions(toolArgs.symbol, toolArgs.path || ".");
            const formatted = defs.map((d) => `${d.file}:${d.line} -> ${d.signature}`).join(`
`);
            sendMcp({
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: formatted || `No definition found for '${toolArgs.symbol}'` }]
              }
            });
            return;
          }
          if (name === "code_nav_refs") {
            const refs = findReferences(toolArgs.symbol, toolArgs.path || ".");
            const formatted = refs.map((r) => `${r.file}:${r.line} -> ${r.signature}`).join(`
`);
            sendMcp({
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: formatted || `No references found for '${toolArgs.symbol}'` }]
              }
            });
            return;
          }
          if (name === "code_nav_outline") {
            const outline = outlineFile(toolArgs.filePath);
            const formatted = outline.map((o) => `Line ${String(o.line).padStart(4)}: ${o.signature}`).join(`
`);
            sendMcp({
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: formatted || `No outline symbols found in '${toolArgs.filePath}'` }]
              }
            });
            return;
          }
          if (name === "code_nav_repomap") {
            const map = generateRepoMap(toolArgs.path || ".");
            let text = `Repo Map (${map.size} files):
`;
            for (const [file, items] of map.entries()) {
              text += `
\uD83D\uDCC1 ${file}
` + items.map((i) => `   └─ ${i}`).join(`
`);
            }
            sendMcp({
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text }]
              }
            });
            return;
          }
          sendMcp({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Tool not found: ${name}` }
          });
          return;
        } catch (err) {
          sendMcp({
            jsonrpc: "2.0",
            id,
            result: {
              isError: true,
              content: [{ type: "text", text: `[code-nav Error] ${err.message}` }]
            }
          });
          return;
        }
      }
      sendMcp({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      });
    } catch {}
  });
}
if (__require.main == __require.module || process.argv[1]?.endsWith("index.js")) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  try {
    if (!cmd || cmd === "--mcp") {
      runMcpServer();
    } else if (cmd === "def") {
      const symbol = args[1];
      if (!symbol) {
        console.log("Usage: code-nav def <symbol> [path]");
        process.exit(1);
      }
      const defs = findDefinitions(symbol, args[2] || ".");
      console.log(`
=== [DEFINITIONS] '${symbol}' (${defs.length} matches) ===`);
      for (const d of defs) {
        console.log(`  ${d.file}:${d.line}  ->  ${d.signature}`);
      }
    } else if (cmd === "refs") {
      const symbol = args[1];
      if (!symbol) {
        console.log("Usage: code-nav refs <symbol> [path]");
        process.exit(1);
      }
      const refs = findReferences(symbol, args[2] || ".");
      console.log(`
=== [REFERENCES/CALLS] '${symbol}' (${refs.length} matches) ===`);
      for (const r of refs) {
        console.log(`  ${r.file}:${r.line}  ->  ${r.signature}`);
      }
    } else if (cmd === "outline") {
      const filePath = args[1];
      if (!filePath) {
        console.log("Usage: code-nav outline <filePath>");
        process.exit(1);
      }
      const outline = outlineFile(filePath);
      console.log(`
=== [OUTLINE] ${filePath} (${outline.length} symbols) ===`);
      for (const o of outline) {
        console.log(`  Line ${String(o.line).padStart(4)}: ${o.signature}`);
      }
    } else if (cmd === "repomap") {
      const map = generateRepoMap(args[1] || ".");
      console.log(`
=== [REPO MAP] Found ${map.size} files with primary declarations ===
`);
      for (const [file, items] of map.entries()) {
        console.log(`\uD83D\uDCC1 ${file}`);
        for (const item of items) {
          console.log(`    └─ ${item}`);
        }
      }
    } else if (cmd === "--version" || cmd === "-v") {
      console.log("code-nav 1.0.0 (AST-Powered MCP Server)");
    } else {
      console.log(`
CodeNav v1.0.0 - AST-Powered Code Navigation MCP Server
GitHub: https://github.com/djoo-lgcns/code-nav

Usage:
  npx -y github:djoo-lgcns/code-nav              Run as MCP Stdio Server (Default)
  npx -y github:djoo-lgcns/code-nav def <symbol> Find symbol declaration
  npx -y github:djoo-lgcns/code-nav outline <f>  Outline file symbols
`);
    }
  } catch (err) {
    console.error(`
❌ [code-nav Error] ${err.message}
`);
    process.exit(1);
  }
}
export {
  findDefinitions,
  findReferences,
  generateRepoMap,
  outlineFile
};
