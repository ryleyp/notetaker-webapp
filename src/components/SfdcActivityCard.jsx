"use client";

import { useState } from "react";
import { parseSfdcEntries, isOverLimit, entryToText, SUMMARY_LIMIT } from "@/lib/sfdcActivity";
import { formatCost } from "@/lib/pricing";

function CopyButton({ text, label = "Copy", copiedLabel = "Copied!" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }).catch(() => {});
      }}
      className="text-xs text-gray-500 hover:text-obsidian-600 border border-gray-200 rounded px-1.5 py-0.5 transition-colors"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

export default function SfdcActivityCard({ output, streaming, cost, error }) {
  const entries = parseSfdcEntries(output);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="section-header mb-0">SFDC Activity</h2>
          {cost && !streaming && <span className="text-xs text-gray-400 font-mono">{formatCost(cost)}</span>}
          {entries.length > 0 && (
            <span className="text-xs text-gray-400">{entries.length} entr{entries.length !== 1 ? "ies" : "y"}</span>
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
        {entries.length > 0 && !streaming && (
          <CopyButton
            text={entries.map(entryToText).join("\n\n———\n\n")}
            label="Copy all"
            copiedLabel="Copied all!"
          />
        )}
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {entries.length === 0 && streaming && (
          <p className="text-sm text-gray-500 animate-pulse">Drafting activity entries…</p>
        )}

        {entries.length === 0 && !streaming && !error && (
          <p className="text-sm text-gray-500">No reportable activity found in this transcript.</p>
        )}

        {entries.map((entry, i) => {
          const over = isOverLimit(entry.summary);
          return (
            <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[7rem_1fr_auto] gap-x-3 items-center px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs">
                <span className="text-gray-400 font-medium">Type</span>
                <span className="font-medium text-gray-800">{entry.type}</span>
                <CopyButton text={entry.type} />
              </div>
              <div className="grid grid-cols-[7rem_1fr_auto] gap-x-3 items-center px-3 py-2 border-b border-gray-100 text-xs">
                <span className="text-gray-400 font-medium">Subtype</span>
                <span className="font-medium text-gray-800">{entry.subtype}</span>
                <CopyButton text={entry.subtype} />
              </div>
              <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400 font-medium">Summary / Notes</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono ${over ? "text-red-600 font-bold" : "text-gray-400"}`}>
                      {entry.summary.length}/{SUMMARY_LIMIT}{over ? " — over limit" : ""}
                    </span>
                    <CopyButton text={entry.summary} />
                  </div>
                </div>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{entry.summary}</pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
