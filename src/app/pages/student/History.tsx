import { useNavigate } from "react-router";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { StatusBadge } from "../../components/StatusBadge";
import { assessments, submissions, modules, getCurrentUser } from "../../mockData";

export default function StudentHistory() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const mySubmissions = submissions.filter((s) => s.studentId === currentUser.id);

  const rows = mySubmissions
    .map((submission) => {
      const assessment = assessments.find((a) => a.id === submission.assessmentId);
      if (!assessment) return null;
      const module = modules.find((m) => m.id === assessment.moduleId);
      return { submission, assessment, module };
    })
    .filter(Boolean) as {
    submission: (typeof submissions)[number];
    assessment: (typeof assessments)[number];
    module: (typeof modules)[number] | undefined;
  }[];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exam History</h1>
          <p className="text-gray-500 mt-1">
            Review your past assessments, scores, and statuses
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Clock className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-gray-500">You have no exam history yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ submission, assessment, module }) => (
                  <TableRow
                    key={submission.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/student/assessments/${assessment.id}/results`)}
                  >
                    <TableCell className="font-medium">
                      {assessment.title}
                    </TableCell>
                    <TableCell>
                      {module && (
                        <Badge variant="outline">{module.code}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {submission.submittedAt
                        ? new Date(submission.submittedAt).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={submission.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {submission.score !== undefined ? (
                        <span className="font-semibold">
                          {submission.score}/{submission.maxScore}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">Pending</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

