import AssignmentForm from "@/components/AssignmentForm";
import Breadcrumbs from "@/components/Breadcrumbs";
import { createAssignment } from "@/lib/actions/assignments";

export default function NewAssignmentPage() {
  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/professor/dashboard" }, { label: "New assignment" }]} />
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New assignment</h1>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <AssignmentForm action={createAssignment} submitLabel="Create assignment" />
      </div>
    </div>
  );
}
