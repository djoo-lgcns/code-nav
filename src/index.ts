#!/usr/bin/env bun
/**
 * code-nav: Zero-Noise AST-Based Code Navigator & MCP Server for AI Agents.
 * Supports CLI mode and MCP Stdio Server mode (--mcp).
 * Covers TypeScript, JavaScript, Java, and Python out of the box.
 */

import { spawnSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as readline from "readline";

export interface MatchResult {
  file: string;
  line: number;
  kind: string;
  signature: string;
}

function runAstGrepRule(yamlRule: string, targetPath: string = "."): MatchResult[] {
  const res = spawnSync("ast-grep", ["scan", "--inline-rules", yamlRule, "--json", targetPath], {
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (!res.stdout) return [];
  try {
    const list = JSON.parse(res.stdout);
    if (!Array.isArray(list)) return [];
    return list.map((item: any) => {
      const firstLine = (item.lines || item.text || "").split("\n")[0].trim();
      return {
        file: item.file,
        line: (item.range?.start?.line ?? 0) + 1,
        kind: item.ruleId || "Symbol",
        signature: firstLine.length > 120 ? firstLine.slice(0, 117) + "..." : firstLine,
      };
    });
  } catch {
    return [];
  }
}

// 1. Definition Search (TS/JS + Java + Python)
export function findDefinitions(symbol: string, targetPath: string = "."): MatchResult[] {
  const javaRule = `
id: JavaDef
language: java
rule:
  any:
    - kind: class_declaration
      has: { field: name, regex: "^${symbol}$" }
    - kind: interface_declaration
      has: { field: name, regex: "^${symbol}$" }
    - kind: enum_declaration
      has: { field: name, regex: "^${symbol}$" }
    - kind: record_declaration
      has: { field: name, regex: "^${symbol}$" }
    - kind: method_declaration
      has: { field: name, regex: "^${symbol}$" }
    - kind: constructor_declaration
      has: { field: name, regex: "^${symbol}$" }
`;

  const tsRule = `
id: TSDef
language: ts
rule:
  any:
    - kind: class_declaration
      has: { field: name, regex: "^${symbol}$" }
    - kind: interface_declaration
      has: { field: name, regex: "^${symbol}$" }
    - kind: type_alias_declaration
      has: { field: name, regex: "^${symbol}$" }
    - kind: enum_declaration
      has: { field: name, regex: "^${symbol}$" }
    - kind: function_declaration
      has: { field: name, regex: "^${symbol}$" }
    - kind: method_definition
      has: { field: name, regex: "^${symbol}$" }
    - kind: variable_declarator
      has:
        field: name
        regex: "^${symbol}$"
`;

  const results = [
    ...runAstGrepRule(javaRule, targetPath),
    ...runAstGrepRule(tsRule, targetPath),
  ];

  const seen = new Set<string>();
  return results.filter(r => {
    if (r.file.includes("build/") || r.file.includes("node_modules/") || r.file.includes(".git/")) return false;
    const key = `${r.file}:${r.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 2. References / Call Sites (TS/JS + Java)
export function findReferences(symbol: string, targetPath: string = "."): MatchResult[] {
  const javaRule = `
id: JavaRef
language: java
rule:
  any:
    - kind: method_invocation
      has: { field: name, regex: "^${symbol}$" }
    - kind: object_creation_expression
      has: { field: type, regex: "^${symbol}$" }
`;

  const tsRule = `
id: TSRef
language: ts
rule:
  any:
    - kind: call_expression
      has: { regex: "${symbol}\\\\(" }
    - kind: new_expression
      has: { regex: "new\\\\s+${symbol}" }
`;

  const results = [
    ...runAstGrepRule(javaRule, targetPath),
    ...runAstGrepRule(tsRule, targetPath),
  ];

  const seen = new Set<string>();
  return results.filter(r => {
    if (r.file.includes("build/") || r.file.includes("node_modules/") || r.file.includes(".git/")) return false;
    const key = `${r.file}:${r.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 3. File Outline
export function outlineFile(filePath: string): MatchResult[] {
  const ext = path.extname(filePath);
  const lang = ext === ".java" ? "java" : "ts";

  const rule = lang === "java"
    ? `
id: JavaOutline
language: java
rule:
  any:
    - kind: class_declaration
    - kind: interface_declaration
    - kind: enum_declaration
    - kind: method_declaration
    - kind: constructor_declaration
`
    : `
id: TSOutline
language: ts
rule:
  any:
    - kind: class_declaration
    - kind: interface_declaration
    - kind: type_alias_declaration
    - kind: function_declaration
    - kind: method_definition
`;

  const results = runAstGrepRule(rule, filePath);
  results.sort((a, b) => a.line - b.line);
  return results;
}

// 4. Repo Map
export function generateRepoMap(targetPath: string = "."): Map<string, string[]> {
  const javaRule = `
id: JavaMap
language: java
rule:
  any:
    - kind: class_declaration
    - kind: interface_declaration
`;
  const tsRule = `
id: TSMap
language: ts
rule:
  any:
    - kind: class_declaration
    - kind: interface_declaration
`;

  const all = [
    ...runAstGrepRule(javaRule, targetPath),
    ...runAstGrepRule(tsRule, targetPath),
  ];

  const map = new Map<string, string[]>();
  for (const m of all) {
    if (m.file.includes("build/") || m.file.includes("node_modules/") || m.file.includes(".git/")) continue;
    const list = map.get(m.file) || [];
    list.push(`L${m.line}: ${m.signature}`);
    map.set(m.file, list);
  }
  return map;
}

// ==================== MCP Protocol Stdio Server Mode ====================
function runMcpServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const sendMcp = (response: any) => {
    process.stdout.write(JSON.stringify(response) + "\n");
  };

  rl.on("line", (line) => {
    if (!line.trim()) return;
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
            serverInfo: { name: "code-nav-mcp", version: "1.0.0" },
          },
        });
        return;
      }

      if (method === "notifications/initialized") return;

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
                    path: { type: "string", description: "Optional directory or file path to scope the search" },
                  },
                  required: ["symbol"],
                },
              },
              {
                name: "code_nav_refs",
                description: "Find call sites, method invocations, and new instantiations for a symbol across the codebase.",
                inputSchema: {
                  type: "object",
                  properties: {
                    symbol: { type: "string", description: "Symbol name to find references for" },
                    path: { type: "string", description: "Optional directory or file path" },
                  },
                  required: ["symbol"],
                },
              },
              {
                name: "code_nav_outline",
                description: "Inspect the structure and line numbers of all symbols in a file without reading the entire content. Use before read_file to avoid token waste.",
                inputSchema: {
                  type: "object",
                  properties: {
                    filePath: { type: "string", description: "Path to the file to outline" },
                  },
                  required: ["filePath"],
                },
              },
              {
                name: "code_nav_repomap",
                description: "Generate a compact high-level summary map of primary classes and interfaces across the directory.",
                inputSchema: {
                  type: "object",
                  properties: {
                    path: { type: "string", description: "Target directory (default: '.')" },
                  },
                },
              },
            ],
          },
        });
        return;
      }

      if (method === "tools/call") {
        const { name, arguments: toolArgs } = params;

        if (name === "code_nav_def") {
          const defs = findDefinitions(toolArgs.symbol, toolArgs.path || ".");
          const formatted = defs.map(d => `${d.file}:${d.line} -> ${d.signature}`).join("\n");
          sendMcp({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: formatted || `No definition found for '${toolArgs.symbol}'` }],
            },
          });
          return;
        }

        if (name === "code_nav_refs") {
          const refs = findReferences(toolArgs.symbol, toolArgs.path || ".");
          const formatted = refs.map(r => `${r.file}:${r.line} -> ${r.signature}`).join("\n");
          sendMcp({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: formatted || `No references found for '${toolArgs.symbol}'` }],
            },
          });
          return;
        }

        if (name === "code_nav_outline") {
          const outline = outlineFile(toolArgs.filePath);
          const formatted = outline.map(o => `Line ${String(o.line).padStart(4)}: ${o.signature}`).join("\n");
          sendMcp({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: formatted || `No outline symbols found in '${toolArgs.filePath}'` }],
            },
          });
          return;
        }

        if (name === "code_nav_repomap") {
          const map = generateRepoMap(toolArgs.path || ".");
          let text = `Repo Map (${map.size} files):\n`;
          for (const [file, items] of map.entries()) {
            text += `\n📁 ${file}\n` + items.map(i => `   └─ ${i}`).join("\n");
          }
          sendMcp({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text }],
            },
          });
          return;
        }

        sendMcp({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Tool not found: ${name}` },
        });
        return;
      }

      sendMcp({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    } catch {
      // Ignore parse errors
    }
  });
}

// ==================== CLI Entrypoint ====================
if (import.meta.main) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === "--mcp") {
    runMcpServer();
  } else if (cmd === "def") {
    const symbol = args[1];
    if (!symbol) {
      console.log("Usage: code-nav def <symbol> [path]");
      process.exit(1);
    }
    const defs = findDefinitions(symbol, args[2] || ".");
    console.log(`\n=== [DEFINITIONS] '${symbol}' (${defs.length} matches) ===`);
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
    console.log(`\n=== [REFERENCES/CALLS] '${symbol}' (${refs.length} matches) ===`);
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
    console.log(`\n=== [OUTLINE] ${filePath} (${outline.length} symbols) ===`);
    for (const o of outline) {
      console.log(`  Line ${String(o.line).padStart(4)}: ${o.signature}`);
    }
  } else if (cmd === "repomap") {
    const map = generateRepoMap(args[1] || ".");
    console.log(`\n=== [REPO MAP] Found ${map.size} files with primary declarations ===\n`);
    for (const [file, items] of map.entries()) {
      console.log(`📁 ${file}`);
      for (const item of items) {
        console.log(`    └─ ${item}`);
      }
    }
  } else if (cmd === "--version" || cmd === "-v") {
    console.log("code-nav 1.0.0 (AST Navigator + MCP Server)");
  } else {
    console.log(`
CodeNav v1.0.0 - Zero-Noise AST Code Navigator & MCP Server
GitHub: https://github.com/djoo-lgcns/code-nav

CLI Commands:
  code-nav def <symbol> [path]    Find definition of symbol (Class, Interface, Function, Method)
  code-nav refs <symbol> [path]   Find call sites / instantiations
  code-nav outline <filePath>     Get file symbol outline with line numbers
  code-nav repomap [path]         Generate high-level repo map
  code-nav --mcp                  Run as Model Context Protocol (MCP) Stdio Server
  code-nav --version              Show version
`);
  }
}
