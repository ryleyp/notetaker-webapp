"use client";

import { useState } from "react";
import FolderSelector from "@/components/FolderSelector";
import NotesPreview from "@/components/NotesPreview";
import { calcCost } from "@/lib/pricing";
import { detectAccount } from "@/lib/accounts";

const TODAY = new Date().toISOString().split("T")[0];

function threeMonthsAgoLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function AccountStatus({ settings, onSettingsClick }) {
  const [selectedFolder, setSelectedFolder] = useState("");
  const [loadedNotes, setLoadedNotes] = useState(null); // null = not loaded yet
  const [loadCounts, setLoadCounts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [synthesizing, setSynthesizing] = useState(false);
  const [synthError, setSynthError] = useState(null);
  const [output, setOutput] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedPath, setSavedPath] = useState("");
  const [synthCost, setSynthCost] = useState(null);

  async function handleLoadNotes() {
    if (!settings.vaultPath) return;
    setLoading(true);
    setLoadError(null);
    setLoadedNotes(null);
    setLoadCounts(null);
    setOutput("");
    setSaved(false);

    try {
      const { aliases, archiveFolder } = detectAccount(selectedFolder, settings.accounts);
      const params = new URLSearchParams({ vaultPath: settings.vaultPath });
      if (selectedFolder) params.set("folderPath", selectedFolder);
      if (settings.transcriptsPath && archiveFolder) {
        params.set("transcriptsPath", settings.transcriptsPath);
        params.set("accountFolder", archiveFolder);
      }
      if (aliases?.length) params.set("accountAliases", aliases.join(","));
      const res = await fetch(`/api/notes?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load notes");
      setLoadedNotes(data.notes);
      setLoadCounts(data.counts);
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

    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: loadedNotes,
          apiKey: settings.apiKey || undefined,
          model: settings.model || undefined,
          today: TODAY,
          replacements: settings.replacements || [],
          corrections: settings.corrections || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Synthesis failed");
      setOutput(data.output);
      if (data.usage) setSynthCost(calcCost(data.usage, data.model));
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
          meetingTitle: `Account Status ${TODAY}`,
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
  }

  const folderLabel = selectedFolder || "(Vault root)";

  return (
    <div className="space-y-4">
      {/* Folder picker */}
      <FolderSelector
        vaultPath={settings.vaultPath}
        selectedFolder={selectedFolder}
        onSelect={(f) => { setSelectedFolder(f); setLoadedNotes(null); setOutput(""); }}
        onSettingsClick={onSettingsClick}
      />

      {/* Date range info + load */}
      {settings.vaultPath && !output && (
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">Quarter Range</h3>
              <p className="text-sm text-gray-500">
                Scanning <span className="font-medium text-gray-700">{folderLabel}</span> for notes dated{" "}
                <span className="font-medium text-gray-700">{threeMonthsAgoLabel()}</span> or later.
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
                          {loadCounts.transcripts > 0 && <span>🎙 {loadCounts.transcripts} Transcripts</span>}
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

              {loadError && (
                <p className="mt-2 text-sm text-red-600">{loadError}</p>
              )}
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
              ) : loadedNotes !== null ? (
                "Re-scan"
              ) : (
                "Scan Folder"
              )}
            </button>
          </div>

          {/* Synthesize button */}
          {loadedNotes?.length > 0 && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              {synthError && (
                <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                  {synthError}
                </p>
              )}
              <button
                onClick={handleSynthesize}
                disabled={synthesizing}
                className="btn-primary w-full py-3 text-base"
              >
                {synthesizing ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Synthesizing {loadedNotes.length} notes with Claude Sonnet...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Generate Account Status
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Output preview */}
      {output && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Account Status Ready</h2>
            <button onClick={handleReset} className="btn-secondary">
              Start Over
            </button>
          </div>
          <NotesPreview
            notes={output}
            onSave={handleSave}
            saving={saving}
            saved={saved}
            savedPath={savedPath}
            cost={synthCost}
          />
        </div>
      )}
    </div>
  );
}
