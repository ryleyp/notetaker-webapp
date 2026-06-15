import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const d = new Date(match[1]);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const vaultPath = searchParams.get("vaultPath");
  const folderPath = searchParams.get("folderPath") || "";

  if (!vaultPath) {
    return NextResponse.json({ error: "vaultPath is required" }, { status: 400 });
  }

  const resolvedVault = path.resolve(vaultPath);
  const targetDir = folderPath ? path.join(resolvedVault, folderPath) : resolvedVault;

  if (!fs.existsSync(targetDir)) {
    return NextResponse.json({ error: "Folder does not exist" }, { status: 404 });
  }

  // Only allow paths inside the vault
  if (!path.normalize(targetDir).startsWith(path.normalize(resolvedVault))) {
    return NextResponse.json({ error: "Path is outside vault" }, { status: 403 });
  }

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  let entries;
  try {
    entries = fs.readdirSync(targetDir, { withFileTypes: true });
  } catch {
    return NextResponse.json({ error: "Could not read folder" }, { status: 500 });
  }

  const notes = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

    const date = parseDateFromFilename(entry.name);
    if (!date || date < threeMonthsAgo) continue;

    const filePath = path.join(targetDir, entry.name);
    let content;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const title = entry.name
      .replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, "")
      .replace(/\.md$/, "");

    notes.push({
      filename: entry.name,
      date: date.toISOString().split("T")[0],
      title,
      content,
    });
  }

  // Sort newest first
  notes.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ notes, total: notes.length });
}
