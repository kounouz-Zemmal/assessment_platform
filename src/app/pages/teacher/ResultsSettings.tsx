import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { assessments as allAssessments, modules, getCurrentUser } from "../../mockData";
import { useState } from "react";

export default function TeacherResultsSettings() {
  const currentUser = getCurrentUser();
  const [assessments, setAssessments] = useState(
    allAssessments.filter((a) => a.createdBy === currentUser.id)
  );

  const handleToggleVisibility = (
    assessmentId: string,
    key: "showScore" | "showQuestionBreakdown" | "showKeywordAnalysis"
  ) => {
    setAssessments((prev) =>
      prev.map((a) =>
        a.id === assessmentId
          ? {
              ...a,
              resultsVisibility: {
                showScore: a.resultsVisibility?.showScore ?? true,
                showQuestionBreakdown: a.resultsVisibility?.showQuestionBreakdown ?? true,
                showKeywordAnalysis: a.resultsVisibility?.showKeywordAnalysis ?? true,
                [key]: !(
                  a.resultsVisibility && a.resultsVisibility[key]
                ),
              },
            }
          : a
      )
    );
    // TODO: Persist visibility preferences to backend
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Result Visibility</h1>
        <p className="text-gray-500 mt-1">
          Control what students can see when viewing their assessment results.
        </p>
      </div>

      <div className="space-y-6">
        {assessments.map((assessment) => {
          const module = modules.find((m) => m.id === assessment.moduleId);
          const visibility = assessment.resultsVisibility ?? {
            showScore: true,
            showQuestionBreakdown: true,
            showKeywordAnalysis: true,
          };

          return (
            <Card key={assessment.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold">{assessment.title}</p>
                    <p className="text-sm text-gray-500">
                      {module?.code} • {assessment.status}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {assessment.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <Label className="text-sm">Show overall score</Label>
                      <p className="text-xs text-gray-500">
                        Percentage and total points.
                      </p>
                    </div>
                    <Switch
                      checked={visibility.showScore}
                      onCheckedChange={() =>
                        handleToggleVisibility(assessment.id, "showScore")
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <Label className="text-sm">Show question breakdown</Label>
                      <p className="text-xs text-gray-500">
                        Per-question answers and correctness.
                      </p>
                    </div>
                    <Switch
                      checked={visibility.showQuestionBreakdown}
                      onCheckedChange={() =>
                        handleToggleVisibility(assessment.id, "showQuestionBreakdown")
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <Label className="text-sm">Show keyword analysis</Label>
                      <p className="text-xs text-gray-500">
                        Detected/missing keywords for descriptive questions.
                      </p>
                    </div>
                    <Switch
                      checked={visibility.showKeywordAnalysis}
                      onCheckedChange={() =>
                        handleToggleVisibility(assessment.id, "showKeywordAnalysis")
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {assessments.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              You have not created any assessments yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

