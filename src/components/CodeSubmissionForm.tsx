"use client";

import { submitCodeAndStartSession } from "@/lib/actions/studentSessions";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  assignmentId: string;
  initialCode?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Starting..." : "Start interview"}
    </button>
  );
}

export default function CodeSubmissionForm({ assignmentId, initialCode = "" }: Props) {
  const [state, action] = useActionState(submitCodeAndStartSession.bind(null, assignmentId), null);
  const [code, setCode] = useState(initialCode);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadFile(file: File) {
    setFileError(null);
    setFileName(file.name);

    if (file.size > 300_000) {
      setFileError("That file is a bit large for the MVP. Paste the important parts instead.");
      return;
    }

    try {
      const text = await file.text();
      setCode(text);
    } catch {
      setFileError("Could not read that file. Try pasting the code instead.");
    }
  }

  return (
    <form action={action} className="space-y-5">
      {(state?.error || fileError) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state?.error ?? fileError}
        </div>
      )}

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.24)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label htmlFor="code" className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Submitted code
            </label>
            <p className="mt-2 text-sm text-slate-600">
              Paste your implementation or load a local source file before starting the interview.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.swift,.kt,.sql,.html,.css,.json,.md"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Load file
            </button>
          </div>
        </div>

        {fileName && (
          <p className="mt-3 text-xs text-slate-500">
            Loaded {fileName}
          </p>
        )}

        <textarea
          id="code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          rows={18}
          spellCheck={false}
          className="mt-4 w-full rounded-2xl border border-slate-300 bg-slate-950 px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          placeholder="Paste your code here..."
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {code.trim().length.toLocaleString()} characters ready for Ora.
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
