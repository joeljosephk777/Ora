import { signInWithGoogle } from "@/lib/actions/auth";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Create your Ora account</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        Accounts are created through UW Google sign-in. After sign-in, Ora will ask whether you are a student or professor.
      </p>

      <form action={signInWithGoogle} className="mt-6">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
        >
          <span className="text-base font-semibold text-blue-600">G</span>
          Continue with UW Google
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-600">
        Already signed up?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
