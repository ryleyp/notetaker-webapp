"use client";

import { StepBadge } from "@/components/MeetingDetails";

export default function UserNotesInput({ userNotes, setUserNotes }) {
  const wordCount = userNotes.trim() ? userNotes.trim().split(/\s+/).length : 0;

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <StepBadge n={3} />
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Your Notes <span className="text-xs font-normal text-gray-400">(optional)</span>
          </h2>
          <p className="text-xs text-gray-500">
            Rough bullets you jotted during the meeting — Claude uses them to emphasize what mattered to you
          </p>
        </div>
      </div>

      <textarea
        className="input resize-none text-sm leading-relaxed"
        rows={5}
        placeholder={"- pricing concern on renewal\n- they want a SystemLink demo for the Dallas team\n- follow up on Q3 timeline"}
        value={userNotes}
        onChange={(e) => setUserNotes(e.target.value)}
      />

      {userNotes && (
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">{wordCount.toLocaleString()} words</p>
          <button onClick={() => setUserNotes("")} className="text-xs text-red-500 hover:text-red-700">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
