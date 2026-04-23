import { Badge } from "../components/ui/badge";
import { AssessmentStatus, SubmissionStatus } from "../types";

interface StatusBadgeProps {
  status: AssessmentStatus | SubmissionStatus | "active" | "inactive";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const displayStatus =
    status === "Closed" ? "Completed" : status;

  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    Draft: { variant: "secondary" },
    Scheduled: { variant: "default", className: "bg-blue-500 hover:bg-blue-600" },
    Active: { variant: "default", className: "bg-green-500 hover:bg-green-600" },
    Closed: { variant: "secondary", className: "bg-gray-500 hover:bg-gray-600" },
    Completed: { variant: "secondary", className: "bg-gray-500 hover:bg-gray-600" },
    Published: { variant: "default", className: "bg-purple-500 hover:bg-purple-600" },
    "Not Started": { variant: "secondary" },
    "In Progress": { variant: "default", className: "bg-yellow-500 hover:bg-yellow-600 text-black" },
    Submitted: { variant: "default", className: "bg-blue-500 hover:bg-blue-600" },
    Graded: { variant: "default", className: "bg-green-500 hover:bg-green-600" },
    active: { variant: "default", className: "bg-green-500 hover:bg-green-600" },
    inactive: { variant: "secondary", className: "bg-gray-500 hover:bg-gray-600" },
  };

  const config = variants[displayStatus] || variants[status] || { variant: "default" };

  return (
    <Badge variant={config.variant} className={config.className}>
      {displayStatus}
    </Badge>
  );
}
