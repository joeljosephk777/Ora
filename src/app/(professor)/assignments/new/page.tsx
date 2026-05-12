import AssignmentForm from "@/components/AssignmentForm";
import { createAssignment } from "@/lib/actions/assignments";
import Link from "next/link";

export default function NewAssignmentPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/professor/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">New assignment</h1>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <AssignmentForm action={createAssignment} submitLabel="Create assignment" />
      </div>
    </div>
  );
}
