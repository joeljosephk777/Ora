"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updatePassword } from "@/lib/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Updating..." : "Update password"}
    </button>
  );
}

export default function ResetPasswordPage() {
  const [state, action] = useActionState(updatePassword, null);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Choose a new password</h2>
      <p className="text-sm text-gray-600 mb-6">
        Pick something you&apos;ll remember. Minimum 6 characters.
      </p>

      {state?.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
          <input
            name="confirm"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <SubmitButton />
      </form>

      <p className="mt-6 text-xs text-gray-500 text-center">
        Once you save, you&apos;ll be signed in automatically.
      </p>
    </div>
  );
}
