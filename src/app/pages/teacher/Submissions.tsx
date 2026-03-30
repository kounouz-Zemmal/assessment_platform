import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge } from "../../components/StatusBadge";
import { assessments, submissions, users } from "../../mockData";

export default function TeacherSubmissions() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const assessment = assessments.find((a) => a.id === id);
  const assessmentSubmissions = submissions.filter((s) => s.assessmentId === id);

  if (!assessment) {
    return <div className="p-8">Assessment not found</div>;
  }

  return (
    <div className="p-8">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate("/teacher/assessments")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Assessments
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{assessment.title}</h1>
        <p className="text-gray-500 mt-1">
          {assessmentSubmissions.length} {assessmentSubmissions.length === 1 ? "submission" : "submissions"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {assessmentSubmissions.length === 0 ? (
            <p className="text-center text-gray-500 py-12">
              No submissions yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessmentSubmissions.map((submission) => {
                  const student = users.find((u) => u.id === submission.studentId);
                  
                  return (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">{student?.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={submission.status} />
                      </TableCell>
                      <TableCell>
                        {submission.score !== undefined
                          ? `${submission.score}/${submission.maxScore}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {submission.submittedAt
                          ? new Date(submission.submittedAt).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {submission.status === "Submitted" && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/teacher/grading/${submission.id}`)}
                          >
                            Grade
                          </Button>
                        )}
                        {submission.status === "Graded" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/teacher/grading/${submission.id}`)}
                          >
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
