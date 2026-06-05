"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import SettingsPanel from "@/components/SettingsPanel";
import TranscriptInput from "@/components/TranscriptInput";
import FolderSelector from "@/components/FolderSelector";
import NotesPreview from "@/components/NotesPreview";

const DEFAULT_DATE = new Date().toISOString().split("T")[0];

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ vaultPath: "", apiKey: "" });

  const [transcript, setTranscript] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(DEFAULT_DATE);
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
    // Reset folder selection when vault path changes
    setSelectedFolder("");
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

  const canProcess = transcript.trim().length > 0 && !processing;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onSettingsClick={() => setShowSettings((v) => !v)} isSettingsOpen={showSettings} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {showSettings && (
          <SettingsPanel
            settings={settings}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
          />
        )}

        {!showSettings && !settings.vaultPath && (
          <div className="card p-6 border-l-4 border-l-amber-400">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">Setup required</p>
                <p className="text-sm text-amber-700 mt-1">
                  Open Settings to configure your Obsidian vault path and Anthropic API key before getting started.
                </p>
              </div>
            </div>
          </div>
        )}

        {notes ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Your Meeting Notes are Ready</h2>
              <button onClick={handleNewNote} className="btn-secondary">
                New Note
              </button>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <TranscriptInput
                transcript={transcript}
                setTranscript={setTranscript}
                meetingTitle={meetingTitle}
                setMeetingTitle={setMeetingTitle}
                meetingDate={meetingDate}
                setMeetingDate={setMeetingDate}
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
                className="btn-primary w-full py-3 text-base"
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
            </div>

            <div className="space-y-6">
              <FolderSelector
                vaultPath={settings.vaultPath}
                selectedFolder={selectedFolder}
                onSelect={setSelectedFolder}
              />

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes will include</h3>
                <ul className="space-y-2">
                  {[
                    "Executive Summary",
                    "Detailed Meeting Notes",
                    "NI SW Customer Success Takeaways",
                    "Action Items",
                    "Next Steps",
                  ].map((section, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-obsidian-100 text-obsidian-700 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      {section}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
