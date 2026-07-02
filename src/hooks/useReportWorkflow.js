"use client";

import { useEffect, useRef, useState } from "react";
import { detectAccount } from "@/lib/accounts";
import { buildScrubReport } from "@/lib/scrub";
import { reverseReplacements } from "@/lib/sanitize";
import { calcCost } from "@/lib/pricing";

export const TODAY = new Date().toISOString().split("T")[0];

const HISTORY_CAP = 15;

// Shared state + handlers for the three report tabs (Account Status,
// SL Status, EA Activity). Per-tab behavior is injected via options:
//   storageKey       localStorage namespace ("report:status", ...)
//   saveTitle        () => filename title for /api/save
//   filterNotes      (notes, acct) => notes   client-side note filter
//   buildNotesParams (URLSearchParams) => void  extra /api/notes params
//   synthesizeExtras (acct) => object          extra /api/synthesize body
//   loadExtras       async (acct) => any       extra data fetched on scan
//
// The hook also persists the last generated report (and scrub selections)
// to localStorage, keeps partial output when a generation dies mid-stream
// (with append/resume support), and records saved reports into a history
// list the UI can reopen.
export function useReportWorkflow({
  settings,
  storageKey,
  saveTitle,
  filterNotes,
  buildNotesParams,
  synthesizeExtras,
  loadExtras,
}) {
  const [selectedFolder, setSelectedFolder] = useState("");
  const [rawNotes, setRawNotes] = useState(null);
  const [loadedNotes, setLoadedNotes] = useState(null);
  const [loadCounts, setLoadCounts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [extras, setExtras] = useState(null);

  const [synthesizing, setSynthesizing] = useState(false);
  const [synthError, setSynthError] = useState(null);
  const [output, setOutput] = useState("");
  const [partial, setPartial] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedPath, setSavedPath] = useState("");
  const [synthCost, setSynthCost] = useState(null);
  const [droppedCount, setDroppedCount] = useState(0);

  const [scrubReport, setScrubReport] = useState([]);
  const [restoredIds, setRestoredIds] = useState(new Set());
  const [scrubOpen, setScrubOpen] = useState(false);

  const [model, setModel] = useState(settings.model || "claude-haiku-4-5");
  const [history, setHistory] = useState([]);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);

  // Raw (pseudonymized) streamed text — kept for append/resume; `output`
  // holds the display text (names reversed once generation finishes).
  const rawRef = useRef("");
  const hydrated = useRef(false);

  // Restore last session on mount.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (s) {
        if (s.output) {
          setOutput(s.output);
          rawRef.current = s.output;
          setRestoredFromStorage(true);
        }
        if (s.model) setModel(s.model);
        if (s.saved) { setSaved(true); setSavedPath(s.savedPath || ""); }
        if (s.synthCost) setSynthCost(s.synthCost);
        if (s.partial) setPartial(true);
        if (Array.isArray(s.restoredIds)) setRestoredIds(new Set(s.restoredIds));
      }
    } catch {}
    try {
      setHistory(JSON.parse(localStorage.getItem(`${storageKey}:history`) || "[]"));
    } catch {}
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist whenever the durable bits change (not mid-stream).
  useEffect(() => {
    if (!hydrated.current || synthesizing) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        output, model, saved, savedPath, synthCost, partial,
        restoredIds: [...restoredIds],
      }));
    } catch {}
  }, [output, model, saved, savedPath, synthCost, partial, restoredIds, synthesizing, storageKey]);

  function acctCtx() {
    return detectAccount(selectedFolder, settings.accounts);
  }

  function invalidateNotes() {
    setRawNotes(null);
    setLoadedNotes(null);
    setLoadCounts(null);
    setShowConfirm(false);
    setScrubReport([]);
    setExtras(null);
  }

  function selectFolder(f) {
    setSelectedFolder(f);
    invalidateNotes();
    setOutput("");
    rawRef.current = "";
    setPartial(false);
    setSaved(false);
  }

  async function handleLoadNotes() {
    if (!settings.vaultPath) return;
    setLoading(true);
    setLoadError(null);
    invalidateNotes();
    setOutput("");
    rawRef.current = "";
    setPartial(false);
    setSaved(false);
    setScrubOpen(false);

    try {
      const acct = acctCtx();
      const params = new URLSearchParams({ vaultPath: settings.vaultPath });
      if (selectedFolder) params.set("folderPath", selectedFolder);
      if (acct.aliases?.length) params.set("accountAliases", acct.aliases.join(","));
      buildNotesParams?.(params);

      const [notesRes, extraData] = await Promise.all([
        fetch(`/api/notes?${params}`),
        loadExtras ? loadExtras(acct) : Promise.resolve(null),
      ]);
      const data = await notesRes.json();
      if (!notesRes.ok) throw new Error(data.error || "Failed to load notes");

      const kept = filterNotes ? data.notes.filter((n) => filterNotes(n, acct)) : data.notes;
      setRawNotes(data.notes);
      setLoadedNotes(kept);
      setLoadCounts(data.counts);
      setScrubReport(buildScrubReport(kept, acct.name, settings.accounts || []));
      if (extraData) setExtras(extraData);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // opts.append   — continue on top of existing raw output (resume)
  // opts.extraBody — merged into the request body (e.g. resumeRows)
  async function handleSynthesize(opts = {}) {
    if (!loadedNotes?.length) return;
    setSynthesizing(true);
    setSynthError(null);
    setSaved(false);
    setShowConfirm(false);
    setPartial(false);
    if (!opts.append) {
      rawRef.current = "";
      setOutput("");
      setDroppedCount(0);
    }

    const reps = settings.replacements || [];
    let accumulated = opts.append ? rawRef.current + "\n" : "";

    try {
      const acct = acctCtx();
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: loadedNotes,
          apiKey: settings.apiKey || undefined,
          model,
          today: TODAY,
          replacements: reps,
          corrections: settings.corrections || [],
          accountName: acct.name,
          allAccounts: settings.accounts || [],
          restoredIds: [...restoredIds],
          ...(synthesizeExtras ? synthesizeExtras(acct) : {}),
          ...(opts.extraBody || {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Synthesis failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
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
            rawRef.current = accumulated;
            setOutput(accumulated);
          } else if (evt.type === "done") {
            setOutput(reps.length ? reverseReplacements(accumulated, reps) : accumulated);
            if (evt.usage) setSynthCost(calcCost(evt.usage, evt.model));
            if (evt.droppedCount) setDroppedCount(evt.droppedCount);
          } else if (evt.type === "error") {
            throw new Error(evt.message);
          }
        }
      }
    } catch (e) {
      // Keep whatever streamed before the failure — it was paid for.
      if (accumulated.trim()) {
        setPartial(true);
        setOutput(reps.length ? reverseReplacements(accumulated, reps) : accumulated);
        setSynthError(`${e.message} — partial output kept below.`);
      } else {
        setSynthError(e.message);
      }
    } finally {
      setSynthesizing(false);
    }
  }

  async function handleSave(contentOverride) {
    const content = contentOverride ?? output;
    if (!content || !settings.vaultPath) return;
    setSaving(true);
    try {
      const title = typeof saveTitle === "function" ? saveTitle() : saveTitle;
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: content,
          vaultPath: settings.vaultPath,
          folderPath: selectedFolder,
          meetingTitle: title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
      setSavedPath(data.savedPath);

      // Store the display state (not the vault-format override) so reopening
      // an EA Activity report restores the interactive row view.
      const entry = { title: data.filename || title, path: data.savedPath, ts: Date.now(), content: output || content };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, HISTORY_CAP);
        try { localStorage.setItem(`${storageKey}:history`, JSON.stringify(next)); } catch {}
        return next;
      });
    } catch (e) {
      alert(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  function openHistoryItem(item) {
    setOutput(item.content);
    rawRef.current = item.content;
    setSaved(true);
    setSavedPath(item.path);
    setPartial(false);
    setSynthError(null);
    setSynthCost(null);
    setRestoredFromStorage(false);
  }

  function handleReset() {
    invalidateNotes();
    setOutput("");
    rawRef.current = "";
    setPartial(false);
    setSaved(false);
    setSavedPath("");
    setSynthError(null);
    setLoadError(null);
    setSynthCost(null);
    setRestoredIds(new Set());
    setScrubOpen(false);
    setRestoredFromStorage(false);
  }

  return {
    TODAY,
    selectedFolder, selectFolder,
    rawNotes, loadedNotes, loadCounts, loadError, loading, extras,
    showConfirm, setShowConfirm,
    synthesizing, synthError, output, setOutput, partial,
    saving, saved, savedPath, synthCost, droppedCount,
    scrubReport, restoredIds, setRestoredIds, scrubOpen, setScrubOpen,
    model, setModel,
    history, openHistoryItem, restoredFromStorage,
    invalidateNotes, handleLoadNotes, handleSynthesize, handleSave, handleReset,
  };
}
