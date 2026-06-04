import { signInWithGoogle } from "@/lib/actions/auth";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  oauth: "Google sign-in could not be completed. Try again.",
  uw_only: "Ora is limited to UW Google accounts. Sign in with your UW NetID account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? error : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Sign in with UW</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        Ora is for UW courses. Use your UW Google account, then choose whether you are joining as a student or professor.
      </p>

      {errorMessage && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <form action={signInWithGoogle} className="mt-6">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
        >
          <span className="text-base font-semibold text-blue-600">G</span>
          Sign in with UW Google
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-600">
        New to Ora?{" "}
        <Link href="/signup" className="font-medium text-indigo-600 hover:underline">
          Start with UW Google
        </Link>
      </p>
    </div>
  );
}
