import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getMondayOfWeek(dateStr) {
  // Week = Sunday–Saturday; file is named after that Monday
  const date = new Date((dateStr || new Date().toISOString().split("T")[0]) + "T12:00:00");
  const day = date.getDay(); // 0=Sun … 6=Sat
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - day);
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() + 1);
  return monday.toISOString().split("T")[0];
}

function extractDateFromTitle(title) {
  const match = title && title.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function extractItems(notes) {
  const result = { actionItems: [], nextSteps: [] };

  const actionMatch = notes.match(/## Action Items\n([\s\S]*?)(?=\n## |\n---\n|$)/);
  if (actionMatch) {
    result.actionItems = actionMatch[1]
      .split("\n")
      .filter((l) => l.trim().startsWith("- "));
  }

  const nextMatch = notes.match(/## Next Steps\n([\s\S]*?)(?=\n## |\n---\n|$)/);
  if (nextMatch) {
    result.nextSteps = nextMatch[1]
      .split("\n")
      .filter((l) => l.trim().startsWith("- "));
  }

  return result;
}

function meetingBlock(items, meetingTitle) {
  return `**${meetingTitle}**\n${items.map((l) => l.trimEnd()).join("\n")}`;
}

function buildNewFile(monday, actionItems, nextSteps, meetingTitle) {
  const actionBlock = actionItems.length ? meetingBlock(actionItems, meetingTitle) : "";
  const nextBlock = nextSteps.length ? meetingBlock(nextSteps, meetingTitle) : "";

  return `# ${monday} - ToDos from Meetings\n\n## Action Items\n\n${actionBlock}\n\n## Next Steps\n\n${nextBlock}\n`.trimEnd() + "\n";
}

function appendToFile(existing, actionItems, nextSteps, meetingTitle) {
  let content = existing.trimEnd();

  if (actionItems.length > 0) {
    const block = "\n\n" + meetingBlock(actionItems, meetingTitle);
    if (content.includes("\n## Next Steps")) {
      content = content.replace("\n## Next Steps", `${block}\n\n## Next Steps`);
    } else {
      content += block;
    }
  }

  if (nextSteps.length > 0) {
    content += "\n\n" + meetingBlock(nextSteps, meetingTitle);
  }

  return content + "\n";
}

export async function POST(request) {
  try {
    const { notes, vaultPath, meetingTitle } = await request.json();
    if (!notes || !vaultPath) return NextResponse.json({ ok: true });

    const { actionItems, nextSteps } = extractItems(notes);
    if (actionItems.length === 0 && nextSteps.length === 0) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const resolvedVault = path.resolve(vaultPath);
    const todosDir = path.join(resolvedVault, "Todos");
    if (!fs.existsSync(todosDir)) fs.mkdirSync(todosDir, { recursive: true });

    const monday = getMondayOfWeek(extractDateFromTitle(meetingTitle));
    const filePath = path.join(todosDir, `${monday} - ToDos from Meetings.md`);

    const content = fs.existsSync(filePath)
      ? appendToFile(fs.readFileSync(filePath, "utf-8"), actionItems, nextSteps, meetingTitle)
      : buildNewFile(monday, actionItems, nextSteps, meetingTitle);

    fs.writeFileSync(filePath, content, "utf-8");

    const relativePath = path.relative(resolvedVault, filePath);
    const count = actionItems.length + nextSteps.length;
    return NextResponse.json({ ok: true, savedPath: relativePath, count });
  } catch (error) {
    console.error("Todos error:", error);
    return NextResponse.json({ ok: true });
  }
}
