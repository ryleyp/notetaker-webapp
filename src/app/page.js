"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import SettingsPanel from "@/components/SettingsPanel";
import MeetingDetails from "@/components/MeetingDetails";
import TranscriptInput from "@/components/TranscriptInput";
import FolderSelector from "@/components/FolderSelector";
import NotesPreview from "@/components/NotesPreview";
import AccountStatus from "@/components/AccountStatus";
import SanitizeReview from "@/components/SanitizeReview";
import { applyReplacements, reverseReplacements, assignAliases } from "@/lib/sanitize";
import { calcCost, formatCost } from "@/lib/pricing";

export default function Home() {
  const [mode, setMode] = useState("new");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ vaultPath: "", transcriptsPath: "/Users/ryleypriddy/Documents/Claude", apiKey: "", replacements: [] });

  // New note state
  const [meetingTitle, setMeetingTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [model, setModel] = useState("claude-haiku-4-5");

  // Sanitization state
  const [sanitizing, setSanitizing] = useState(false);
  const [pendingReview, setPendingReview] = useState(null); // null | detected[]
  const [pendingAction, setPendingAction] = useState("generate"); // "generate" | "saveTranscript"
  const [activeReplacements, setActiveReplacements] = useState([]);

  // Generation state
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedPath, setSavedPath] = useState("");
  const [todosSaved, setTodosSaved] = useState(null); // { count, path } | null
  const [noteCost, setNoteCost] = useState(null);
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [transcriptSaved, setTranscriptSaved] = useState(false);
  const [transcriptSavedPath, setTranscriptSavedPath] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("obsidian-notes-settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ replacements: [], transcriptsPath: "/Users/ryleypriddy/Documents/Claude", ...parsed });
        if (parsed.model) setModel(parsed.model);
        if (!parsed.vaultPath) setShowSettings(true);
      } else {
        setShowSettings(true);
      }
    } catch {
      setShowSettings(true);
    }
  }, []);

  function handleSaveSettings(newSettings) {
    setSettings({ replacements: [], ...newSettings });
    localStorage.setItem("obsidian-notes-settings", JSON.stringify(newSettings));
    setShowSettings(false);
    setSelectedFolder("");
  }

  function handleTitleSuggest(suggested) {
    if (!meetingTitle) setMeetingTitle(suggested);
  }

  // Shared: detect entities, show review card, then route to action
  async function runSanitizeDetection(action) {
    const savedReplacements = settings.replacements || [];
    const knownTerms = savedReplacements.map((r) => r.original);
    setSanitizing(true);
    setPendingAction(action);

    let newEntities = [];
    try {
      const res = await fetch("/api/sanitize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, apiKey: settings.apiKey || undefined, knownTerms }),
      });
      const data = await res.json();
      newEntities = data.entities || [];
    } catch {
      // Detection failed — proceed without it
    }

    setSanitizing(false);

    if (newEntities.length > 0) {
      const detected = assignAliases(newEntities, savedReplacements);
      setPendingReview(detected);
    } else {
      if (action === "generate") await doGenerate(savedReplacements);
      else await doSaveTranscript(savedReplacements);
    }
  }

  async function handleProcess() {
    if (!transcript.trim()) return;
    setProcessError(null);
    setNotes("");
    setSaved(false);
    setSavedPath("");
    setPendingReview(null);
    await runSanitizeDetection("generate");
  }

  async function handleSaveTranscriptButton() {
    if (!transcript.trim() || !settings.vaultPath) return;
    setTranscriptSaved(false);
    setTranscriptSavedPath("");
    setPendingReview(null);
    await runSanitizeDetection("saveTranscript");
  }

  // Step 2: user confirms review
  async function handleReviewConfirm(confirmed, toSave) {
    let updatedSettings = settings;

    if (toSave.length > 0) {
      const newReplacements = [
        ...(settings.replacements || []),
        ...toSave.map((r) => ({ original: r.text, alias: r.alias, restored: r.restored || r.text })),
      ];
      updatedSettings = { ...settings, replacements: newReplacements };
      setSettings(updatedSettings);
      localStorage.setItem("obsidian-notes-settings", JSON.stringify(updatedSettings));
    }

    setPendingReview(null);

    const all = [
      ...(updatedSettings.replacements || []),
      ...confirmed
        .filter((c) => !(updatedSettings.replacements || []).some((r) => r.original === c.text))
        .map((c) => ({ original: c.text, alias: c.alias, restored: c.restored || c.text })),
    ];

    if (pendingAction === "generate") await doGenerate(all);
    else await doSaveTranscript(all);
  }

  function handleReviewSkip() {
    setPendingReview(null);
    const replacements = settings.replacements || [];
    if (pendingAction === "generate") doGenerate(replacements);
    else doSaveTranscript(replacements);
  }

  // Step 3: sanitize + generate
  async function doGenerate(replacements) {
    setActiveReplacements(replacements);
    const sanitizedTranscript = replacements.length
      ? applyReplacements(transcript, replacements)
      : transcript;

    setProcessing(true);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: sanitizedTranscript,
          meetingTitle,
          apiKey: settings.apiKey || undefined,
          model,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Processing failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        // Strip usage footer while streaming so it doesn't flash on screen
        const usageIdx = full.indexOf("\n__USAGE__");
        setNotes(usageIdx !== -1 ? full.slice(0, usageIdx) : full);
      }
      // Extract usage footer
      const usageIdx = full.indexOf("\n__USAGE__");
      if (usageIdx !== -1) {
        try {
          const usage = JSON.parse(full.slice(usageIdx + 10));
          setNoteCost(calcCost(usage, model));
        } catch {}
        full = full.slice(0, usageIdx);
      }
      // Restore real names after stream completes
      if (replacements.length) full = reverseReplacements(full, replacements);
      setNotes(full);

      // Archive corrected transcript (best-effort, silent)
      if (settings.transcriptsPath) {
        const correctedTranscript = replacements.length
          ? reverseReplacements(applyReplacements(transcript, replacements), replacements)
          : transcript;
        fetch("/api/save-transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: correctedTranscript,
            meetingTitle,
            transcriptsPath: settings.transcriptsPath,
            folder: selectedFolder || undefined,
          }),
        }).catch(() => {});
      }
    } catch (e) {
      setProcessError(e.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleSave() {
    if (!notes || !settings.vaultPath) return;
    setSaving(true);
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          vaultPath: settings.vaultPath,
          folderPath: selectedFolder,
          meetingTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
      setSavedPath(data.savedPath);

      // Extract todos assigned to Ryley/Riley and append to weekly file
      try {
        const todosRes = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes, vaultPath: settings.vaultPath, meetingTitle }),
        });
        const todosData = await todosRes.json();
        if (todosData.count > 0) {
          setTodosSaved({ count: todosData.count, path: todosData.savedPath });
        }
      } catch {
        // Todos extraction is best-effort
      }
    } catch (e) {
      alert(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function doSaveTranscript(replacements) {
    if (!transcript.trim() || !settings.vaultPath) return;
    const corrected = replacements.length
      ? reverseReplacements(applyReplacements(transcript, replacements), replacements)
      : transcript;

    setSavingTranscript(true);
    try {
      const title = meetingTitle || "Transcript";
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `# ${title}\n\n${corrected}`,
          vaultPath: settings.vaultPath,
          folderPath: selectedFolder,
          meetingTitle: title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setTranscriptSaved(true);
      setTranscriptSavedPath(data.savedPath);

      if (settings.transcriptsPath) {
        fetch("/api/save-transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: corrected,
            meetingTitle: title,
            transcriptsPath: settings.transcriptsPath,
            folder: selectedFolder || undefined,
          }),
        }).catch(() => {});
      }
    } catch (e) {
      alert(`Failed to save transcript: ${e.message}`);
    } finally {
      setSavingTranscript(false);
    }
  }

  function handleNewNote() {
    setTranscript("");
    setMeetingTitle("");
    setNotes("");
    setSaved(false);
    setSavedPath("");
    setTodosSaved(null);
    setNoteCost(null);
    setProcessError(null);
    setPendingReview(null);
    setActiveReplacements([]);
    setTranscriptSaved(false);
    setTranscriptSavedPath("");
  }

  function handleModeChange(newMode) {
    setMode(newMode);
    setShowSettings(false);
  }

  const canProcess = transcript.trim().length > 0 && !processing && !sanitizing;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onSettingsClick={() => setShowSettings((v) => !v)}
        isSettingsOpen={showSettings}
        mode={mode}
        onModeChange={handleModeChange}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {showSettings && (
          <SettingsPanel
            settings={settings}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* ── Account Status mode ── */}
        {mode === "status" && (
          <AccountStatus
            settings={settings}
            onSettingsClick={() => setShowSettings(true)}
          />
        )}

        {/* ── New Note mode ── */}
        {mode === "new" && (
          notes ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Meeting Notes Ready</h2>
                <button onClick={handleNewNote} className="btn-secondary">New Note</button>
              </div>
              <NotesPreview
                notes={notes}
                onSave={handleSave}
                saving={saving}
                saved={saved}
                savedPath={savedPath}
                streaming={processing}
                todosSaved={todosSaved}
                cost={noteCost}
              />
            </div>
          ) : (
            <>
              <MeetingDetails
                meetingTitle={meetingTitle}
                setMeetingTitle={setMeetingTitle}
              />

              <TranscriptInput
                transcript={transcript}
                setTranscript={setTranscript}
                onTitleSuggest={handleTitleSuggest}
              />

              <FolderSelector
                vaultPath={settings.vaultPath}
                selectedFolder={selectedFolder}
                onSelect={setSelectedFolder}
                onSettingsClick={() => setShowSettings(true)}
              />

              {pendingReview && (
                <SanitizeReview
                  detected={pendingReview}
                  savedReplacements={settings.replacements || []}
                  onConfirm={handleReviewConfirm}
                  onSkip={handleReviewSkip}
                />
              )}

              {processError && (
                <div className="card p-4 border-l-4 border-l-red-400">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-800">Error</p>
                      <p className="text-sm text-red-700 mt-0.5">{processError}</p>
                    </div>
                  </div>
                </div>
              )}

              {!pendingReview && (
                <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden flex-shrink-0">
                    {[
                      { id: "claude-haiku-4-5", label: "Haiku", sub: "~$0.03" },
                      { id: "claude-sonnet-4-6", label: "Sonnet", sub: "~$0.10" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModel(m.id)}
                        className={`px-3 py-2 text-left transition-colors ${
                          model === m.id ? "bg-obsidian-600 text-white" : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-xs font-medium leading-tight">{m.label}</div>
                        <div className={`text-xs leading-tight ${model === m.id ? "text-obsidian-200" : "text-gray-400"}`}>{m.sub}</div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleProcess}
                    disabled={!canProcess}
                    className="btn-primary flex-1 py-3.5 text-base"
                  >
                    {sanitizing ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Scanning for sensitive terms...
                      </>
                    ) : processing ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analyzing with Claude {model.includes("haiku") ? "Haiku" : "Sonnet"}...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Generate Meeting Notes
                      </>
                    )}
                  </button>
                </div>

                {/* Save transcript only */}
                <div className="flex items-center justify-end gap-2 min-h-[1.5rem]">
                  {transcriptSaved ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Transcript saved to <code className="font-mono bg-green-50 px-1 rounded">{transcriptSavedPath}</code>
                    </span>
                  ) : (
                    <button
                      onClick={handleSaveTranscriptButton}
                      disabled={savingTranscript || sanitizing || !transcript.trim() || !settings.vaultPath}
                      className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed underline underline-offset-2"
                    >
                      {savingTranscript ? "Saving..." : sanitizing && pendingAction === "saveTranscript" ? "Scanning for names..." : "Save transcript without generating notes"}
                    </button>
                  )}
                </div>
                </div>
              )}
            </>
          )
        )}
      </main>
    </div>
  );
}
