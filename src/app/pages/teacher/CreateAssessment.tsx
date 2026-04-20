import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Checkbox } from "../../components/ui/checkbox";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { apiGet, apiPatch, apiPost } from "../../apiClient";

export default function TeacherCreateAssessment() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { user } = useAuth();

  if (!user) {
    return <div className="p-8">Loading...</div>;
  }
  
  const [isLoadingAssessment, setIsLoadingAssessment] = useState(isEditing);
  const [teacherModules, setTeacherModules] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      topics: Array<{ id: string; name: string; moduleId: string }>;
    }>
  >([]);
  const [moduleQuestions, setModuleQuestions] = useState<
    Array<{
      id: string;
      moduleId: string;
      topicId: string;
      type: string;
      text: string;
      points: number;
      createdBy: string;
    }>
  >([]);
  const assignedModuleIds = useMemo(
    () => teacherModules.map((module) => String(module.id)),
    [teacherModules]
  );

  const [formData, setFormData] = useState({
    title: "",
    moduleId: "",
    duration: 60,
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    selectedQuestions: [] as string[],
    randomize: false,
    instructions: "",
    shuffleAnswers: true,
    autoSubmitOnTimeout: true,
    tabSwitchWarning: false,
  });

  useEffect(() => {
    apiGet<{
      modules: Array<{
        id: string;
        code: string;
        name: string;
        topics: Array<{ id: string; name: string; moduleId: string }>;
      }>;
    }>("teacher/modules")
      .then((data) => setTeacherModules(data.modules))
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Failed to load assigned modules";
        toast.error(message);
        setTeacherModules([]);
      });
  }, []);

  useEffect(() => {
    if (!isEditing || !id) return;

    setIsLoadingAssessment(true);
    apiGet<{
      assessment: {
        id: string;
        title: string;
        moduleId: string;
        duration: number;
        startTime: string | null;
        endTime: string | null;
        questions: string[];
        randomize: boolean;
        instructions?: string;
        shuffleAnswers?: boolean;
        autoSubmitOnTimeout?: boolean;
        tabSwitchWarning?: boolean;
      };
    }>(`teacher/assessments/${id}`)
      .then((data) => {
        const assessment = data.assessment;
        setFormData({
          title: assessment.title || "",
          moduleId: assessment.moduleId || "",
          duration: assessment.duration || 60,
          startDate: assessment.startTime
            ? new Date(assessment.startTime).toISOString().split("T")[0]
            : "",
          startTime: assessment.startTime
            ? new Date(assessment.startTime).toTimeString().slice(0, 5)
            : "",
          endDate: assessment.endTime
            ? new Date(assessment.endTime).toISOString().split("T")[0]
            : "",
          endTime: assessment.endTime
            ? new Date(assessment.endTime).toTimeString().slice(0, 5)
            : "",
          selectedQuestions: assessment.questions || [],
          randomize: assessment.randomize || false,
          instructions: assessment.instructions || "",
          shuffleAnswers: assessment.shuffleAnswers ?? true,
          autoSubmitOnTimeout: assessment.autoSubmitOnTimeout ?? true,
          tabSwitchWarning: assessment.tabSwitchWarning ?? false,
        });
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to load assessment");
        navigate("/teacher/assessments");
      })
      .finally(() => setIsLoadingAssessment(false));
  }, [isEditing, id, navigate]);

  useEffect(() => {
    if (!formData.moduleId) {
      setModuleQuestions([]);
      return;
    }

    apiGet<{
      questions: Array<{
        id: string;
        moduleId: string;
        topicId: string;
        type: string;
        text: string;
        points: number;
        createdBy: string;
      }>;
    }>("teacher/questions", { module_id: formData.moduleId, page: 1, page_size: 100 })
      .then((data) => setModuleQuestions(data.questions))
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Failed to load module questions";
        toast.error(message);
        setModuleQuestions([]);
      });
  }, [formData.moduleId]);

  const toggleQuestion = (questionId: string) => {
    setFormData({
      ...formData,
      selectedQuestions: formData.selectedQuestions.includes(questionId)
        ? formData.selectedQuestions.filter((id) => id !== questionId)
        : [...formData.selectedQuestions, questionId],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignedModuleIds.includes(formData.moduleId)) {
      toast.error("You can only create assessments for modules assigned to you");
      return;
    }
    
    if (!formData.title || !formData.moduleId || formData.selectedQuestions.length === 0) {
      toast.error("Please fill in all required fields and select at least one question");
      return;
    }

    const moduleQuestionIds = new Set(moduleQuestions.map((question) => question.id));
    const hasQuestionOutsideModule = formData.selectedQuestions.some(
      (questionId) => !moduleQuestionIds.has(questionId)
    );
    if (hasQuestionOutsideModule) {
      toast.error("You can only include questions from the selected module");
      return;
    }

    const startTimeIso =
      formData.startDate && formData.startTime
        ? new Date(`${formData.startDate}T${formData.startTime}`).toISOString()
        : null;
    const endTimeIso =
      formData.endDate && formData.endTime
        ? new Date(`${formData.endDate}T${formData.endTime}`).toISOString()
        : null;

    try {
      const payload = {
        title: formData.title.trim(),
        moduleId: formData.moduleId,
        duration: formData.duration,
        startTime: startTimeIso,
        endTime: endTimeIso,
        selectedQuestions: formData.selectedQuestions,
        randomize: formData.randomize,
        instructions: formData.instructions,
        shuffleAnswers: formData.shuffleAnswers,
        autoSubmitOnTimeout: formData.autoSubmitOnTimeout,
        tabSwitchWarning: formData.tabSwitchWarning,
      };

      if (isEditing && id) {
        await apiPatch(`teacher/assessments/${id}`, payload);
      } else {
        await apiPost("teacher/assessments", payload);
      }

      toast.success(isEditing ? "Assessment updated successfully" : "Assessment created successfully");
      navigate("/teacher/assessments");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save assessment");
    }
  };

  if (isLoadingAssessment) {
    return <div className="p-8">Loading assessment...</div>;
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
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? "Edit Assessment" : "Create New Assessment"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEditing ? "Update assessment details" : "Set up a new assessment"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Assessment Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Midterm Exam - Python Basics"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="module">Module *</Label>
              <Select
                value={formData.moduleId}
                onValueChange={(value) => setFormData({ ...formData, moduleId: value, selectedQuestions: [] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {teacherModules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.code} - {module.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {teacherModules.length === 0 && (
                <p className="text-xs text-amber-600">
                  No modules are currently assigned to you.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes) *</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions & Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions & Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="instructions">Student Instructions (optional)</Label>
              <Textarea
                id="instructions"
                rows={4}
                placeholder="Explain the scope, rules, and expectations for this assessment..."
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">Anti-cheating & behavior</p>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="shuffleAnswers"
                  checked={formData.shuffleAnswers}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, shuffleAnswers: checked as boolean })
                  }
                />
                <Label htmlFor="shuffleAnswers" className="cursor-pointer">
                  Shuffle answer options for each student
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoSubmitOnTimeout"
                  checked={formData.autoSubmitOnTimeout}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, autoSubmitOnTimeout: checked as boolean })
                  }
                />
                <Label htmlFor="autoSubmitOnTimeout" className="cursor-pointer">
                  Automatically submit when time runs out
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tabSwitchWarning"
                  checked={formData.tabSwitchWarning}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, tabSwitchWarning: checked as boolean })
                  }
                />
                <Label htmlFor="tabSwitchWarning" className="cursor-pointer">
                  Show warning when student switches tabs or windows
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Selection */}
        <Card>
          <CardHeader>
            <CardTitle>
              Select Questions
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({formData.selectedQuestions.length} selected)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!formData.moduleId ? (
              <p className="text-center text-gray-500 py-8">
                Please select a module first
              </p>
            ) : moduleQuestions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No questions available for this module.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {moduleQuestions.map((question) => {
                  const module = teacherModules.find((m) => m.id === question.moduleId);
                  const topic = module?.topics.find((t) => t.id === question.topicId);
                  
                  return (
                    <div
                      key={question.id}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={formData.selectedQuestions.includes(question.id)}
                        onCheckedChange={() => toggleQuestion(question.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{question.type}</Badge>
                          {topic && (
                            <Badge variant="outline" className="text-xs">
                              {topic.name}
                            </Badge>
                          )}
                          <span className="text-sm text-gray-500 ml-auto">
                            {question.points} pts
                          </span>
                        </div>
                        <p className="text-sm text-gray-900">{question.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center space-x-2 mt-4 pt-4 border-t">
              <Checkbox
                id="randomize"
                checked={formData.randomize}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, randomize: checked as boolean })
                }
              />
              <Label htmlFor="randomize" className="cursor-pointer">
                Randomize question order for each student
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/teacher/assessments")}
          >
            Cancel
          </Button>
          <Button type="submit">
            {isEditing ? "Update Assessment" : "Create Assessment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
