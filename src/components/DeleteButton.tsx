"use client";

import { useState, useTransition } from "react";
import Modal from "./Modal";

type Props = {
  action: () => Promise<void>;
};

export default function DeleteButton({ action }: Props) {
  const [pending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = () => {
    startTransition(() => {
      action();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={pending}
        className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {pending ? "Deleting..." : "Delete"}
      </button>

      <Modal
        open={isOpen}
        onClose={() => !pending && setIsOpen(false)}
        title="Delete assignment?"
      >
        <p className="text-sm text-gray-600">
          This cannot be undone. The assignment and all related submissions, sessions, and reports will be removed.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            disabled={pending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {pending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </>
  );
}
