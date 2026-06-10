"use client";

import { useState } from "react";

export default function SanitizeReview({ detected, savedReplacements, onConfirm, onSkip }) {
  const [items, setItems] = useState(
    detected.map((d) => ({ ...d, enabled: true, saveToList: false }))
  );

  function toggleEnabled(i) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, enabled: !item.enabled } : item));
  }

  function toggleSave(i) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, saveToList: !item.saveToList } : item));
  }

  function setAlias(i, alias) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, alias } : item));
  }

  function handleConfirm() {
    const confirmed = items.filter((i) => i.enabled);
    const toSave = items.filter((i) => i.enabled && i.saveToList);
    onConfirm(confirmed, toSave);
  }

  const activeCount = items.filter((i) => i.enabled).length;

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Privacy Review</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Found {detected.length} term{detected.length !== 1 ? "s" : ""} to anonymize before sending to Claude.
            Uncheck anything you want to keep as-is.
          </p>
        </div>
        <button onClick={onSkip} className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap ml-4">
          Skip filter
        </button>
      </div>

      {savedReplacements.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-medium text-gray-600 mb-1.5">Already in your list:</p>
          <div className="flex flex-wrap gap-1.5">
            {savedReplacements.map((r) => (
              <span key={r.original} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-obsidian-50 text-obsidian-700 border border-obsidian-200">
                {r.original} → <span className="font-mono">{r.alias}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 ? (
        <div className="space-y-2 mb-5">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-2 items-center text-xs text-gray-500 font-medium px-1">
            <span></span>
            <span>Detected term</span>
            <span>Alias</span>
            <span>Save to list</span>
          </div>
          {items.map((item, i) => (
            <div
              key={i}
              className={`grid grid-cols-[auto_1fr_auto_auto] gap-x-3 items-center p-2.5 rounded-lg border transition-colors ${
                item.enabled ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-50"
              }`}
            >
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => toggleEnabled(i)}
                className="w-4 h-4 rounded accent-obsidian-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">{item.text}</span>
                <span className="ml-2 text-xs text-gray-400">{item.type}</span>
              </div>
              <input
                type="text"
                value={item.alias}
                onChange={(e) => setAlias(i, e.target.value)}
                disabled={!item.enabled}
                className="font-mono text-xs px-2 py-1 rounded border border-gray-200 bg-gray-50 w-28 focus:outline-none focus:border-obsidian-400 disabled:opacity-40"
              />
              <input
                type="checkbox"
                checked={item.saveToList}
                onChange={() => toggleSave(i)}
                disabled={!item.enabled}
                title="Save to permanent list"
                className="w-4 h-4 rounded accent-obsidian-600 disabled:opacity-40"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-5">No new terms detected beyond your saved list.</p>
      )}

      <button
        onClick={handleConfirm}
        className="btn-primary w-full py-3 text-base"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        {activeCount > 0 ? `Anonymize ${activeCount} term${activeCount !== 1 ? "s" : ""} & Generate` : "Generate without anonymizing"}
      </button>
    </div>
  );
}
