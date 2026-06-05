"use client";

export default function MeetingDetails({ meetingTitle, setMeetingTitle, meetingDate, setMeetingDate }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <StepBadge n={1} />
        <div>
          <h2 className="text-base font-semibold text-gray-900">Meeting Details</h2>
          <p className="text-xs text-gray-500">Give your notes a title and date</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Meeting Title</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Q3 Product Review"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            autoFocus
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

      {meetingTitle && (
        <p className="mt-3 text-xs text-gray-400">
          File will be saved as{" "}
          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            {meetingDate} - {meetingTitle}.md
          </span>
        </p>
      )}
    </div>
  );
}

export function StepBadge({ n }) {
  return (
    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-obsidian-600 text-white text-sm font-bold flex items-center justify-center">
      {n}
    </span>
  );
}
