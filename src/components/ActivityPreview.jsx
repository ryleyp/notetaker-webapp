"use client";

import { useState } from "react";
import { formatCost } from "@/lib/pricing";

const COMMENT_LIMIT = 800;

// Parse a Markdown table into { header, rows } of trimmed cell strings.
function parseTable(md) {
  const lines = md.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("|"));
  const isSep = (l) => /^\|[\s\-|:]+\|$/.test(l);
  const cellRows = lines.filter((l) => !isSep(l)).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
  if (!cellRows.length) return { header: [], rows: [] };
  return { header: cellRows[0], rows: cellRows.slice(1) };
}

function stripMd(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
}

export default function ActivityPreview({ notes, onSave, saving, saved, savedPath, streaming, cost }) {
  const [viewMode, setViewMode] = useState("table");
  const [copiedKey, setCopiedKey] = useState(null);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
    }).catch(() => {});
  };

  const { header, rows } = parseTable(notes);
  const commentIdx = header.findIndex((h) => /comment/i.test(h));

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="section-header mb-0">EA Activity Table</h2>
          {cost && !streaming && (
            <span className="text-xs text-gray-400 font-mono">{formatCost(cost)}</span>
          )}
          {!streaming && rows.length > 0 && (
            <span className="text-xs text-gray-400">{rows.length} activit{rows.length !== 1 ? "ies" : "y"}</span>
          )}
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
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "table" ? "bg-obsidian-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              SFDC View
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
          <button onClick={() => copy(notes, "all")} className="btn-secondary text-xs px-3 py-1.5">
            {copiedKey === "all" ? "Copied!" : "Copy All"}
          </button>
        </div>
      </div>

      <div className="p-6">
        {streaming || viewMode === "raw" || rows.length === 0 ? (
          <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap max-h-[600px] overflow-y-auto leading-relaxed">
            {notes}
          </pre>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-2">Click any cell to copy it for Salesforce entry. Comments over {COMMENT_LIMIT} characters are flagged red.</p>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    {header.map((h, i) => (
                      <th key={i} className="border border-gray-200 px-2 py-1.5 text-left font-semibold sticky top-0 bg-gray-100">
                        {stripMd(h)}
                      </th>
                    ))}
                    <th className="border border-gray-200 px-2 py-1.5 sticky top-0 bg-gray-100" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, r) => (
                    <tr key={r} className={r % 2 === 1 ? "bg-gray-50" : ""}>
                      {row.map((cell, c) => {
                        const key = `${r}-${c}`;
                        const text = stripMd(cell);
                        const isComment = c === commentIdx;
                        const over = isComment && text.length > COMMENT_LIMIT;
                        return (
                          <td
                            key={c}
                            onClick={() => copy(text, key)}
                            title="Click to copy"
                            className={`border border-gray-200 px-2 py-1.5 align-top cursor-pointer transition-colors hover:bg-obsidian-50 ${
                              copiedKey === key ? "bg-green-50" : ""
                            }`}
                          >
                            {copiedKey === key && (
                              <span className="text-green-600 font-medium mr-1">✓ Copied</span>
                            )}
                            {text}
                            {isComment && (
                              <div className={`mt-1 font-mono text-[10px] ${over ? "text-red-600 font-bold" : "text-gray-400"}`}>
                                {text.length}/{COMMENT_LIMIT}{over ? " — over limit" : ""}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-gray-200 px-1 py-1.5 align-top">
                        <button
                          onClick={() => copy(row.map(stripMd).join("\t"), `row-${r}`)}
                          title="Copy row (tab-separated)"
                          className="text-gray-400 hover:text-gray-600 p-0.5"
                        >
                          {copiedKey === `row-${r}` ? (
                            <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
        {saved ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200 flex-1">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Saved to <code className="font-mono text-xs bg-green-100 px-1 rounded">{savedPath}</code></span>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Ready to save to your Obsidian vault.</p>
        )}

        <button onClick={onSave} disabled={saving || saved || streaming} className="btn-success whitespace-nowrap">
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
