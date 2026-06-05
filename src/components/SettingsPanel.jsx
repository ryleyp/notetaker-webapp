"use client";

import { useState } from "react";

export default function SettingsPanel({ settings, onSave, onClose }) {
  const [form, setForm] = useState({
    vaultPath: settings.vaultPath || "",
    apiKey: settings.apiKey || "",
    model: settings.model || "claude-haiku-4-5",
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setTestResult(null);
  }

  async function handleTestVault() {
    if (!form.vaultPath.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/folders?vaultPath=${encodeURIComponent(form.vaultPath.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setTestResult({ ok: true, message: `Found ${data.folders.length} folders in vault.` });
      } else {
        setTestResult({ ok: false, message: data.error });
      }
    } catch {
      setTestResult({ ok: false, message: "Could not connect to server." });
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    onSave({
      vaultPath: form.vaultPath.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model,
    });
  }

  return (
    <div className="card p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="section-header mb-0">Settings</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="label">Obsidian Vault Path</label>
          <p className="text-xs text-gray-500 mb-2">
            The full path to your Obsidian vault folder on your machine. Example:{" "}
            <code className="bg-gray-100 px-1 rounded">/Users/yourname/Documents/MyVault</code>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="/Users/yourname/Documents/MyVault"
              value={form.vaultPath}
              onChange={(e) => handleChange("vaultPath", e.target.value)}
            />
            <button
              className="btn-secondary whitespace-nowrap"
              onClick={handleTestVault}
              disabled={testing || !form.vaultPath.trim()}
            >
              {testing ? "Testing..." : "Test Path"}
            </button>
          </div>
          {testResult && (
            <p className={`mt-2 text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
              {testResult.ok ? "✓ " : "✗ "}
              {testResult.message}
            </p>
          )}
        </div>

        <div>
          <label className="label">Anthropic API Key</label>
          <p className="text-xs text-gray-500 mb-2">
            Your API key from{" "}
            <span className="font-medium">console.anthropic.com</span>. Stored only in your browser session.
            Alternatively, set <code className="bg-gray-100 px-1 rounded">ANTHROPIC_API_KEY</code> in{" "}
            <code className="bg-gray-100 px-1 rounded">.env.local</code>.
          </p>
          <input
            type="password"
            className="input"
            placeholder="sk-ant-..."
            value={form.apiKey}
            onChange={(e) => handleChange("apiKey", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Claude Model</label>
          <p className="text-xs text-gray-500 mb-2">
            Sonnet is more accurate; Haiku is ~3× cheaper (~$0.03/transcript vs ~$0.10).
          </p>
          <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden w-fit">
            {[
              { id: "claude-sonnet-4-6", label: "Sonnet 4.6", sub: "Best quality" },
              { id: "claude-haiku-4-5", label: "Haiku 4.5", sub: "3× cheaper" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleChange("model", m.id)}
                className={`px-4 py-2 text-left transition-colors ${
                  form.model === m.id
                    ? "bg-obsidian-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div className="text-xs font-medium">{m.label}</div>
                <div className={`text-xs ${form.model === m.id ? "text-obsidian-200" : "text-gray-400"}`}>{m.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
