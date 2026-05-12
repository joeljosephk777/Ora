"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

type Question = { content: string };

type Props = {
  action: (prevState: { error?: string } | null, formData: FormData) => Promise<{ error?: string } | null>;
  defaultValues?: { title: string; description: string; rubric: string };
  defaultQuestions?: Question[];
  submitLabel?: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function AssignmentForm({
  action,
  defaultValues,
  defaultQuestions = [],
  submitLabel = "Create assignment",
}: Props) {
  const [state, formAction] = useActionState(action, null);
  const [questions, setQuestions] = useState<Question[]>(
    defaultQuestions.length > 0 ? defaultQuestions : [{ content: "" }]
  );

  const addQuestion = () => setQuestions((q) => [...q, { content: "" }]);
  const removeQuestion = (i: number) => setQuestions((q) => q.filter((_, idx) => idx !== i));
  const updateQuestion = (i: number, value: string) =>
    setQuestions((q) => q.map((item, idx) => (idx === i ? { content: value } : item)));

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Assignment title <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          type="text"
          required
          defaultValue={defaultValues?.title}
          placeholder="e.g. Linked List Implementation"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Assignment description <span className="text-red-500">*</span>
        </label>
        <textarea
          name="description"
          required
          rows={5}
          defaultValue={defaultValues?.description}
          placeholder="Describe what students were asked to implement..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Grading rubric <span className="text-red-500">*</span>
        </label>
        <textarea
          name="rubric"
          required
          rows={6}
          defaultValue={defaultValues?.rubric}
          placeholder="List the criteria for grading comprehension. e.g.&#10;- Can explain time complexity of their approach&#10;- Understands edge cases handled&#10;- Can trace through their code with an example"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Guiding questions
          </label>
          <button
            type="button"
            onClick={addQuestion}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            + Add question
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          The AI will use these as a guide — it may rephrase or add follow-ups based on the student&apos;s answers.
        </p>
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="mt-2 text-xs text-gray-400 w-5 shrink-0">{i + 1}.</span>
              <input
                name={`question_${i}`}
                type="text"
                value={q.content}
                onChange={(e) => updateQuestion(i, e.target.value)}
                placeholder="e.g. Why did you choose this data structure?"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(i)}
                  className="mt-2 text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                  aria-label="Remove question"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
