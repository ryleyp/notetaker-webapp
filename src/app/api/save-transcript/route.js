import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request) {
  try {
    const { transcript, meetingTitle, transcriptsPath, folder } = await request.json();
    if (!transcript || !meetingTitle || !transcriptsPath) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const resolvedBase = path.resolve(transcriptsPath);
    const dir = folder ? path.join(resolvedBase, folder) : resolvedBase;
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
