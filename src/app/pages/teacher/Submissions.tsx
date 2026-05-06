import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge } from "../../components/StatusBadge";
import { apiGet } from "../../apiClient";
import { toast } from "sonner";

export default function TeacherSubmissions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<{ id: string; title: string } | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [submissionRows, setSubmissionRows] = useState<
    Array<{
      submissionId: string;
      studentId: string;
      studentName: string;
      status: "Not Started" | "In Progress" | "Submitted" | "Graded" | "Not submitted";
      submissionMode?: "submitted" | "auto-submitted";
      score: number | null;
      maxScore: number;
      submittedAt: string | null;
      proctoring?: { leaveCount: number; totalOutsideSeconds: number };
    }>
  >([]);
  const [thresholdSeconds, setThresholdSeconds] = useState<number>(10);

  const getActionState = (submission: {
    status: string;
    submittedAt: string | null;
    score: number | null;
  }) => {
    const normalizedStatus = submission.status.trim().toLowerCase();
    const isNotSubmittedTimedOut = normalizedStatus === "not submitted";
    const isGraded = normalizedStatus === "graded";
    const isSubmitted =
      !isNotSubmittedTimedOut &&
      (normalizedStatus === "submitted" ||
        !!submission.submittedAt ||
        submission.score !== null);
    return { isGraded, isSubmitted, isNotSubmittedTimedOut };
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGet<{
      assessment: { id: string; title: string };
      rows: Array<{
        submissionId: string;
        studentId: string;
        studentName: string;
        status: "Not Started" | "In Progress" | "Submitted" | "Graded" | "Not submitted";
        submissionMode?: "submitted" | "auto-submitted";
        score: number | null;
        maxScore: number;
        submittedAt: string | null;
        proctoring?: { leaveCount: number; totalOutsideSeconds: number };
      }>;
      thresholdSeconds?: number;
    }>(`teacher/assessments/${id}/submissions`)
      .then((data) => {
        setBlockedMessage(null);
        setAssessment(data.assessment);
        setSubmissionRows(data.rows);
        setThresholdSeconds(Number(data.thresholdSeconds || 10));
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Failed to load submissions";
        if (
          message.includes("only available after the assessment is published") ||
          message.includes("Submissions are available after")
        ) {
          setAssessment(null);
          setSubmissionRows([]);
          setBlockedMessage(message);
          return;
        }
        toast.error(message);
        navigate("/teacher/assessments");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return <div className="p-8">Loading submissions...</div>;
  }

  if (blockedMessage) {
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
        <Card>
          <CardHeader>
            <CardTitle>Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{blockedMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          {submissionRows.length} {submissionRows.length === 1 ? "student" : "students"} tracked
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissionRows.length === 0 ? (
            <p className="text-center text-gray-500 py-12">
              No enrolled students found for this module
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Tab Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissionRows.map((submission) => {
                  const { isGraded, isSubmitted, isNotSubmittedTimedOut } = getActionState(submission);
                  const canOpenDetails = !submission.submissionId.startsWith("pending-");
                  return (
                    <TableRow key={submission.submissionId}>
                      <TableCell className="font-medium">
                        {canOpenDetails ? (
                          <button
                            type="button"
                            className="text-left text-blue-600 hover:underline"
                            onClick={() => navigate(`/teacher/grading/${submission.submissionId}`)}
                          >
                            {submission.studentName}
                          </button>
                        ) : (
                          submission.studentName
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={submission.status} />
                      </TableCell>
                      <TableCell>
                        {submission.score !== undefined
                          ? `${submission.score ?? "—"}/${submission.maxScore}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {submission.submittedAt
                          ? new Date(submission.submittedAt).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {submission.submissionMode === "auto-submitted" ? (
                          <span className="text-amber-700 font-medium">Auto-submitted</span>
                        ) : submission.submissionMode === "submitted" ? (
                          <span className="text-gray-700">Submitted</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {submission.proctoring
                          ? `${submission.proctoring.leaveCount} leaves / ${submission.proctoring.totalOutsideSeconds}s outside${
                              submission.proctoring.totalOutsideSeconds >= thresholdSeconds
                                ? " (suspicious)"
                                : ""
                            }`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isGraded && isSubmitted && canOpenDetails && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/teacher/grading/${submission.submissionId}`)}
                          >
                            Grade
                          </Button>
                        )}
                        {isGraded && canOpenDetails && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/teacher/grading/${submission.submissionId}`)}
                          >
                            View
                          </Button>
                        )}
                        {isNotSubmittedTimedOut && (
                          <span className="text-sm text-amber-800">Time expired — not submitted</span>
                        )}
                        {!isSubmitted && !isNotSubmittedTimedOut && (
                          <span className="text-sm text-gray-500">Awaiting submission</span>
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
