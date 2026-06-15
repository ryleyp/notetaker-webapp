import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { textHasAlias } from "@/lib/accounts";

const MAX_FILES = 5000;

function parseDate(filename, content) {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) { const d = new Date(m[1]); if (!isNaN(d.getTime())) return m[1]; }
  const cm = (content || "").match(/^#[^\n]*?(\d{4}-\d{2}-\d{2})/m);
  if (cm) { const d = new Date(cm[1]); if (!isNaN(d.getTime())) return cm[1]; }
  return null;
}

function walkDir(dir, basePath, locationLabel, fileList, counter) {
  if (!fs.existsSync(dir) || counter.n >= MAX_FILES) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (counter.n >= MAX_FILES) break;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, basePath, entry.name, fileList, counter);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      let content = "";
      try { content = fs.readFileSync(fullPath, "utf-8"); } catch { continue; }
      const title = entry.name.replace(/^\d{4}-\d{2}-\d{2}\s*[-–]\s*/, "").replace(/\.md$/, "");
      fileList.push({
        path: path.relative(basePath, fullPath),
        title,
        date: parseDate(entry.name, content),
        location: locationLabel,
        _content: content,
      });
      counter.n++;
    }
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const vaultPath = searchParams.get("vaultPath");
  const transcriptsPath = searchParams.get("transcriptsPath") || "";
  const accountsParam = searchParams.get("accounts");

  if (!vaultPath) return NextResponse.json({ error: "vaultPath is required" }, { status: 400 });

  let accounts = [];
  try { accounts = accountsParam ? JSON.parse(accountsParam) : []; } catch {}

  const resolvedVault = path.resolve(vaultPath);
  const counter = { n: 0 };
  const allFiles = [];

  walkDir(resolvedVault, resolvedVault, "Vault", allFiles, counter);

  if (transcriptsPath) {
    const resolvedArchive = path.resolve(transcriptsPath);
    if (fs.existsSync(resolvedArchive)) {
      walkDir(resolvedArchive, resolvedArchive, "Transcripts", allFiles, counter);
    }
  }

  const accountMatches = accounts.map((a) => ({ account: a, files: [] }));
  const unmatched = [];

  for (const file of allFiles) {
    const searchText = file.title + " " + file._content;
    const matchedIdxs = [];
    for (let i = 0; i < accounts.length; i++) {
      if ((accounts[i].aliases || []).some((alias) => textHasAlias(searchText, alias))) {
        matchedIdxs.push(i);
      }
    }
    const { _content: _, ...fileOut } = file;
    if (matchedIdxs.length > 0) {
      for (const idx of matchedIdxs) accountMatches[idx].files.push(fileOut);
    } else {
      unmatched.push(fileOut);
    }
  }

  return NextResponse.json({
    results: accountMatches,
    unmatched: unmatched.slice(0, 200),
    total: allFiles.length,
    truncated: counter.n >= MAX_FILES,
  });
}
