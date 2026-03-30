import { useNavigate, useParams } from "react-router";
import { AlertCircle, Clock, FileText, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { assessments, modules } from "../../mockData";

export default function StudentExamInstructions() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const assessment = assessments.find((a) => a.id === id);
  const module = assessment ? modules.find((m) => m.id === assessment.moduleId) : null;

  if (!assessment || !module) {
    return <div className="p-8">Assessment not found</div>;
  }

  const handleStartExam = () => {
    navigate(`/student/assessments/${id}/take`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{assessment.title}</CardTitle>
            <p className="text-gray-500">{module.code} - {module.name}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please read all instructions carefully before starting the assessment.
              </AlertDescription>
            </Alert>

            {/* Assessment Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <Clock className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="font-semibold text-lg">{assessment.duration} minutes</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                <FileText className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Questions</p>
                  <p className="font-semibold text-lg">{assessment.questions.length}</p>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Instructions</h3>
              {assessment.instructions && (
                <p className="text-gray-700 whitespace-pre-line">
                  {assessment.instructions}
                </p>
              )}
              <ul className="space-y-2 text-gray-700">
                <li className="flex gap-2">
                  <span className="text-blue-600 font-semibold">1.</span>
                  <span>You will have <strong>{assessment.duration} minutes</strong> to complete this assessment.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-semibold">2.</span>
                  <span>The timer will start as soon as you click "Start Assessment".</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-semibold">3.</span>
                  <span>Your answers will be <strong>auto-saved</strong> as you progress.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-semibold">4.</span>
                  <span>You can navigate between questions using the question navigator.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-semibold">5.</span>
                  <span>Once you submit, you <strong>cannot</strong> change your answers.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-semibold">6.</span>
                  <span>
                    {assessment.autoSubmitOnTimeout !== false
                      ? "If time runs out, your assessment will be automatically submitted."
                      : "When time runs out, you will no longer be able to change your answers."}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-semibold">7.</span>
                  <span>Make sure you have a stable internet connection.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-semibold">8.</span>
                  <span>Do not refresh or close the browser during the assessment.</span>
                </li>
              </ul>
            </div>

            {/* Anti-cheating summary */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Anti-cheating settings</h3>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>
                  Question order:{" "}
                  <span className="font-medium">
                    {assessment.randomize ? "Randomized per student" : "Same for all students"}
                  </span>
                </li>
                <li>
                  Answer options:{" "}
                  <span className="font-medium">
                    {assessment.shuffleAnswers ? "Shuffled" : "Fixed order"}
                  </span>
                </li>
                <li>
                  Time-out behavior:{" "}
                  <span className="font-medium">
                    {assessment.autoSubmitOnTimeout !== false
                      ? "Auto-submit on time-out"
                      : "Answers locked when time is over"}
                  </span>
                </li>
                <li>
                  Tab switching:{" "}
                  <span className="font-medium">
                    {assessment.tabSwitchWarning
                      ? "Tab/window switching may trigger a warning"
                      : "No tab-switch warnings configured"}
                  </span>
                </li>
              </ul>
            </div>

            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Once you start the assessment, you must complete it in one sitting. Make sure you have enough time before proceeding.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/student/assessments")}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStartExam}
                className="flex-1"
              >
                Start Assessment
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
