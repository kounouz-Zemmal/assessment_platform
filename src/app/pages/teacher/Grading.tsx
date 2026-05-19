import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { apiGet, apiPatch } from "../../apiClient";

export default function TeacherGrading() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<{ id: string; title: string; moduleId: string } | null>(null);
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const [submission, setSubmission] = useState<{
    id: string;
    status: string;
    score: number | null;
    maxScore: number;
    submittedAt: string | null;
    submissionMode?: "submitted" | "auto-submitted";
    feedback: string;
    proctoring?: {
      leaveCount: number;
      totalOutsideSeconds: number;
      thresholdSeconds: number;
      suspiciousEventCount: number;
      isSuspicious: boolean;
      events: Array<{
        switchedAt: string | null;
        returnedAt: string | null;
        durationSeconds: number;
        isSuspicious?: boolean;
      }>;
    };
    answers: Array<{
      questionId: string;
      questionText: string;
      questionType: string;
      points: number;
      answer: string;
      autoScore: number;
      currentScore?: number;
      isCorrect?: boolean | null;
      teacherComment?: string | null;
      detectedKeywords: string[];
      missingKeywords: string[];
    }>;
  } | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");
  const [questionFeedback, setQuestionFeedback] = useState<Record<string, string>>({});
  const [showQuestionFeedback, setShowQuestionFeedback] = useState<Record<string, boolean>>({});
  const [approvedDescriptiveQuestions, setApprovedDescriptiveQuestions] = useState<Record<string, boolean>>({});
  const [isEditing, setIsEditing] = useState(true);

  useEffect(() => {
    if (!submissionId) return;
    setLoading(true);
    apiGet<{
      assessment: { id: string; title: string; moduleId: string };
      student: { id: string; name: string };
      submission: {
        id: string;
        status: string;
        score: number | null;
        maxScore: number;
        submittedAt: string | null;
        submissionMode?: "submitted" | "auto-submitted";
        feedback: string;
        proctoring?: {
          leaveCount: number;
          totalOutsideSeconds: number;
          thresholdSeconds: number;
          suspiciousEventCount: number;
          isSuspicious: boolean;
          events: Array<{
            switchedAt: string | null;
            returnedAt: string | null;
            durationSeconds: number;
            isSuspicious?: boolean;
          }>;
        };
        answers: Array<{
          questionId: string;
          questionText: string;
          questionType: string;
          points: number;
          answer: string;
          autoScore: number;
          currentScore?: number;
          isCorrect?: boolean | null;
          teacherComment?: string | null;
          detectedKeywords: string[];
          missingKeywords: string[];
        }>;
      };
    }>(`teacher/submissions/${submissionId}`)
      .then((data) => {
        setAssessment(data.assessment);
        setStudent(data.student);
        setSubmission(data.submission);
        setIsEditing(data.submission.status !== "Graded");
        setFeedback(data.submission.feedback || "");
        setScores(
          data.submission.answers.reduce<Record<string, number>>((acc, item) => {
            acc[item.questionId] = item.currentScore ?? item.autoScore ?? 0;
            return acc;
          }, {})
        );
        setApprovedDescriptiveQuestions(
          data.submission.answers.reduce<Record<string, boolean>>((acc, item) => {
            if (item.questionType === "DESCRIPTIVE" || item.questionType === "Descriptive") {
              acc[item.questionId] = data.submission.status === "Graded";
            }
            return acc;
          }, {})
        );
        setQuestionFeedback(
          data.submission.answers.reduce<Record<string, string>>((acc, item) => {
            acc[item.questionId] = item.teacherComment || "";
            return acc;
          }, {})
        );
        setShowQuestionFeedback(
          data.submission.answers.reduce<Record<string, boolean>>((acc, item) => {
            acc[item.questionId] = Boolean(item.teacherComment);
            return acc;
          }, {})
        );
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to load submission details");
      })
      .finally(() => setLoading(false));
  }, [submissionId]);

  const totalScore = useMemo(() => {
    if (!submission) return 0;
    return submission.answers.reduce((total, answer) => total + (scores[answer.questionId] ?? 0), 0);
  }, [submission, scores]);

  const descriptiveQuestionIds = useMemo(
    () =>
      (submission?.answers || [])
        .filter((answer) => answer.questionType === "DESCRIPTIVE" || answer.questionType === "Descriptive")
        .map((answer) => answer.questionId),
    [submission]
  );
  const allDescriptiveApproved = descriptiveQuestionIds.every((questionId) => approvedDescriptiveQuestions[questionId]);
  const canPublishGrade = allDescriptiveApproved;

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const renderHighlightedAnswer = (answerText: string, detectedKeywords: string[]) => {
    if (!answerText) return "(No answer)";
    const uniqueKeywords = Array.from(
      new Set(
        (detectedKeywords || [])
          .map((keyword) => keyword.trim())
          .filter((keyword) => keyword.length > 0)
      )
    ).sort((a, b) => b.length - a.length);

    if (uniqueKeywords.length === 0) {
      return answerText;
    }

    const pattern = new RegExp(`\\b(${uniqueKeywords.map(escapeRegExp).join("|")})\\b`, "gi");
    const parts = answerText.split(pattern);

    return parts.map((part, index) => {
      const isKeyword = uniqueKeywords.some(
        (keyword) => keyword.toLowerCase() === part.toLowerCase()
      );
      if (!isKeyword) return <span key={`${part}-${index}`}>{part}</span>;
      return (
        <span
          key={`${part}-${index}`}
          className="bg-emerald-100 text-emerald-800 px-1 rounded font-medium"
        >
          {part}
        </span>
      );
    });
  };

  const handleScoreChange = (questionId: string, score: number, maxPoints: number) => {
    const boundedScore = Number.isNaN(score) ? 0 : Math.max(0, Math.min(maxPoints, score));
    setScores({ ...scores, [questionId]: boundedScore });
  };

  const handleApproveAiSuggestion = (questionId: string, aiScore: number, maxPoints: number) => {
    const boundedScore = Number.isNaN(aiScore) ? 0 : Math.max(0, Math.min(maxPoints, aiScore));
    setApprovedDescriptiveQuestions((prev) => ({
      ...prev,
      [questionId]: true,
    }));
    setScores((prev) => ({
      ...prev,
      [questionId]: boundedScore,
    }));
  };

  const handleSaveGrade = async () => {
    if (!submission) return;
    try {
      await apiPatch(`teacher/submissions/${submission.id}`, {
        scores,
        feedback,
        questionFeedback,
        action: "save",
      });
      toast.success("Grade saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save grade");
    }
  };

  const handlePublishGrade = async () => {
    if (!submission || !assessment) return;
    if (!allDescriptiveApproved) {
      toast.error("Approve all AI-suggested descriptive scores before publishing");
      return;
    }
    try {
      await apiPatch(`teacher/submissions/${submission.id}`, {
        scores,
        feedback,
        questionFeedback,
        action: "publish",
      });
      toast.success("Grade published and student notified");
      setIsEditing(false);
      navigate(`/teacher/assessments/${assessment.id}/submissions`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish grade");
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!submission || !assessment || !student) {
    return <div className="p-8">Submission not found</div>;
  }

  return (
    <div className="p-8">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate(`/teacher/assessments/${assessment.id}/submissions`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Submissions
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Grade Submission</h1>
        <p className="text-gray-500 mt-1">
          {student.name} • {assessment.title}
        </p>
      </div>

      <div className="max-w-5xl space-y-6">
        {/* Submission Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Student</p>
                <p className="font-medium">{student.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Submitted At</p>
                <p className="font-medium">
                  {submission.submittedAt
                    ? new Date(submission.submittedAt).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Max Score</p>
                <p className="font-medium">{submission.maxScore} points</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Total</p>
                <p className="font-medium">
                  {totalScore} / {submission.maxScore}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Submission Mode</p>
                <p className="font-medium">
                  {submission.submissionMode === "auto-submitted"
                    ? "Auto-submitted"
                    : submission.submissionMode === "submitted"
                      ? "Submitted"
                      : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proctoring History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded border p-3">
                <p className="text-gray-500">Tab switches</p>
                <p className="font-semibold">{submission.proctoring?.leaveCount ?? 0}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-gray-500">Total outside time</p>
                <p className="font-semibold">{submission.proctoring?.totalOutsideSeconds ?? 0}s</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-gray-500">Threshold</p>
                <p className="font-semibold">{submission.proctoring?.thresholdSeconds ?? 10}s</p>
              </div>
              <div className={`rounded border p-3 ${
                submission.proctoring?.isSuspicious ? "bg-red-50 border-red-300" : "bg-green-50 border-green-300"
              }`}>
                <p className="text-gray-500">Suspicious events</p>
                <p className="font-semibold">
                  {submission.proctoring?.suspiciousEventCount ?? 0}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {(submission.proctoring?.events || []).length === 0 ? (
                <p className="text-sm text-gray-500">No tab-switch events captured.</p>
              ) : (
                (submission.proctoring?.events || []).map((event, index) => (
                  <div
                    key={`${event.switchedAt || "event"}-${index}`}
                    className={`rounded border p-3 text-sm ${
                      event.isSuspicious ? "bg-red-50 border-red-300" : "bg-gray-50"
                    }`}
                  >
                    <p className="font-medium">Switch #{index + 1}</p>
                    <p>Left: {event.switchedAt ? new Date(event.switchedAt).toLocaleString() : "—"}</p>
                    <p>Returned: {event.returnedAt ? new Date(event.returnedAt).toLocaleString() : "—"}</p>
                    <p>Duration: {event.durationSeconds}s {event.isSuspicious ? "(suspicious)" : ""}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Questions and Answers */}
        {submission.answers.map((answer, index) => {
          const questionType =
            answer.questionType === "TRUE_FALSE"
              ? "True/False"
              : answer.questionType === "DESCRIPTIVE"
              ? "Descriptive"
              : answer.questionType;
          const isDescriptive = questionType === "Descriptive";
          const isAutoGraded = questionType === "MCQ" || questionType === "SCQ" || questionType === "True/False";

          return (
            <Card key={answer.questionId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Question {index + 1}</Badge>
                      <Badge variant="outline">{questionType}</Badge>
                      <span className="text-sm text-gray-500 ml-auto">
                        {answer.points} points
                      </span>
                    </div>
                    <CardTitle className="text-base">{answer.questionText}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Student Answer */}
                <div>
                  <Label className="text-sm text-gray-500">Student Answer</Label>
                  <p className="font-medium">
                    {renderHighlightedAnswer(String(answer.answer || ""), answer.detectedKeywords)}
                  </p>
                  {isAutoGraded && answer.isCorrect === true && (
                    <p className="text-sm font-medium text-green-600 mt-1">Correct answer</p>
                  )}
                  {isAutoGraded && answer.isCorrect === false && (
                    <p className="text-sm font-medium text-red-600 mt-1">Incorrect answer</p>
                  )}
                </div>

                {/* Descriptive Question Auto-Grading Analysis */}
                {isDescriptive && (
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <Label className="text-sm font-semibold text-blue-900">
                        Auto-Grading Analysis
                      </Label>
                    </div>
                    
                    {answer.detectedKeywords && answer.detectedKeywords.length > 0 && (
                      <div>
                        <Label className="text-xs text-gray-600">Detected Keywords</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {answer.detectedKeywords.map((keyword, idx) => (
                            <Badge key={idx} variant="default" className="bg-green-500 gap-1">
                              <Check className="h-3 w-3" />
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {answer.missingKeywords && answer.missingKeywords.length > 0 && (
                      <div>
                        <Label className="text-xs text-gray-600">Missing Keywords</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {answer.missingKeywords.map((keyword, idx) => (
                            <Badge key={idx} variant="secondary" className="bg-red-100 text-red-700 gap-1">
                              <X className="h-3 w-3" />
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-2 border-t border-blue-200">
                      <div>
                        <Label className="text-xs text-gray-600">AI Suggested Score</Label>
                        <p className="text-lg font-bold text-blue-900">
                          {answer.autoScore}/{answer.points}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={approvedDescriptiveQuestions[answer.questionId] ? "default" : "outline"}
                        disabled={!isEditing}
                        onClick={() =>
                          handleApproveAiSuggestion(
                            answer.questionId,
                            answer.autoScore ?? 0,
                            answer.points
                          )
                        }
                      >
                        {approvedDescriptiveQuestions[answer.questionId]
                          ? "Approved by Teacher"
                          : "Approve AI Suggestion"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Score Input */}
                <div>
                  <Label htmlFor={`score-${answer.questionId}`}>
                    {isDescriptive ? "Final Score (adjust if needed)" : "Score"}
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id={`score-${answer.questionId}`}
                      type="number"
                      min="0"
                      max={answer.points}
                      value={scores[answer.questionId] ?? 0}
                      placeholder={String(answer.autoScore ?? 0)}
                      disabled={!isEditing}
                      onChange={(e) =>
                        handleScoreChange(answer.questionId, parseFloat(e.target.value), answer.points)
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-gray-500">/ {answer.points} points</span>
                  </div>
                </div>
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!isEditing}
                    onClick={() =>
                      setShowQuestionFeedback((prev) => ({
                        ...prev,
                        [answer.questionId]: !prev[answer.questionId],
                      }))
                    }
                  >
                    + Optional feedback
                  </Button>
                  {showQuestionFeedback[answer.questionId] && (
                    <div className="mt-2">
                      <Textarea
                        value={questionFeedback[answer.questionId] || ""}
                        disabled={!isEditing}
                        onChange={(e) =>
                          setQuestionFeedback((prev) => ({
                            ...prev,
                            [answer.questionId]: e.target.value,
                          }))
                        }
                        placeholder="Write optional feedback for this question..."
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Overall Feedback */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Feedback (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={feedback}
              disabled={!isEditing}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Add comments or feedback for the student..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-3">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleSaveGrade}>
                  Save Draft
                </Button>
                <Button onClick={handlePublishGrade} disabled={!canPublishGrade}>
                  Publish Grade & Notify Student
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>
          {!allDescriptiveApproved && (
            <p className="text-xs text-amber-600">
              Approve all descriptive AI suggestions before publishing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
