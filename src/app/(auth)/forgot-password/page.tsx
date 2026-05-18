"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Sending..." : "Send reset link"}
    </button>
  );
}

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, null);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Forgot your password?</h2>
      <p className="text-sm text-gray-600 mb-6">
        No worries — enter the email tied to your account and we&apos;ll send you a secure link to set a new one.
      </p>

      {state?.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-emerald-700">
            If an Ora account exists for that email, we&apos;ve sent a reset link. The link expires in 1 hour.
          </p>
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <SubmitButton />
        </form>
      )}

      <p className="mt-4 text-center text-sm text-gray-600">
        Remembered it?{" "}
        <Link href="/login" className="text-indigo-600 hover:underline font-medium">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
