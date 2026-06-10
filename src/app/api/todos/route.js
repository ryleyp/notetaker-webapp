import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getMondayOfWeek() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split("T")[0];
}

function extractAssignedItems(notes) {
  const assigneeRegex = /riley|ryley/i;
  const result = { actionItems: [], nextSteps: [] };

  const actionMatch = notes.match(/## Action Items\n([\s\S]*?)(?=\n## |\n---\n|$)/);
  if (actionMatch) {
    result.actionItems = actionMatch[1]
      .split("\n")
      .filter((l) => l.trim().startsWith("- ") && assigneeRegex.test(l));
  }

  const nextMatch = notes.match(/## Next Steps\n([\s\S]*?)(?=\n## |\n---\n|$)/);
  if (nextMatch) {
    result.nextSteps = nextMatch[1]
      .split("\n")
      .filter((l) => l.trim().startsWith("- ") && assigneeRegex.test(l));
  }

  return result;
}

function buildNewFile(monday, actionItems, nextSteps, meetingTitle) {
  const tag = `*(from: ${meetingTitle})*`;
  const actionLines = actionItems.length
    ? actionItems.map((l) => `${l.trimEnd()} ${tag}`).join("\n")
    : "";
  const nextLines = nextSteps.length
    ? nextSteps.map((l) => `${l.trimEnd()} ${tag}`).join("\n")
    : "";

  return `# ${monday} - ToDos from Meetings\n\n## Action Items\n\n${actionLines}\n\n## Next Steps\n\n${nextLines}\n`.trimEnd() + "\n";
}

function appendToFile(existing, actionItems, nextSteps, meetingTitle) {
  const tag = `*(from: ${meetingTitle})*`;
  let content = existing.trimEnd();

  if (actionItems.length > 0) {
    const lines = actionItems.map((l) => `${l.trimEnd()} ${tag}`).join("\n");
    if (content.includes("\n## Next Steps")) {
      content = content.replace("\n## Next Steps", `\n${lines}\n\n## Next Steps`);
    } else {
      content += "\n" + lines;
    }
  }

  if (nextSteps.length > 0) {
    const lines = nextSteps.map((l) => `${l.trimEnd()} ${tag}`).join("\n");
    content += "\n" + lines;
  }

  return content + "\n";
}

export async function POST(request) {
  try {
    const { notes, vaultPath, meetingTitle } = await request.json();
    if (!notes || !vaultPath) return NextResponse.json({ ok: true });

    const { actionItems, nextSteps } = extractAssignedItems(notes);
    if (actionItems.length === 0 && nextSteps.length === 0) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const resolvedVault = path.resolve(vaultPath);
    const todosDir = path.join(resolvedVault, "Todos");
    if (!fs.existsSync(todosDir)) fs.mkdirSync(todosDir, { recursive: true });

    const monday = getMondayOfWeek();
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
