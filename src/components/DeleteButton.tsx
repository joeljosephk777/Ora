"use client";

import { useTransition } from "react";

type Props = {
  action: () => Promise<void>;
};

export default function DeleteButton({ action }: Props) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!confirm("Delete this assignment? This cannot be undone.")) return;
    startTransition(() => { action(); });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
