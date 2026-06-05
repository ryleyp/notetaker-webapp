import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { notes, vaultPath, folderPath, meetingTitle, meetingDate } = body;

    if (!notes) return NextResponse.json({ error: "Notes content is required" }, { status: 400 });
    if (!vaultPath) return NextResponse.json({ error: "Vault path is required" }, { status: 400 });

    const resolvedVault = path.resolve(vaultPath);
    if (!fs.existsSync(resolvedVault)) {
      return NextResponse.json({ error: "Vault path does not exist" }, { status: 404 });
    }

    const targetDir = folderPath
      ? path.join(resolvedVault, folderPath)
      : resolvedVault;

    if (!fs.existsSync(targetDir)) {
      return NextResponse.json({ error: "Target folder does not exist" }, { status: 404 });
    }

    // Ensure we're not escaping the vault
    const normalizedTarget = path.normalize(targetDir);
    const normalizedVault = path.normalize(resolvedVault);
    if (!normalizedTarget.startsWith(normalizedVault)) {
      return NextResponse.json({ error: "Target folder is outside vault" }, { status: 403 });
    }

    const title = sanitizeFilename(meetingTitle || "Meeting Notes");
    const filename = `${title}.md`;
    const filePath = path.join(targetDir, filename);

    // Don't overwrite existing files — append a number
    let finalPath = filePath;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      finalPath = path.join(targetDir, `${base} (${counter})${ext}`);
      counter++;
    }

    fs.writeFileSync(finalPath, notes, "utf-8");

    const relativeSavedPath = path.relative(resolvedVault, finalPath);
    return NextResponse.json({ savedPath: relativeSavedPath, filename: path.basename(finalPath) });
  } catch (error) {
    console.error("Error saving note:", error);
    return NextResponse.json({ error: error?.message || "Failed to save note" }, { status: 500 });
  }
}
