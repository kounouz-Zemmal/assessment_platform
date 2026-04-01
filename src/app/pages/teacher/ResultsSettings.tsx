import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
  assessments as allAssessments,
  modules,
  getCurrentUser,
  teacherAssignments,
} from "../../mockData";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { Assessment, AssessmentResultsVisibility } from "../../types";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Search } from "lucide-react";

function normalizeVisibility(
  assessment: Assessment,
): AssessmentResultsVisibility {
  const visibility = assessment.resultsVisibility;

  const showFinalScore =
    visibility?.showFinalScore ?? visibility?.showScore ?? true;
  const showScoreBreakdown =
    visibility?.showScoreBreakdown ?? visibility?.showQuestionBreakdown ?? true;
  const showAiKeywordAnalysis =
    visibility?.showAiKeywordAnalysis ??
    visibility?.showKeywordAnalysis ??
    true;
  const showPerQuestionDetails =
    visibility?.showPerQuestionDetails ?? showScoreBreakdown;
  const showTeacherFeedback = visibility?.showTeacherFeedback ?? true;

  return {
    showFinalScore,
    showScoreBreakdown,
    showTeacherFeedback,
    showAiKeywordAnalysis,
    showPerQuestionDetails,
    // Keep compatibility for existing student pages still using legacy keys.
    showScore: showFinalScore,
    showQuestionBreakdown: showScoreBreakdown,
    showKeywordAnalysis: showAiKeywordAnalysis,
  };
}

function withSyncedVisibility(
  current: AssessmentResultsVisibility,
  key:
    | "showFinalScore"
    | "showScoreBreakdown"
    | "showTeacherFeedback"
    | "showAiKeywordAnalysis"
    | "showPerQuestionDetails",
): AssessmentResultsVisibility {
  const nextValue = !current[key];
  const next = {
    ...current,
    [key]: nextValue,
  };

  return {
    ...next,
    showScore: next.showFinalScore,
    showQuestionBreakdown: next.showScoreBreakdown,
    showKeywordAnalysis: next.showAiKeywordAnalysis,
  };
}

