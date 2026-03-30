import { useNavigate, useParams } from "react-router";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { assessments, submissions, questions, modules } from "../../mockData";
import { getCurrentUser } from "../../mockData";

export default function StudentResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  
  const assessment = assessments.find((a) => a.id === id);
  const submission = submissions.find(
    (s) => s.assessmentId === id && s.studentId === currentUser.id
  );
  const module = assessment ? modules.find((m) => m.id === assessment.moduleId) : null;

  if (!assessment || !submission) {
    return <div className="p-8">Results not found</div>;
  }

  const isPublished = submission.status === "Graded";
  const assessmentQuestions = questions.filter((q) => assessment.questions.includes(q.id));
  const visibility = assessment.resultsVisibility ?? {
    showScore: true,
    showQuestionBreakdown: true,
    showKeywordAnalysis: true,
  };

  return (
    <div className="p-8">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate("/student/assessments")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Assessments
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{assessment.title}</h1>
        <p className="text-gray-500 mt-1">{module?.code} - {module?.name}</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Score Card */}
        {isPublished && visibility.showScore ? (
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-green-600 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Your Score</p>
                    <p className="text-4xl font-bold text-gray-900">
                      {Math.round((submission.score! / submission.maxScore) * 100)}%
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {submission.score} out of {submission.maxScore} points
                    </p>
                  </div>
                </div>
                <div className="text-right">
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
        ) : (
          <Alert>
            <AlertDescription className="flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              <div>
                <p className="font-semibold">Results Not Published Yet</p>
                <p className="text-sm mt-1">
                  Your teacher is currently grading your submission. Results will be available once grading is complete.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Teacher Feedback */}
        {isPublished && submission.feedback && (
          <Card>
            <CardHeader>
              <CardTitle>Teacher Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{submission.feedback}</p>
            </CardContent>
          </Card>
        )}

        {/* Question Review */}
        {isPublished && visibility.showQuestionBreakdown && (
          <Card>
            <CardHeader>
              <CardTitle>Question Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {submission.answers.map((answer, index) => {
                  const question = questions.find((q) => q.id === answer.questionId);
                  if (!question) return null;

                  const isCorrect =
                    question.type === "MCQ" || question.type === "SCQ" || question.type === "True/False"
                      ? answer.answer === question.correctAnswer
                      : undefined;

                  return (
                    <div key={question.id} className="pb-6 border-b last:border-b-0">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
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
                        <span className="text-sm text-gray-500">{question.points} points</span>
                      </div>

                      <p className="text-gray-900 mb-3">{question.text}</p>

                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Your Answer:</p>
                          <p className="text-gray-900">
                            {answer.answer || <span className="text-gray-400">No answer provided</span>}
                          </p>
                        </div>

                        {question.type !== "Descriptive" && (
                          <div>
                            <p className="text-sm font-medium text-gray-600">Correct Answer:</p>
                            <p className="text-green-600 font-medium">{String(question.correctAnswer)}</p>
                          </div>
                        )}

                        {question.type === "Descriptive" && answer.detectedKeywords && visibility.showKeywordAnalysis && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm font-semibold text-blue-900 mb-2">
                              Keyword Analysis
                            </p>
                            <div className="space-y-2">
                              {answer.detectedKeywords.length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-600">Detected Keywords:</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {answer.detectedKeywords.map((keyword, idx) => (
                                      <Badge key={idx} variant="default" className="bg-green-500 text-xs">
                                        {keyword}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {answer.missingKeywords && answer.missingKeywords.length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-600">Missing Keywords:</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {answer.missingKeywords.map((keyword, idx) => (
                                      <Badge key={idx} variant="secondary" className="bg-red-100 text-red-700 text-xs">
                                        {keyword}
                                      </Badge>
                                    ))}
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
          <Button onClick={() => navigate("/student/assessments")}>
            Back to Assessments
          </Button>
        </div>
      </div>
    </div>
  );
}
