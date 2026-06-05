"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import SettingsPanel from "@/components/SettingsPanel";
import MeetingDetails from "@/components/MeetingDetails";
import TranscriptInput from "@/components/TranscriptInput";
import FolderSelector from "@/components/FolderSelector";
import NotesPreview from "@/components/NotesPreview";
import AccountStatus from "@/components/AccountStatus";

const DEFAULT_DATE = new Date().toISOString().split("T")[0];

export default function Home() {
  const [mode, setMode] = useState("new"); // "new" | "status"
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ vaultPath: "", apiKey: "" });

  // New note state
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(DEFAULT_DATE);
  const [transcript, setTranscript] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedPath, setSavedPath] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("obsidian-notes-settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings(parsed);
        if (!parsed.vaultPath) setShowSettings(true);
      } else {
        setShowSettings(true);
      }
    } catch {
      setShowSettings(true);
    }
  }, []);

  function handleSaveSettings(newSettings) {
    setSettings(newSettings);
    localStorage.setItem("obsidian-notes-settings", JSON.stringify(newSettings));
    setShowSettings(false);
    setSelectedFolder("");
  }

  function handleTitleSuggest(suggested) {
    if (!meetingTitle) setMeetingTitle(suggested);
  }

  async function handleProcess() {
    if (!transcript.trim()) return;
    setProcessing(true);
    setProcessError(null);
    setNotes("");
    setSaved(false);
    setSavedPath("");
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          meetingTitle,
          meetingDate,
          apiKey: settings.apiKey || undefined,
          model: settings.model || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");
      setNotes(data.notes);
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
          meetingDate,
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

  function handleNewNote() {
    setTranscript("");
    setMeetingTitle("");
    setMeetingDate(DEFAULT_DATE);
    setNotes("");
    setSaved(false);
    setSavedPath("");
    setProcessError(null);
  }

  function handleModeChange(newMode) {
    setMode(newMode);
    setShowSettings(false);
  }

  const canProcess = transcript.trim().length > 0 && !processing;

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
              />
            </div>
          ) : (
            <>
              <MeetingDetails
                meetingTitle={meetingTitle}
                setMeetingTitle={setMeetingTitle}
                meetingDate={meetingDate}
                setMeetingDate={setMeetingDate}
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

              <button
                onClick={handleProcess}
                disabled={!canProcess}
                className="btn-primary w-full py-3.5 text-base"
              >
                {processing ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing transcript with Claude Sonnet...
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
            </>
          )
        )}
      </main>
    </div>
  );
}
