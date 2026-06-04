"use client";

import { selectRole } from "@/lib/actions/auth";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving role..." : "Continue"}
    </button>
  );
}

export default function RoleSelectionForm({
  defaultName,
  professorAllowed,
}: {
  defaultName: string;
  professorAllowed: boolean;
}) {
  const [state, action] = useActionState(selectRole, null);

  return (
    <form action={action} className="mt-6 space-y-5">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Full name</label>
        <input
          name="full_name"
          type="text"
          required
          defaultValue={defaultName}
          autoComplete="name"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-gray-700">I am joining as</legend>
        <div className="grid gap-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50">
            <input name="role" type="radio" value="student" required className="mt-1" />
            <span>
              <span className="block text-sm font-medium text-gray-900">Student</span>
              <span className="mt-1 block text-sm text-gray-600">Submit code and complete Ora interviews.</span>
            </span>
          </label>

          <label
            className={`flex items-start gap-3 rounded-lg border p-4 ${
              professorAllowed
                ? "cursor-pointer border-gray-200 bg-white transition-colors hover:bg-gray-50"
                : "cursor-not-allowed border-gray-200 bg-gray-50 opacity-70"
            }`}
          >
            <input
              name="role"
              type="radio"
              value="professor"
              required
              disabled={!professorAllowed}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">Professor / Instructor</span>
              <span className="mt-1 block text-sm text-gray-600">
                Create assignments and review student comprehension reports.
              </span>
              {!professorAllowed && (
                <span className="mt-2 block text-xs text-amber-700">
                  Professor access must be approved for this UW account.
                </span>
              )}
            </span>
          </label>
        </div>
      </fieldset>

      <SubmitButton />
    </form>
  );
}
