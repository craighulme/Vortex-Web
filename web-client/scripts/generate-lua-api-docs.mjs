import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const repoRoot = path.join(root, "..");
const sourcePath = path.join(root, "src", "scripting", "LuaApiReference.ts");
const outPath = path.join(repoRoot, "LUA_API.md");
const canonicalTypesPath = path.join(repoRoot, "examples", "lua", "types", "vweb.lua");
const typeOutPaths = [
  canonicalTypesPath,
  path.join(repoRoot, "runtime", "lua", "types", "vweb.lua"),
  path.join(root, "public", "lua", "types", "vweb.lua")
];
const source = fs.readFileSync(sourcePath, "utf8");
const ast = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const entries = [];

function readStringProperty(object, name) {
  for (const prop of object.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const propName = prop.name;
    const key = ts.isIdentifier(propName) || ts.isStringLiteral(propName) ? propName.text : "";
    if (key !== name) continue;
    const value = prop.initializer;
    if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  }
  return "";
}

function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "LUA_API_REFERENCE" &&
    node.initializer &&
    ts.isArrayLiteralExpression(node.initializer)
  ) {
    for (const item of node.initializer.elements) {
      if (!ts.isObjectLiteralExpression(item)) continue;
      entries.push({
        group: readStringProperty(item, "group"),
        kind: readStringProperty(item, "kind"),
        name: readStringProperty(item, "name"),
        signature: readStringProperty(item, "signature"),
        summary: readStringProperty(item, "summary")
      });
    }
  }
  ts.forEachChild(node, visit);
}

visit(ast);

const groups = new Map();
for (const entry of entries) {
  if (!groups.has(entry.group)) groups.set(entry.group, []);
  groups.get(entry.group).push(entry);
}

const title = "# Vortex Web Lua API Reference";
const lines = [
  title,
  "",
  "Raw local runtime scripting reference. No raw DOM, fetch, WebSocket, cookies, or extension APIs.",
  "",
  "For examples and explanation, read [LUA_DOCS.md](LUA_DOCS.md).",
  ""
];

for (const [group, rows] of groups) {
  lines.push(`## ${group[0].toUpperCase()}${group.slice(1)}`, "");
  lines.push("| API | Signature | Notes |");
  lines.push("| --- | --- | --- |");
  for (const row of rows) {
    lines.push(`| \`${row.name}\` | \`${row.signature}\` | ${row.summary} |`);
  }
  lines.push("");
}

const output = `${lines.join("\n").trim()}\n`;
if (process.argv.includes("--stdout")) {
  process.stdout.write(output);
} else {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output);
  syncLuaTypes();
  console.log(outPath);
}

function syncLuaTypes() {
  if (!fs.existsSync(canonicalTypesPath)) return;
  const source = fs.readFileSync(canonicalTypesPath, "utf8");
  for (const target of typeOutPaths) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (target === canonicalTypesPath) continue;
    fs.writeFileSync(target, source);
  }
}
