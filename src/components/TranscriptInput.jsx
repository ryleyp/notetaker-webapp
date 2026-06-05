"use client";

import { useState, useRef, useCallback } from "react";

export default function TranscriptInput({ transcript, setTranscript, meetingTitle, setMeetingTitle, meetingDate, setMeetingDate }) {
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState("paste");
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith("text/") && !file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      alert("Please upload a plain text file (.txt or .md)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setTranscript(e.target.result);
      // Auto-fill title from filename
      if (!meetingTitle) {
        const name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setMeetingTitle(name);
      }
    };
    reader.readAsText(file);
  }, [meetingTitle, setMeetingTitle, setTranscript]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  return (
    <div className="card p-6 space-y-4">
      <h2 className="section-header">Meeting Details</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Meeting Title</label>
          <input
            type="text"
            className="input"
            placeholder="Q3 Product Review"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Meeting Date</label>
          <input
            type="date"
            className="input"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Transcript</label>

        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setActiveTab("paste")}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              activeTab === "paste"
                ? "bg-obsidian-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Paste Text
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              activeTab === "upload"
                ? "bg-obsidian-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Upload File
          </button>
        </div>

        {activeTab === "paste" ? (
          <textarea
            className="input resize-none font-mono text-xs leading-relaxed"
            rows={12}
            placeholder="Paste your meeting transcript here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 cursor-pointer transition-colors ${
              isDragging
                ? "border-obsidian-400 bg-obsidian-50"
                : "border-gray-300 hover:border-obsidian-400 hover:bg-gray-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {transcript ? (
              <div className="text-center">
                <p className="text-sm font-medium text-green-600">File loaded!</p>
                <p className="text-xs text-gray-500 mt-1">{wordCount.toLocaleString()} words</p>
                <p className="text-xs text-gray-400 mt-1">Click to replace</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Drop your transcript here</p>
                <p className="text-xs text-gray-500 mt-1">or click to browse — .txt or .md files</p>
              </div>
            )}
          </div>
        )}

        {transcript && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500">{wordCount.toLocaleString()} words</p>
            <button
              onClick={() => setTranscript("")}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
