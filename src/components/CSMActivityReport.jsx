"use client";

import { useState } from "react";
import FolderSelector from "@/components/FolderSelector";
import NotesPreview from "@/components/NotesPreview";
import { calcCost } from "@/lib/pricing";
import { detectAccount } from "@/lib/accounts";
import { reverseReplacements } from "@/lib/sanitize";
import { buildScrubReport } from "@/lib/scrub";

const TODAY = new Date().toISOString().split("T")[0];

const SYNTHESIS_PRICING = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0, label: "Haiku" },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, label: "Sonnet" },
};

const MODEL_CONTEXT = {
  "claude-opus-4-8": 1_000_000,
  "claude-sonnet-4-6": 1_000_000,
  "claude-haiku-4-5": 200_000,
};

function contextLimit(model) {
  return MODEL_CONTEXT[model] || 200_000;
}

function threeMonthsAgoLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function estimateUsage(notes, model) {
  const chars = notes.reduce((s, n) => s + (n.content?.length || 0) + (n.title?.length || 0), 0);
  const inputTokens = Math.ceil(chars / 4) + 2500;
  const outputTokens = 2000;
  const p = SYNTHESIS_PRICING[model] || SYNTHESIS_PRICING["claude-sonnet-4-6"];
  const cost = (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
  return { inputTokens, outputTokens, cost, label: p.label };
}

export default function CSMActivityReport({ settings, onSettingsClick }) {
  const [selectedFolder, setSelectedFolder] = useState("");
  const [loadedNotes, setLoadedNotes] = useState(null);
  const [loadCounts, setLoadCounts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [synthesizing, setSynthesizing] = useState(false);
  const [synthError, setSynthError] = useState(null);
  const [output, setOutput] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedPath, setSavedPath] = useState("");
  const [synthCost, setSynthCost] = useState(null);
  const [droppedCount, setDroppedCount] = useState(0);

  const [scrubReport, setScrubReport] = useState([]);
  const [restoredIds, setRestoredIds] = useState(new Set());
  const [scrubOpen, setScrubOpen] = useState(false);

  const [model, setModel] = useState(settings.model || "claude-haiku-4-5");

  async function handleLoadNotes() {
    if (!settings.vaultPath) return;
    setLoading(true);
    setLoadError(null);
    setLoadedNotes(null);
    setLoadCounts(null);
    setOutput("");
    setSaved(false);
    setShowConfirm(false);
    setScrubReport([]);
    setRestoredIds(new Set());
    setScrubOpen(false);

    try {
      const { name: accountName, aliases } = detectAccount(selectedFolder, settings.accounts);
      const params = new URLSearchParams({ vaultPath: settings.vaultPath });
      if (selectedFolder) params.set("folderPath", selectedFolder);
      if (aliases?.length) params.set("accountAliases", aliases.join(","));

      const res = await fetch(`/api/notes?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load notes");

      setLoadedNotes(data.notes);
      setLoadCounts(data.counts);
      setScrubReport(buildScrubReport(data.notes, accountName, settings.accounts || []));
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSynthesize() {
    if (!loadedNotes?.length) return;
    setSynthesizing(true);
    setSynthError(null);
    setOutput("");
    setSaved(false);
    setShowConfirm(false);
    setDroppedCount(0);

    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: loadedNotes,
          apiKey: settings.apiKey || undefined,
          model,
          today: TODAY,
          replacements: settings.replacements || [],
          corrections: settings.corrections || [],
          promptType: "csm-activity",
          accountName: detectAccount(selectedFolder, settings.accounts).name,
          allAccounts: settings.accounts || [],
          restoredIds: [...restoredIds],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Synthesis failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const evt = JSON.parse(part.slice(6));
          if (evt.type === "delta") {
            accumulated += evt.text;
            setOutput(accumulated);
          } else if (evt.type === "done") {
            const reps = settings.replacements || [];
            setOutput(reps.length ? reverseReplacements(accumulated, reps) : accumulated);
            if (evt.usage) setSynthCost(calcCost(evt.usage, evt.model));
            if (evt.droppedCount) setDroppedCount(evt.droppedCount);
          } else if (evt.type === "error") {
            throw new Error(evt.message);
          }
        }
      }
    } catch (e) {
      setSynthError(e.message);
    } finally {
      setSynthesizing(false);
    }
  }

  async function handleSave() {
    if (!output || !settings.vaultPath) return;
    setSaving(true);
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: output,
          vaultPath: settings.vaultPath,
          folderPath: selectedFolder,
          meetingTitle: `EA Activity Report ${TODAY}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
      setSavedPath(data.savedPath);
    } catch (e) {
      alert(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setLoadedNotes(null);
    setLoadCounts(null);
    setOutput("");
    setSaved(false);
    setSavedPath("");
    setSynthError(null);
    setLoadError(null);
    setShowConfirm(false);
    setScrubReport([]);
    setRestoredIds(new Set());
    setScrubOpen(false);
  }

  const folderLabel = selectedFolder || "(Vault root)";

  return (
    <div className="space-y-4">
      <FolderSelector
        vaultPath={settings.vaultPath}
        selectedFolder={selectedFolder}
        onSelect={(f) => { setSelectedFolder(f); setLoadedNotes(null); setOutput(""); setShowConfirm(false); }}
        onSettingsClick={onSettingsClick}
      />

      {settings.vaultPath && !output && (
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">EA Activity Report — Quarter Range</h3>
              <p className="text-sm text-gray-500">
                Scanning <span className="font-medium text-gray-700">{folderLabel}</span> for notes dated{" "}
                <span className="font-medium text-gray-700">{threeMonthsAgoLabel()}</span> or later, then generating a CSM activity table.
              </p>

              {loadedNotes !== null && (
                <div className="mt-3">
                  {loadedNotes.length === 0 ? (
                    <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 inline-block">
                      No notes with dates in the past 3 months found in this folder.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-green-700">
                        Found {loadedNotes.length} note{loadedNotes.length !== 1 ? "s" : ""} in the past quarter
                      </p>
                      {loadCounts && (
                        <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                          {loadCounts.obsidian > 0 && <span>📝 {loadCounts.obsidian} Obsidian</span>}
                          {loadCounts.crossVault > 0 && <span>🔍 {loadCounts.crossVault} Cross-folder</span>}
                        </div>
                      )}
                      <ul className="text-xs text-gray-500 space-y-0.5 max-h-32 overflow-y-auto">
                        {loadedNotes.map((n) => (
                          <li key={n.filename} className="flex gap-2">
                            <span className="font-mono text-gray-400 flex-shrink-0">{n.date}</span>
                            <span className="truncate">{n.title}</span>
                            {n.source !== "obsidian" && (
                              <span className="text-gray-400 flex-shrink-0 italic">{n.sourceLabel}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {loadError && <p className="mt-2 text-sm text-red-600">{loadError}</p>}
            </div>

            <button
              onClick={handleLoadNotes}
              disabled={loading || !settings.vaultPath}
              className="btn-secondary whitespace-nowrap"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Scanning...
                </>
              ) : loadedNotes !== null ? "Re-scan" : "Scan Folder"}
            </button>
          </div>

          {loadedNotes?.length > 0 && !showConfirm && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              {scrubReport.length > 0 && (
                <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 overflow-hidden">
                  <button
                    onClick={() => setScrubOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-orange-800 hover:bg-orange-100 transition-colors"
                  >
                    <span>
                      {restoredIds.size > 0
                        ? `${scrubReport.length - restoredIds.size} of ${scrubReport.length} flagged line${scrubReport.length !== 1 ? "s" : ""} will be scrubbed`
                        : `${scrubReport.length} line${scrubReport.length !== 1 ? "s" : ""} will be scrubbed (keyword filter)`}
                    </span>
                    <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${scrubOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {scrubOpen && (
                    <ul className="divide-y divide-orange-100 max-h-52 overflow-y-auto">
                      {scrubReport.map((item) => (
                        <li key={item.id} className="flex gap-2 items-start px-3 py-1.5">
                          <input
                            type="checkbox"
                            id={`csm-pre-${item.id}`}
                            checked={restoredIds.has(item.id)}
                            onChange={(e) => {
                              const next = new Set(restoredIds);
                              if (e.target.checked) next.add(item.id);
                              else next.delete(item.id);
                              setRestoredIds(next);
                            }}
                            className="mt-0.5 flex-shrink-0 accent-orange-600"
                          />
                          <label htmlFor={`csm-pre-${item.id}`} className="text-xs cursor-pointer leading-relaxed">
                            <span className="font-mono text-orange-500 mr-1">{item.noteDate}</span>
                            <span className="text-orange-700 mr-1 font-medium">{item.noteTitle} —</span>
                            <span className="text-gray-700">{item.line.trim()}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  {scrubOpen && (
                    <p className="px-3 py-1.5 text-xs text-orange-600 border-t border-orange-100">
                      Check a line to keep it — unchecked lines are removed before sending to Claude.
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs text-gray-500 font-medium">Model</span>
                <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
                  {[
                    { id: "claude-haiku-4-5", label: "Haiku", sub: "Faster · 200k" },
                    { id: "claude-sonnet-4-6", label: "Sonnet", sub: "Best · 1M ctx" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={`px-3 py-1.5 text-left transition-colors ${
                        model === m.id ? "bg-obsidian-600 text-white" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <div className="text-xs font-medium leading-tight">{m.label}</div>
                      <div className={`text-xs leading-tight ${model === m.id ? "text-obsidian-200" : "text-gray-400"}`}>{m.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
              {synthError && (
                <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                  {synthError}
                </p>
              )}
              <button
                onClick={() => setShowConfirm(true)}
                disabled={synthesizing}
                className="btn-primary w-full py-3 text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Generate EA Activity Report
              </button>
            </div>
          )}

          {loadedNotes?.length > 0 && showConfirm && (() => {
            const est = estimateUsage(loadedNotes, model);
            const limit = contextLimit(model);
            const warnAt = limit - 20_000;
            return (
              <div className="mt-5 pt-5 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-800">Pre-flight check</h4>
                  <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
                    {[
                      { id: "claude-haiku-4-5", label: "Haiku", sub: "200k" },
                      { id: "claude-sonnet-4-6", label: "Sonnet", sub: "1M" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModel(m.id)}
                        className={`px-3 py-1 text-left transition-colors ${
                          model === m.id ? "bg-obsidian-600 text-white" : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span className="text-xs font-medium">{m.label}</span>
                        <span className={`text-xs ml-1 ${model === m.id ? "text-obsidian-200" : "text-gray-400"}`}>{m.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3 text-sm">
                  <p className="text-xs text-gray-600">
                    Sending <strong>{loadedNotes.length}</strong> notes to Claude to generate an EA Engagement Activity Report table.
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    <span className="text-gray-500">Est. input</span>
                    <span className={`font-mono ${est.inputTokens > warnAt ? "text-red-600 font-semibold" : "text-gray-700"}`}>~{est.inputTokens.toLocaleString()} tokens</span>
                    <span className="text-gray-500">Est. output</span>
                    <span className="font-mono text-gray-700">~{est.outputTokens.toLocaleString()} tokens</span>
                    <span className="text-gray-500">Context limit</span>
                    <span className="font-mono text-gray-700">{(limit / 1000).toLocaleString()}k tokens ({est.label})</span>
                    <span className="text-gray-500">Est. cost</span>
                    <span className="font-mono text-gray-700">~${est.cost.toFixed(4)}</span>
                  </div>
                  {est.inputTokens > warnAt && (
                    <p className="text-xs text-red-700 font-medium">
                      Input is near or over this model's {(limit / 1000).toLocaleString()}k token limit — oldest notes will be trimmed. Switch to Sonnet to include more.
                    </p>
                  )}
                  <p className="text-xs text-amber-700">
                    Names in your glossary are replaced before sending. The table will reference your account correctly.
                  </p>
                </div>
                {scrubReport.length > 0 && (
                  <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 overflow-hidden">
                    <button
                      onClick={() => setScrubOpen((v) => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-orange-800 hover:bg-orange-100 transition-colors"
                    >
                      <span>
                        {restoredIds.size > 0
                          ? `${scrubReport.length - restoredIds.size} of ${scrubReport.length} flagged line${scrubReport.length !== 1 ? "s" : ""} will be scrubbed`
                          : `${scrubReport.length} line${scrubReport.length !== 1 ? "s" : ""} will be scrubbed (keyword filter)`}
                      </span>
                      <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${scrubOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {scrubOpen && (
                      <ul className="divide-y divide-orange-100 max-h-52 overflow-y-auto">
                        {scrubReport.map((item) => (
                          <li key={item.id} className="flex gap-2 items-start px-3 py-1.5">
                            <input
                              type="checkbox"
                              id={`csm-${item.id}`}
                              checked={restoredIds.has(item.id)}
                              onChange={(e) => {
                                const next = new Set(restoredIds);
                                if (e.target.checked) next.add(item.id);
                                else next.delete(item.id);
                                setRestoredIds(next);
                              }}
                              className="mt-0.5 flex-shrink-0 accent-orange-600"
                            />
                            <label htmlFor={`csm-${item.id}`} className="text-xs cursor-pointer leading-relaxed">
                              <span className="font-mono text-orange-500 mr-1">{item.noteDate}</span>
                              <span className="text-orange-700 mr-1 font-medium">{item.noteTitle} —</span>
                              <span className="text-gray-700">{item.line.trim()}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                    {scrubOpen && (
                      <p className="px-3 py-1.5 text-xs text-orange-600 border-t border-orange-100">
                        Check a line to keep it — unchecked lines are removed before sending to Claude.
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-3 mt-3">
                  <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={handleSynthesize} disabled={synthesizing} className="btn-primary flex-1 py-3">
                    {synthesizing ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating…
                      </>
                    ) : "Confirm — Send to Claude"}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {(output || synthesizing) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {synthesizing ? "Generating…" : "EA Activity Report Ready"}
              </h2>
              {synthesizing && (
                <svg className="animate-spin w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </div>
            {!synthesizing && <button onClick={handleReset} className="btn-secondary">Start Over</button>}
          </div>
          {droppedCount > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {droppedCount} older note{droppedCount !== 1 ? "s" : ""} were excluded to stay within the model's context limit.
            </p>
          )}
          {output && (
            <NotesPreview
              notes={output}
              onSave={handleSave}
              saving={saving}
              saved={saved}
              savedPath={savedPath}
              cost={synthCost}
              streaming={synthesizing}
            />
          )}
          {synthesizing && !output && (
            <div className="card p-6 text-sm text-gray-500 animate-pulse">Waiting for Claude…</div>
          )}
        </div>
      )}
    </div>
  );
}