export default function TeacherResultsSettings() {
  const currentUser = getCurrentUser();

  const authorizedAssessments = useMemo(() => {
    const assignedModuleIds = new Set(
      teacherAssignments
        .filter((assignment) => assignment.teacherId === currentUser.id)
        .map((assignment) => assignment.moduleId),
    );

    return allAssessments.filter(
      (assessment) =>
        assessment.createdBy === currentUser.id ||
        assignedModuleIds.has(assessment.moduleId),
    );
  }, [currentUser.id]);

  const [assessments, setAssessments] = useState(
    authorizedAssessments.map((assessment) => ({
      ...assessment,
      resultsVisibility: normalizeVisibility(assessment),
    })),
  );
  const [dirtyAssessmentIds, setDirtyAssessmentIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const resetUnsavedChanges = () => {
    const dirtySet = new Set(dirtyAssessmentIds);
    if (dirtySet.size === 0) return;

    setAssessments((prev) =>
      prev.map((assessment) => {
        if (!dirtySet.has(assessment.id)) return assessment;
        const source = allAssessments.find((item) => item.id === assessment.id);
        return source
          ? {
              ...assessment,
              resultsVisibility: normalizeVisibility(source),
            }
          : assessment;
      }),
    );

    setDirtyAssessmentIds([]);
    toast.info("Unsaved changes discarded");
  };

  const handleToggleVisibility = (
    assessmentId: string,
    key:
      | "showFinalScore"
      | "showScoreBreakdown"
      | "showTeacherFeedback"
      | "showAiKeywordAnalysis"
      | "showPerQuestionDetails",
  ) => {
    setAssessments((prev) =>
      prev.map((a) =>
        a.id === assessmentId
          ? {
              ...a,
              resultsVisibility: withSyncedVisibility(
                normalizeVisibility(a),
                key,
              ),
            }
          : a,
      ),
    );

    setDirtyAssessmentIds((prev) =>
      prev.includes(assessmentId) ? prev : [...prev, assessmentId],
    );
  };

  const saveAssessmentSettings = (assessmentId: string) => {
    const updated = assessments.find(
      (assessment) => assessment.id === assessmentId,
    );
    if (!updated?.resultsVisibility) return;

    const targetIndex = allAssessments.findIndex(
      (assessment) => assessment.id === assessmentId,
    );
    if (targetIndex >= 0) {
      allAssessments[targetIndex] = {
        ...allAssessments[targetIndex],
        resultsVisibility: updated.resultsVisibility,
      };
    }

    setDirtyAssessmentIds((prev) => prev.filter((id) => id !== assessmentId));
    toast.success("Visibility settings saved", {
      description: `Updated settings for ${updated.title}.`,
    });
  };

  const saveAllSettings = () => {
    if (dirtyAssessmentIds.length === 0) return;

    const dirtySet = new Set(dirtyAssessmentIds);
    const changedAssessments = assessments.filter((assessment) =>
      dirtySet.has(assessment.id),
    );

    changedAssessments.forEach((updated) => {
      if (!updated.resultsVisibility) return;
      const targetIndex = allAssessments.findIndex(
        (assessment) => assessment.id === updated.id,
      );
      if (targetIndex >= 0) {
        allAssessments[targetIndex] = {
          ...allAssessments[targetIndex],
          resultsVisibility: updated.resultsVisibility,
        };
      }
    });

    const changedCount = changedAssessments.length;
    setDirtyAssessmentIds([]);
    toast.success("All visibility settings saved", {
      description: `Updated ${changedCount} assessment${changedCount > 1 ? "s" : ""}.`,
    });
  };

  const filterModules = useMemo(() => {
    const ids = Array.from(
      new Set(assessments.map((assessment) => assessment.moduleId)),
    );
    return ids
      .map((id) => modules.find((module) => module.id === id))
      .filter((module): module is NonNullable<typeof module> =>
        Boolean(module),
      );
  }, [assessments]);

  const filterStatuses = useMemo(() => {
    return Array.from(
      new Set(assessments.map((assessment) => assessment.status)),
    );
  }, [assessments]);

  const filteredAssessments = useMemo(() => {
    return assessments.filter((assessment) => {
      const module = modules.find((item) => item.id === assessment.moduleId);
      const matchesSearch =
        assessment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        module?.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        module?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesModule =
        moduleFilter === "all" || assessment.moduleId === moduleFilter;
      const matchesStatus =
        statusFilter === "all" || assessment.status === statusFilter;

      return Boolean(matchesSearch) && matchesModule && matchesStatus;
    });
  }, [assessments, searchQuery, moduleFilter, statusFilter]);

  if (currentUser.role !== "teacher") {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-700 font-medium">
              Only teachers can edit result visibility settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline" className="mb-2 bg-white">
              Publishing Controls
            </Badge>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
              Result Visibility
            </h1>
            <p className="text-gray-500 mt-1">
              Control what students can see after an assessment is graded and
              published.
            </p>
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={saveAllSettings}
            disabled={dirtyAssessmentIds.length === 0}
          >
            Save All Changes
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline">Assessments: {assessments.length}</Badge>
        <Badge variant="outline">Showing: {filteredAssessments.length}</Badge>
        <Badge variant="secondary">Unsaved: {dirtyAssessmentIds.length}</Badge>
      </div>

      <Card className="mb-6 border-gray-200 shadow-sm">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-700">
            These settings are stored per assessment and applied when students
            open their results page.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6 border-gray-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by assessment or module"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {filterModules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.code} - {module.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {filterStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {filteredAssessments.map((assessment) => {
          const module = modules.find((m) => m.id === assessment.moduleId);
          const visibility = normalizeVisibility(assessment);
          const hasUnsavedChanges = dirtyAssessmentIds.includes(assessment.id);

          return (
            <Card
              className="shadow-sm border-gray-200 transition-all duration-200 ease-out hover:shadow-md"
              key={assessment.id}
            >
              <CardHeader>
                <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{assessment.title}</p>
                    <p className="text-sm text-gray-500">
                      {module?.code} • {assessment.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {hasUnsavedChanges && (
                      <Badge variant="secondary">Unsaved changes</Badge>
                    )}
                    <Badge variant="outline">{assessment.status}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <Label className="text-sm">Show final score</Label>
                      <p className="text-xs text-gray-500">
                        Display percentage and total points.
                      </p>
                    </div>
                    <Switch
                      className="mt-1 shrink-0"
                      checked={visibility.showFinalScore}
                      onCheckedChange={() =>
                        handleToggleVisibility(assessment.id, "showFinalScore")
                      }
                    />
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <Label className="text-sm">Show score breakdown</Label>
                      <p className="text-xs text-gray-500">
                        Show score split by sections/questions.
                      </p>
                    </div>
                    <Switch
                      className="mt-1 shrink-0"
                      checked={visibility.showScoreBreakdown}
                      onCheckedChange={() =>
                        handleToggleVisibility(
                          assessment.id,
                          "showScoreBreakdown",
                        )
                      }
                    />
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <Label className="text-sm">Show teacher feedback</Label>
                      <p className="text-xs text-gray-500">
                        Show comments entered during grading.
                      </p>
                    </div>
                    <Switch
                      className="mt-1 shrink-0"
                      checked={visibility.showTeacherFeedback}
                      onCheckedChange={() =>
                        handleToggleVisibility(
                          assessment.id,
                          "showTeacherFeedback",
                        )
                      }
                    />
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <Label className="text-sm">
                        Show AI keyword analysis
                      </Label>
                      <p className="text-xs text-gray-500">
                        Show detected/missing keywords for descriptive answers.
                      </p>
                    </div>
                    <Switch
                      className="mt-1 shrink-0"
                      checked={visibility.showAiKeywordAnalysis}
                      onCheckedChange={() =>
                        handleToggleVisibility(
                          assessment.id,
                          "showAiKeywordAnalysis",
                        )
                      }
                    />
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <Label className="text-sm">
                        Show per-question details
                      </Label>
                      <p className="text-xs text-gray-500">
                        Show answers, correctness, and per-question review
                        block.
                      </p>
                    </div>
                    <Switch
                      className="mt-1 shrink-0"
                      checked={visibility.showPerQuestionDetails}
                      onCheckedChange={() =>
                        handleToggleVisibility(
                          assessment.id,
                          "showPerQuestionDetails",
                        )
                      }
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => saveAssessmentSettings(assessment.id)}
                    disabled={!hasUnsavedChanges}
                  >
                    Save Visibility Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {assessments.length === 0 && (
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="py-12 text-center text-gray-500">
              You do not have any authorized assessments to configure.
            </CardContent>
          </Card>
        )}

        {assessments.length > 0 && filteredAssessments.length === 0 && (
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="py-12 text-center text-gray-500">
              No assessments match the current filters.
            </CardContent>
          </Card>
        )}
      </div>

      {dirtyAssessmentIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] sm:w-auto">
          <Card className="shadow-lg border-blue-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
            <CardContent className="py-3 px-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <p className="text-sm text-gray-700">
                {dirtyAssessmentIds.length} assessment
                {dirtyAssessmentIds.length > 1 ? "s" : ""} have unsaved changes.
              </p>
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto transition-all duration-200 ease-out hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                  onClick={resetUnsavedChanges}
                >
                  Discard
                </Button>
                <Button
                  className="w-full sm:w-auto transition-all duration-200 ease-out hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                  onClick={saveAllSettings}
                >
                  Save All
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
