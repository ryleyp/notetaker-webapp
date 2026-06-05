import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getFoldersRecursive(dirPath, basePath, depth = 0, maxDepth = 5) {
  if (depth > maxDepth) return [];
  const folders = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip hidden folders and Obsidian system folders
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
      folders.push({
        name: entry.name,
        path: relativePath,
        fullPath,
        depth,
      });
      const children = getFoldersRecursive(fullPath, basePath, depth + 1, maxDepth);
      folders.push(...children);
    }
  } catch {
    // Skip unreadable directories
  }
  return folders;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const vaultPath = searchParams.get("vaultPath");

  if (!vaultPath) {
    return NextResponse.json({ error: "vaultPath is required" }, { status: 400 });
  }

  const resolved = path.resolve(vaultPath);
  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "Vault path does not exist" }, { status: 404 });
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return NextResponse.json({ error: "Vault path is not a directory" }, { status: 400 });
  }

  // Include root as an option
  const folders = [
    { name: "(Vault root)", path: "", fullPath: resolved, depth: -1 },
    ...getFoldersRecursive(resolved, resolved),
  ];

  return NextResponse.json({ folders });
}
