import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Progress } from "../../components/ui/progress";
import { Skeleton } from "../../components/ui/skeleton";
import { useMinimumSkeletonTime } from "../../hooks/useMinimumSkeletonTime";
import { getCurrentUser } from "../../mockData";
import { apiGet } from "../../apiClient";

type StudentResultsApiResponse = {
  assessment: {
    id: string;
    title: string;
    moduleCode: string;
    moduleName: string;
  };
  visibility: {
    showFinalScore: boolean;
    showScoreBreakdown: boolean;
    showTeacherFeedback: boolean;
    showAiKeywordAnalysis: boolean;
    showPerQuestionDetails: boolean;
    showScore?: boolean;
    showQuestionBreakdown?: boolean;
    showKeywordAnalysis?: boolean;
  };
  submission: {
    id: string;
    status: string;
    score: number | null;
    maxScore: number;
    submittedAt: string | null;
    feedback: string | null;
    answers: Array<{
      questionId: string;
      questionText: string;
      questionType: string;
      points: number;
      answer: string;
      correctAnswer: string | null;
      autoScore: number;
      detectedKeywords: string[];
      missingKeywords: string[];
      teacherComment: string | null;
    }>;
  };
};

export default function StudentResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [apiData, setApiData] = useState<StudentResultsApiResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const showLoadingSkeleton = useMinimumSkeletonTime(loading);

  useEffect(() => {
    if (!id || currentUser.role !== "student") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    apiGet<StudentResultsApiResponse>(`student/results/${id}`, {
      student_id: currentUser.id,
    })
      .then((data) => setApiData(data))
      .catch(() => {
        setApiData(null);
        setLoadError("Could not load results from backend.");
      })
      .finally(() => setLoading(false));
  }, [id, currentUser.id, currentUser.role]);

  if (showLoadingSkeleton) {
    return (
      <div className="p-3 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="mb-8 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-56" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-7 w-32" />
          </div>
        </div>
        <div className="max-w-4xl space-y-4 sm:space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-6 w-80" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!apiData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-700 font-medium">Results not found.</p>
            {loadError && (
              <p className="text-sm text-gray-500 mt-1">{loadError}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const uiAssessment = {
    id: apiData.assessment.id,
    title: apiData.assessment.title,
    moduleCode: apiData.assessment.moduleCode,
    moduleName: apiData.assessment.moduleName,
  };

  const uiVisibility = apiData.visibility;

  const uiSubmission = {
    status: apiData.submission.status,
    score: apiData.submission.score,
    maxScore: apiData.submission.maxScore,
    submittedAt: apiData.submission.submittedAt,
    feedback: apiData.submission.feedback,
    answers: apiData.submission.answers,
  };

  const isPublished = uiSubmission.status === "Graded";
  const showFinalScore =
    uiVisibility.showFinalScore ?? uiVisibility.showScore ?? true;
  const showScoreBreakdown =
    uiVisibility.showScoreBreakdown ??
    uiVisibility.showQuestionBreakdown ??
    true;
  const showTeacherFeedback = uiVisibility.showTeacherFeedback ?? true;
  const showAiKeywordAnalysis =
    uiVisibility.showAiKeywordAnalysis ??
    uiVisibility.showKeywordAnalysis ??
    true;
  const showPerQuestionDetails =
    uiVisibility.showPerQuestionDetails ?? showScoreBreakdown;

  const hasNumericScore = typeof uiSubmission.score === "number";
  const shouldShowScoreCard = isPublished && showFinalScore && hasNumericScore;
  const shouldShowNotPublishedAlert = !isPublished;
  const shouldShowScoreHiddenAlert = isPublished && !showFinalScore;

  const answeredCount = uiSubmission.answers.filter((answer) =>
    String(answer.answer ?? "").trim(),
  ).length;
  const completionPercentage =
    uiSubmission.answers.length === 0
      ? 0
      : Math.round((answeredCount / uiSubmission.answers.length) * 100);

  const questionBreakdown = uiSubmission.answers.map((answer, index) => ({
    id: answer.questionId,
    label: `Question ${index + 1}`,
    score: answer.autoScore,
    maxScore: answer.points,
  }));

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate("/student/assessments")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Assessments
      </Button>

      <div className="mb-8">
        <Badge variant="outline" className="mb-2 bg-white">
          Attempt Insights
        </Badge>
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 break-words">
          {uiAssessment.title}
        </h1>
        <p className="text-gray-500 mt-1">
          {uiAssessment.moduleCode} - {uiAssessment.moduleName}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
          <Badge variant={showFinalScore ? "default" : "secondary"}>
            Final Score {showFinalScore ? "Visible" : "Hidden"}
          </Badge>
          <Badge variant={showScoreBreakdown ? "default" : "secondary"}>
            Breakdown {showScoreBreakdown ? "Visible" : "Hidden"}
          </Badge>
          <Badge variant={showTeacherFeedback ? "default" : "secondary"}>
            Feedback {showTeacherFeedback ? "Visible" : "Hidden"}
          </Badge>
          <Badge variant={showAiKeywordAnalysis ? "default" : "secondary"}>
            AI Analysis {showAiKeywordAnalysis ? "Visible" : "Hidden"}
          </Badge>
          <Badge variant={showPerQuestionDetails ? "default" : "secondary"}>
            Per-question Details {showPerQuestionDetails ? "Visible" : "Hidden"}
          </Badge>
        </div>
      </div>

      <div className="max-w-4xl space-y-4 sm:space-y-6">
        <Card className="border-dashed border-gray-300 bg-gray-50/40">
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Status: {uiSubmission.status}</Badge>
              <Badge variant="outline">
                Answered: {answeredCount}/{uiSubmission.answers.length}
              </Badge>
              <Badge variant="outline">
                Completion: {completionPercentage}%
              </Badge>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </CardContent>
        </Card>

        {shouldShowScoreCard && (
          <Card className="border-2 border-green-200 bg-green-50 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-green-600 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Your Score</p>
                    <p className="text-3xl sm:text-4xl font-bold text-gray-900">
                      {Math.round(
                        ((uiSubmission.score as number) /
                          uiSubmission.maxScore) *
                          100,
                      )}
                      %
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {uiSubmission.score as number} out of{" "}
                      {uiSubmission.maxScore} points
                    </p>
                    <div className="mt-3">
                      <Progress
                        value={Math.round(
                          ((uiSubmission.score as number) /
                            uiSubmission.maxScore) *
                            100,
                        )}
                        className="h-2"
                      />
                    </div>
                  </div>
                </div>
                <div className="text-left lg:text-right">
                  <p className="text-sm text-gray-600">Submitted</p>
                  <p className="font-medium">
                    {uiSubmission.submittedAt
                      ? new Date(uiSubmission.submittedAt).toLocaleDateString()
                      : "-"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {uiSubmission.submittedAt
                      ? new Date(uiSubmission.submittedAt).toLocaleTimeString()
                      : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {shouldShowNotPublishedAlert && (
          <Alert>
            <AlertDescription className="flex items-start gap-2">
              <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Results Not Published Yet</p>
                <p className="text-sm mt-1">
                  Your teacher is currently grading your submission. Results
                  will be available once grading is complete.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {shouldShowScoreHiddenAlert && (
          <Alert>
            <AlertDescription>
              <p className="font-semibold">Final Score Is Hidden</p>
              <p className="text-sm mt-1">
                Your instructor has hidden the final score for this assessment.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {isPublished && showTeacherFeedback && uiSubmission.feedback && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle>Teacher Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{uiSubmission.feedback}</p>
            </CardContent>
          </Card>
        )}

        {isPublished && showScoreBreakdown && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {questionBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No score breakdown is available for this attempt.
                </p>
              ) : (
                <div className="space-y-2">
                  {questionBreakdown.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-md border border-gray-200 px-3 py-2"
                    >
                      <p className="text-sm text-gray-700">{item.label}</p>
                      <p className="text-sm font-medium text-gray-900">
                        {item.score} / {item.maxScore}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isPublished && showPerQuestionDetails && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle>Question Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {uiSubmission.answers.map((answer, index) => (
                  <div
                    key={answer.questionId}
                    className="pb-6 border-b last:border-b-0"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Question {index + 1}</Badge>
                        <Badge variant="outline">{answer.questionType}</Badge>
                      </div>
                      <span className="text-sm text-gray-500">
                        {answer.points} points
                      </span>
                    </div>

                    <p className="text-gray-900 mb-3">{answer.questionText}</p>

                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Your Answer:
                        </p>
                        <p className="text-gray-900">
                          {answer.answer || (
                            <span className="text-gray-400">
                              No answer provided
                            </span>
                          )}
                        </p>
                      </div>

                      {answer.correctAnswer && (
                        <div>
                          <p className="text-sm font-medium text-gray-600">
                            Correct Answer:
                          </p>
                          <p className="text-green-600 font-medium">
                            {answer.correctAnswer}
                          </p>
                        </div>
                      )}

                      {answer.questionType === "DESCRIPTIVE" &&
                        showAiKeywordAnalysis && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm font-semibold text-blue-900 mb-2">
                              Keyword Analysis
                            </p>
                            <div className="space-y-2">
                              {answer.detectedKeywords.length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-600">
                                    Detected Keywords:
                                  </p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {answer.detectedKeywords.map(
                                      (keyword, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="default"
                                          className="bg-green-500 text-xs"
                                        >
                                          {keyword}
                                        </Badge>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}
                              {answer.missingKeywords.length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-600">
                                    Missing Keywords:
                                  </p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {answer.missingKeywords.map(
                                      (keyword, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="secondary"
                                          className="bg-red-100 text-red-700 text-xs"
                                        >
                                          {keyword}
                                        </Badge>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}
                              {answer.detectedKeywords.length === 0 &&
                                answer.missingKeywords.length === 0 && (
                                  <p className="text-xs text-gray-600">
                                    No keyword analysis has been saved yet for
                                    this answer.
                                  </p>
                                )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Button
            className="w-full sm:w-auto"
            onClick={() => navigate("/student/assessments")}
          >
            Back to Assessments
          </Button>
        </div>
      </div>
    </div>
  );
}
