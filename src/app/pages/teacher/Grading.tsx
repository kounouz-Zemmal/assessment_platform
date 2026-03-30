import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { submissions, questions, assessments, users, getCurrentUser } from "../../mockData";
import { canFinalizeGrades } from "../../permissions";
import { toast } from "sonner";

export default function TeacherGrading() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  
  const submission = submissions.find((s) => s.id === submissionId);
  const assessment = submission ? assessments.find((a) => a.id === submission.assessmentId) : null;
  const student = submission ? users.find((u) => u.id === submission.studentId) : null;

  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState(submission?.feedback || "");

  if (!submission || !assessment || !student) {
    return <div className="p-8">Submission not found</div>;
  }

  const canFinalize = canFinalizeGrades(currentUser, assessment.moduleId);

  const handleScoreChange = (questionId: string, score: number) => {
    setScores({ ...scores, [questionId]: score });
  };

  const handleSaveGrade = () => {
    toast.success("Grade saved successfully");
  };

  const handlePublishGrade = () => {
    toast.success("Grade published and student notified");
    navigate(`/teacher/assessments/${assessment.id}/submissions`);
  };

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
            </div>
          </CardContent>
        </Card>

        {/* Questions and Answers */}
        {submission.answers.map((answer, index) => {
          const question = questions.find((q) => q.id === answer.questionId);
          if (!question) return null;

          const isDescriptive = question.type === "Descriptive";
          const isAutoGraded = question.type === "MCQ" || question.type === "SCQ" || question.type === "True/False";

          return (
            <Card key={question.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Question {index + 1}</Badge>
                      <Badge variant="outline">{question.type}</Badge>
                      <span className="text-sm text-gray-500 ml-auto">
                        {question.points} points
                      </span>
                    </div>
                    <CardTitle className="text-base">{question.text}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Correct Answer (for objective questions) */}
                {isAutoGraded && (
                  <div>
                    <Label className="text-sm text-gray-500">Correct Answer</Label>
                    <p className="font-medium text-green-600">{String(question.correctAnswer)}</p>
                  </div>
                )}

                {/* Student Answer */}
                <div>
                  <Label className="text-sm text-gray-500">Student Answer</Label>
                  <p className="font-medium">{String(answer.answer) || "(No answer)"}</p>
                </div>

                {/* Descriptive Question Auto-Grading Analysis */}
                {isDescriptive && answer.detectedKeywords && (
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <Label className="text-sm font-semibold text-blue-900">
                        Auto-Grading Analysis
                      </Label>
                    </div>
                    
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
                        <Label className="text-xs text-gray-600">Auto Score</Label>
                        <p className="text-lg font-bold text-blue-900">
                          {answer.autoScore}/{question.points}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reference Answer (for descriptive) */}
                {isDescriptive && question.referenceAnswer && (
                  <div>
                    <Label className="text-sm text-gray-500">Reference Answer</Label>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                      {question.referenceAnswer}
                    </p>
                  </div>
                )}

                {/* Score Input */}
                <div>
                  <Label htmlFor={`score-${question.id}`}>
                    {isDescriptive ? "Final Score (adjust if needed)" : "Score"}
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id={`score-${question.id}`}
                      type="number"
                      min="0"
                      max={question.points}
                      defaultValue={isDescriptive ? answer.autoScore : undefined}
                      onChange={(e) => handleScoreChange(question.id, parseFloat(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-gray-500">/ {question.points} points</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Overall Feedback */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Add comments or feedback for the student..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleSaveGrade}>
              Save Draft
            </Button>
            <Button onClick={handlePublishGrade} disabled={!canFinalize}>
              Publish Grade & Notify Student
            </Button>
          </div>
          {!canFinalize && (
            <p className="text-xs text-gray-500">
              Only the module Lecturer can finalize and publish grades. You can still review and save draft scores.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
