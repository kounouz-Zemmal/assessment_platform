import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { ExamTimer } from "../../components/ExamTimer";
import { assessments, questions, modules } from "../../mockData";
import { toast } from "sonner";

export default function StudentTakeExam() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const assessment = assessments.find((a) => a.id === id);
  const assessmentQuestions = assessment ? questions.filter((q) => assessment.questions.includes(q.id)) : [];
  const module = assessment ? modules.find((m) => m.id === assessment.moduleId) : null;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [lastSaved, setLastSaved] = useState(new Date());
  const [tabWarningShown, setTabWarningShown] = useState(false);

  const shuffledOptionsByQuestionId = useMemo(() => {
    if (!assessment?.shuffleAnswers) return {};

    const map: Record<string, string[]> = {};
    assessmentQuestions.forEach((q) => {
      if (q.options && (q.type === "MCQ" || q.type === "SCQ" || q.type === "True/False")) {
        const copied = [...q.options];
        for (let i = copied.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copied[i], copied[j]] = [copied[j], copied[i]];
        }
        map[q.id] = copied;
      }
    });
    return map;
  }, [assessment, assessmentQuestions]);

  useEffect(() => {
    if (!assessment?.tabSwitchWarning) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !tabWarningShown) {
        setTabWarningShown(true);
        toast.warning("Tab switch detected. Please stay on the exam page to avoid issues.", {
          duration: 4000,
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [assessment, tabWarningShown]);

  if (!assessment || assessmentQuestions.length === 0) {
    return <div className="p-8">Assessment not found</div>;
  }

  const currentQuestion = assessmentQuestions[currentQuestionIndex];

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });
    setLastSaved(new Date());
    // Simulate auto-save
    setTimeout(() => {
      toast.success("Answer saved", { duration: 1000 });
    }, 500);
  };

  const handleNext = () => {
    if (currentQuestionIndex < assessmentQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = () => {
    toast.success("Assessment submitted successfully!");
    navigate(`/student/assessments/${id}/results`);
  };

  const handleTimeUp = () => {
    if (assessment.autoSubmitOnTimeout !== false) {
      toast.error("Time's up! Your assessment has been automatically submitted.");
      navigate(`/student/assessments/${id}/results`);
    } else {
      toast.error("Time's up! You can no longer change your answers.");
    }
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{assessment.title}</h1>
            <p className="text-sm text-gray-500">{module?.code}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              Last saved: {lastSaved.toLocaleTimeString()}
            </div>
            <ExamTimer
              durationMinutes={assessment.duration}
              onTimeUp={handleTimeUp}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Navigator */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-base">Questions</CardTitle>
                <p className="text-sm text-gray-500">
                  {answeredCount} of {assessmentQuestions.length} answered
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 lg:grid-cols-4 gap-2">
                  {assessmentQuestions.map((q, index) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(index)}
                      className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                        index === currentQuestionIndex
                          ? "bg-blue-600 text-white"
                          : answers[q.id]
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question Display */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline">
                        Question {currentQuestionIndex + 1} of {assessmentQuestions.length}
                      </Badge>
                      <Badge variant="outline">{currentQuestion.type}</Badge>
                      <Badge variant="secondary">{currentQuestion.points} points</Badge>
                    </div>
                    <CardTitle className="text-lg">{currentQuestion.text}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Answer Input */}
                {(currentQuestion.type === "MCQ" || currentQuestion.type === "SCQ") && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  >
                    <div className="space-y-3">
                      {(shuffledOptionsByQuestionId[currentQuestion.id] || currentQuestion.options || []).map((option, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50"
                        >
                          <RadioGroupItem value={option} id={`${currentQuestion.id}-${index}`} />
                          <Label
                            htmlFor={`${currentQuestion.id}-${index}`}
                            className="flex-1 cursor-pointer"
                          >
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                )}

                {currentQuestion.type === "True/False" && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value="True" id={`${currentQuestion.id}-true`} />
                        <Label
                          htmlFor={`${currentQuestion.id}-true`}
                          className="flex-1 cursor-pointer"
                        >
                          True
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value="False" id={`${currentQuestion.id}-false`} />
                        <Label
                          htmlFor={`${currentQuestion.id}-false`}
                          className="flex-1 cursor-pointer"
                        >
                          False
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                )}

                {currentQuestion.type === "Descriptive" && (
                  <div className="space-y-2">
                    <Label htmlFor="answer">Your Answer</Label>
                    <Textarea
                      id="answer"
                      value={answers[currentQuestion.id] || ""}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Type your answer here..."
                      rows={10}
                      className="resize-none"
                    />
                    <p className="text-sm text-gray-500">
                      Write a detailed answer. Your response will be evaluated based on key concepts.
                    </p>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </Button>

                  {currentQuestionIndex < assessmentQuestions.length - 1 ? (
                    <Button onClick={handleNext}>
                      Next Question
                    </Button>
                  ) : (
                    <>
                      <Button onClick={() => setShowSubmitDialog(true)}>
                        Submit Assessment
                      </Button>

                      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Submit Assessment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {answeredCount < assessmentQuestions.length && (
                                <div className="flex items-start gap-2 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                                  <div>
                                    <p className="text-sm text-yellow-800">
                                      You have answered {answeredCount} out of {assessmentQuestions.length} questions.
                                    </p>
                                  </div>
                                </div>
                              )}
                              Are you sure you want to submit your assessment? You will not be able to change your answers after submission.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Review Answers</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSubmit}>
                              Yes, Submit
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
