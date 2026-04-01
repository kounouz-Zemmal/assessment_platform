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
import { assessments, submissions, questions, modules } from "../../mockData";
import { getCurrentUser } from "../../mockData";

export default function StudentResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const assessment = assessments.find((a) => a.id === id);
  const submission = submissions.find(
    (s) => s.assessmentId === id && s.studentId === currentUser.id,
  );
  const module = assessment
    ? modules.find((m) => m.id === assessment.moduleId)
    : null;

  if (!assessment || !submission) {
    return <div className="p-4 sm:p-6 lg:p-8">Results not found</div>;
  }

  const isPublished = submission.status === "Graded";
  const visibility = assessment.resultsVisibility ?? {
    showFinalScore: true,
    showScoreBreakdown: true,
    showTeacherFeedback: true,
    showAiKeywordAnalysis: true,
    showPerQuestionDetails: true,
    showScore: true,
    showQuestionBreakdown: true,
    showKeywordAnalysis: true,
  };
  const showFinalScore =
    visibility.showFinalScore ?? visibility.showScore ?? true;
  const showScoreBreakdown =
    visibility.showScoreBreakdown ?? visibility.showQuestionBreakdown ?? true;
  const showTeacherFeedback = visibility.showTeacherFeedback ?? true;
  const showAiKeywordAnalysis =
    visibility.showAiKeywordAnalysis ?? visibility.showKeywordAnalysis ?? true;
  const showPerQuestionDetails =
    visibility.showPerQuestionDetails ?? showScoreBreakdown;
  const hasNumericScore = typeof submission.score === "number";
  const shouldShowScoreCard = isPublished && showFinalScore && hasNumericScore;
  const shouldShowNotPublishedAlert = !isPublished;
  const shouldShowScoreHiddenAlert = isPublished && !showFinalScore;
  const answeredCount = submission.answers.filter((answer) =>
    String(answer.answer ?? "").trim(),
  ).length;
  const completionPercentage =
    submission.answers.length === 0
      ? 0
      : Math.round((answeredCount / submission.answers.length) * 100);

  const questionBreakdown = submission.answers
    .map((answer, index) => {
      const question = questions.find((item) => item.id === answer.questionId);
      if (!question) return null;

      const score =
        typeof answer.autoScore === "number"
          ? Math.max(0, Math.min(answer.autoScore, question.points))
          : question.type === "Descriptive"
            ? 0
            : answer.answer === question.correctAnswer
              ? question.points
              : 0;

      return {
        id: question.id,
        label: `Question ${index + 1}`,
        score,
        maxScore: question.points,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

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
          {assessment.title}
        </h1>
        <p className="text-gray-500 mt-1">
          {module?.code} - {module?.name}
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
        </div>
      </div>

      <div className="max-w-4xl space-y-4 sm:space-y-6">
        <Card className="border-dashed border-gray-300 bg-gray-50/40">
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Status: {submission.status}</Badge>
              <Badge variant="outline">
                Answered: {answeredCount}/{submission.answers.length}
              </Badge>
              <Badge variant="outline">
                Completion: {completionPercentage}%
              </Badge>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </CardContent>
        </Card>

        {/* Score Card */}
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
                        ((submission.score as number) / submission.maxScore) *
                          100,
                      )}
                      %
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {submission.score as number} out of {submission.maxScore}{" "}
                      points
                    </p>
                    <div className="mt-3">
                      <Progress
                        value={Math.round(
                          ((submission.score as number) / submission.maxScore) *
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
                    {new Date(submission.submittedAt!).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(submission.submittedAt!).toLocaleTimeString()}
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

        {/* Teacher Feedback */}
        {isPublished && showTeacherFeedback && submission.feedback && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle>Teacher Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{submission.feedback}</p>
            </CardContent>
          </Card>
        )}

        {/* Score Breakdown */}
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

        {/* Question Review */}
        {isPublished && showPerQuestionDetails && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle>Question Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {submission.answers.map((answer, index) => {
                  const question = questions.find(
                    (q) => q.id === answer.questionId,
                  );
                  if (!question) return null;

                  const isCorrect =
                    question.type === "MCQ" ||
                    question.type === "SCQ" ||
                    question.type === "True/False"
                      ? answer.answer === question.correctAnswer
                      : undefined;

                  return (
                    <div
                      key={question.id}
                      className="pb-6 border-b last:border-b-0"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Question {index + 1}</Badge>
                          <Badge variant="outline">{question.type}</Badge>
                          {isCorrect !== undefined && (
                            <Badge
                              variant={isCorrect ? "default" : "destructive"}
                              className={isCorrect ? "bg-green-500" : ""}
                            >
                              {isCorrect ? "Correct" : "Incorrect"}
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {question.points} points
                        </span>
                      </div>

                      <p className="text-gray-900 mb-3">{question.text}</p>

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

                        {question.type !== "Descriptive" && (
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Correct Answer:
                            </p>
                            <p className="text-green-600 font-medium">
                              {String(question.correctAnswer)}
                            </p>
                          </div>
                        )}

                        {question.type === "Descriptive" &&
                          answer.detectedKeywords &&
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
                                {answer.missingKeywords &&
                                  answer.missingKeywords.length > 0 && (
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
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
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
