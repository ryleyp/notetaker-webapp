import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function detectFolder(text) {
  const lower = text.toLowerCase();
  if (lower.includes("lockheed")) return "LM Transcripts";
  if (/l3\s*harris/.test(lower)) return "L3 Transcripts";
  if (lower.includes("northrop")) return "NGC Transcripts";
  if (lower.includes("frontgrade")) return "Frontgrade Transcripts";
  return "Internal Transcripts";
}

export async function POST(request) {
  try {
    const { transcript, meetingTitle, transcriptsPath } = await request.json();
    if (!transcript || !meetingTitle || !transcriptsPath) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Detect from title first, fall back to first 500 chars of transcript
    const folder = detectFolder(meetingTitle + " " + transcript.slice(0, 500));
    const resolvedBase = path.resolve(transcriptsPath);
    const dir = path.join(resolvedBase, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const safeTitle = meetingTitle.replace(/[/\\:*?"<>|]/g, "-");
    const filePath = path.join(dir, `${safeTitle}.md`);
    fs.writeFileSync(filePath, `# ${meetingTitle}\n\n${transcript}\n`, "utf-8");

    return NextResponse.json({ ok: true, savedPath: path.relative(resolvedBase, filePath) });
  } catch (error) {
    console.error("Save transcript error:", error);
    return NextResponse.json({ ok: true });
  }
}
