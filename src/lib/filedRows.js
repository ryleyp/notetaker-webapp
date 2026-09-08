// "Filed in SFDC" memory. Rows are regenerated every time a report is run,
// so filed state can't live in the row data — it's keyed on the row's stable
// identity (date + title) and persisted separately. Running Q4 twice then
// shows which activities you already logged instead of a fresh identical list.

import { rowKey } from "@/lib/activityRows";

const KEY = "report:ea-activity:filed";

export function loadFiled() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

export function saveFiled(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {}
}

export function isFiled(set, row) {
  return set.has(rowKey(row));
}

export function toggleFiled(set, row) {
  const next = new Set(set);
  const k = rowKey(row);
  if (next.has(k)) next.delete(k);
  else next.add(k);
  saveFiled(next);
  return next;
}
