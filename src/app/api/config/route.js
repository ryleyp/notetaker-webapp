import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// The glossary (privacy replacements, common corrections, account config) is
// persisted to a single JSON file outside the browser so it survives cache
// clears and moves between machines. The directory is provided by the client
// (transcripts archive path, falling back to the vault path).
const FILE = "notetaker-config.json";

function configFile(dir) {
  return path.join(path.resolve(dir), FILE);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dir = searchParams.get("path");
  if (!dir) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  const file = configFile(dir);
  if (!fs.existsSync(file)) {
    return NextResponse.json({ config: null });
  }
  try {
    const config = JSON.parse(fs.readFileSync(file, "utf-8"));
    return NextResponse.json({ config });
  } catch {
    return NextResponse.json({ config: null, error: "Could not parse config file" });
  }
}

export async function POST(request) {
  try {
    const { path: dir, config } = await request.json();
    if (!dir) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }
    const resolved = path.resolve(dir);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    fs.writeFileSync(configFile(dir), JSON.stringify(config, null, 2), "utf-8");
    return NextResponse.json({ ok: true, savedPath: configFile(dir) });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Save failed" }, { status: 500 });
  }
}
