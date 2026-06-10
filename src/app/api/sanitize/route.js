import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request) {
  const body = await request.json();
  const { transcript, apiKey, knownTerms = [] } = body;

  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ entities: [] });

  const client = new Anthropic({ apiKey: key });

  const knownList = knownTerms.length ? knownTerms.join(", ") : "none";

  const prompt = `Extract sensitive proper nouns from this text that should be anonymized before sending to an AI.

INCLUDE:
- Person names (first, last, or full names)
- Company and organization names
- Military branch or government agency names
- Division or business unit names

DO NOT INCLUDE:
- NI Software products: NI, LabVIEW, TestStand, SystemLink, DIAdem, FlexLogger, VeriStand, NI-DAQmx, LabWindows/CVI, Measurement Studio, NI-VISA, OpenTestBed
- Generic terms, job titles, locations, or common words
- Already known: ${knownList}

Return ONLY a JSON array, no explanation. Each item: {"text": "exact term", "type": "person" or "org"}
If nothing found, return [].

TEXT:
${transcript}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0]?.text?.trim() || "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    const entities = match ? JSON.parse(match[0]) : [];
    return NextResponse.json({ entities });
  } catch {
    return NextResponse.json({ entities: [] });
  }
}
