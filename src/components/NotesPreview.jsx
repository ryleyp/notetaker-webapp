"use client";

import { useState } from "react";

function renderMarkdown(text) {
  const lines = text.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Inline tag line (e.g. "#austin #texas") — render as pills
    if (/^(#[a-z][a-z0-9-]*\s*)+$/i.test(line.trim()) && line.trim().startsWith("#")) {
      const tags = line.trim().split(/\s+/).map((t) => t.slice(1)).filter(Boolean);
      const tagPills = tags
        .map((t) => `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-obsidian-100 text-obsidian-700 mr-1 mb-1">#${escapeHtml(t)}</span>`)
        .join("");
      result.push(`<div class="flex flex-wrap mb-2">${tagPills}</div>`);
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      result.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      result.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      result.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith("---")) {
      result.push("<hr>");
    } else if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
      const checked = line.startsWith("- [x] ");
      const content = formatInline(line.slice(6));
      result.push(`<ul><li>${checked ? "✅" : "☐"} ${content}</li></ul>`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      result.push(`<ul><li>${formatInline(line.slice(2))}</li></ul>`);
    } else if (line.trim() === "") {
      result.push("<br>");
    } else {
      result.push(`<p>${formatInline(line)}</p>`);
    }
    i++;
  }

  // Merge consecutive ul elements
  const merged = result
    .join("\n")
    .replace(/<\/ul>\n<ul>/g, "")
    .replace(/<br>\n<br>/g, "<br>");

  return merged;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export default function NotesPreview({ notes, onSave, saving, saved, savedPath, streaming }) {
  const [viewMode, setViewMode] = useState("preview");

  const copyToClipboard = () => {
    navigator.clipboard.writeText(notes).catch(() => {});
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <h2 className="section-header mb-0">Generated Notes</h2>
          {streaming && (
            <span className="flex items-center gap-1 text-xs text-obsidian-600 font-medium">
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => setViewMode("preview")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "preview" ? "bg-obsidian-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setViewMode("raw")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "raw" ? "bg-obsidian-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Markdown
            </button>
          </div>
          <button onClick={copyToClipboard} className="btn-secondary text-xs px-3 py-1.5">
            Copy
          </button>
        </div>
      </div>

      <div className="p-6">
        {viewMode === "preview" ? (
          <div
            className="markdown-preview max-h-[600px] overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(notes) }}
          />
        ) : (
          <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap max-h-[600px] overflow-y-auto leading-relaxed">
            {notes}
          </pre>
        )}
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
        {saved ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200 flex-1">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>
              Saved to <code className="font-mono text-xs bg-green-100 px-1 rounded">{savedPath}</code>
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Ready to save to your Obsidian vault.</p>
        )}

        <button
          onClick={onSave}
          disabled={saving || saved || streaming}
          className="btn-success whitespace-nowrap"
        >
          {saving ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : saved ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save to Obsidian
            </>
          )}
        </button>
      </div>
    </div>
  );
}
