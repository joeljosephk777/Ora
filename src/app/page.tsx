import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold text-gray-900 tracking-tight">Ora</h1>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          AI-powered comprehension checks for CS courses. Verify that students understand the code they submit — at scale.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 bg-white text-indigo-600 text-sm font-medium rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
          >
            Sign up
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-center text-sm font-medium text-gray-500 uppercase tracking-wide mb-8">
          How it works
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-xs font-medium text-indigo-600 mb-2">Step 1 — Professor</div>
            <h3 className="font-semibold text-gray-900">Set up the assignment</h3>
            <p className="mt-2 text-sm text-gray-600">
              Upload the assignment, rubric, and guiding questions you want students to answer.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-xs font-medium text-indigo-600 mb-2">Step 2 — Student</div>
            <h3 className="font-semibold text-gray-900">Submit code, walk through it</h3>
            <p className="mt-2 text-sm text-gray-600">
              Students submit their code and complete a short AI chat interview about how it works.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-xs font-medium text-indigo-600 mb-2">Step 3 — TA / Professor</div>
            <h3 className="font-semibold text-gray-900">Review and grade</h3>
            <p className="mt-2 text-sm text-gray-600">
              Read the transcript and AI-suggested score, then assign the final grade. Humans stay in the loop.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-6 text-center text-sm text-gray-500">
          Built for UW CS courses.
        </div>
      </footer>
    </main>
  );
}
