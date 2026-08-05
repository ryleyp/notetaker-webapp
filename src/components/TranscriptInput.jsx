"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { StepBadge } from "@/components/MeetingDetails";
import { apiFetch } from "@/lib/apiClient";
import { combineSources } from "@/lib/transcriptSources";

let nextSourceId = 1;
function newSource(label = "") {
  return { id: `src-${nextSourceId++}`, label, text: "" };
}

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export default function TranscriptInput({ transcript, setTranscript, onTitleSuggest }) {
  // Multiple recordings of the same meeting (e.g. Teams + a voice memo) are
  // held separately here and combined into the single transcript string the
  // rest of the pipeline consumes.
  const [sources, setSources] = useState(() => [newSource()]);
  const [isDragging, setIsDragging] = useState(null); // source id being dragged over
  const [waitingFor, setWaitingFor] = useState(null); // source id awaiting a voice memo
  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);
  const pollRef = useRef(null);

  // Push the combined document upward whenever any source changes.
  useEffect(() => {
    setTranscript(combineSources(sources));
  }, [sources, setTranscript]);

  // If the transcript is cleared or replaced from outside (New Note, or the
  // speaker-detection flow rewriting it), fold it back into a single source.
  useEffect(() => {
    setSources((prev) => {
      if (combineSources(prev) === transcript) return prev;
      if (!transcript) return [newSource()];
      const single = newSource(prev[0]?.label || "");
      single.text = transcript;
      return [single];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  const updateSource = useCallback((id, patch) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const addSource = () => {
    setSources((prev) => {
      // Suggest labels only once a second source exists, so they're distinguishable.
      const first = prev.length === 1 && !prev[0].label.trim()
        ? [{ ...prev[0], label: "Teams transcript" }]
        : prev;
      return [...first, newSource(prev.length === 1 ? "Voice memo" : "")];
    });
  };

  const removeSource = (id) => {
    setSources((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
    if (waitingFor === id) stopWaiting();
  };

  const handleFile = useCallback((file, sourceId) => {
    if (!file) return;
    if (!file.type.startsWith("text/") && !file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      alert("Please upload a plain text file (.txt or .md)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? { ...s, text: e.target.result, label: s.label || name } : s))
      );
      // Only the first source suggests the meeting title.
      setSources((prev) => {
        if (prev[0]?.id === sourceId && onTitleSuggest) onTitleSuggest(name);
        return prev;
      });
    };
    reader.readAsText(file);
  }, [onTitleSuggest]);

  function startWaiting(sourceId) {
    setWaitingFor(sourceId);
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch("/api/receive-transcript");
        const data = await res.json();
        if (data.pending) {
          stopWaiting();
          setSources((prev) =>
            prev.map((s) =>
              s.id === sourceId ? { ...s, text: data.transcript, label: s.label || "Voice memo" } : s
            )
          );
          if (data.title && onTitleSuggest) onTitleSuggest(data.title);
        }
      } catch {}
    }, 1500);
  }

  function stopWaiting() {
    setWaitingFor(null);
    clearInterval(pollRef.current);
    pollRef.current = null;
  }

  useEffect(() => () => clearInterval(pollRef.current), []);

  const multi = sources.length > 1;
  const totalWords = countWords(transcript);

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <StepBadge n={2} />
        <div>
          <h2 className="text-base font-semibold text-gray-900">Meeting Transcript</h2>
          <p className="text-xs text-gray-500">
            Paste, upload, or import from Voice Memos. Have two recordings of the same meeting?
            Add both — they'll be merged into one set of notes.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,text/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files[0], uploadTargetRef.current);
          e.target.value = "";
        }}
      />

      <div className="space-y-3">
        {sources.map((source, i) => {
          const words = countWords(source.text);
          const waiting = waitingFor === source.id;
          return (
            <div
              key={source.id}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(null);
                handleFile(e.dataTransfer.files[0], source.id);
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(source.id); }}
              onDragLeave={() => setIsDragging(null)}
              className={`rounded-lg border transition-colors ${
                isDragging === source.id ? "border-obsidian-400 bg-obsidian-50" : "border-gray-200"
              } ${multi ? "p-3" : "p-0 border-0"}`}
            >
              {multi && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium flex items-center justify-center">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={source.label}
                    onChange={(e) => updateSource(source.id, { label: e.target.value })}
                    placeholder="Where this came from (e.g. Teams transcript)"
                    className="input flex-1 text-xs py-1"
                  />
                  <span className="text-xs text-gray-400 whitespace-nowrap">{words.toLocaleString()} words</span>
                  <button
                    onClick={() => removeSource(source.id)}
                    title="Remove this source"
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <textarea
                className="input resize-y font-mono text-xs leading-relaxed"
                rows={multi ? 8 : 14}
                placeholder={
                  i === 0
                    ? "Paste your meeting transcript here, drop a .txt/.md file, or use the buttons below..."
                    : "Paste the second transcript of this same meeting..."
                }
                value={source.text}
                onChange={(e) => updateSource(source.id, { text: e.target.value })}
              />

              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={() => { uploadTargetRef.current = source.id; fileInputRef.current?.click(); }}
                  className="text-xs text-gray-500 hover:text-obsidian-600"
                >
                  Upload file
                </button>
                {waiting ? (
                  <span className="flex items-center gap-1.5 text-xs text-obsidian-600">
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Waiting for Voice Memo — run your Shortcut
                    <button onClick={stopWaiting} className="text-gray-400 hover:text-gray-600 underline ml-1">
                      cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => startWaiting(source.id)}
                    disabled={waitingFor !== null}
                    className="text-xs text-gray-500 hover:text-obsidian-600 disabled:opacity-40"
                  >
                    Import Voice Memo
                  </button>
                )}
                {!multi && words > 0 && (
                  <span className="text-xs text-gray-400 ml-auto">{words.toLocaleString()} words</span>
                )}
                {source.text && (
                  <button
                    onClick={() => updateSource(source.id, { text: "" })}
                    className={`text-xs text-red-500 hover:text-red-700 ${multi ? "ml-auto" : ""}`}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3">
        <button onClick={addSource} className="btn-secondary text-xs">
          + Add another recording of this meeting
        </button>
        {multi && (
          <span className="text-xs text-gray-400">
            {sources.length} sources · {totalWords.toLocaleString()} words total → one merged note
          </span>
        )}
      </div>
    </div>
  );
}
