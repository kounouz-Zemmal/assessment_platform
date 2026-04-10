import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Plus, X, Sparkles } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Badge } from "../../components/ui/badge";
import { QuestionType } from "../../types";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost } from "../../apiClient";

export default function TeacherCreateQuestion() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [topicCreating, setTopicCreating] = useState(false);
  const [showQuickTopicForm, setShowQuickTopicForm] = useState(false);
  const [quickTopicName, setQuickTopicName] = useState("");
  const [modules, setModules] = useState<Array<{ id: string; code: string; name: string; topics: Array<{ id: string; name: string }> }>>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    moduleId: "",
    topicId: "",
    type: "MCQ" as QuestionType,
    difficulty: "Medium",
    status: "Draft",
    text: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    referenceAnswer: "",
    keywords: [] as Array<{ text: string; weight: number; synonyms?: string[] }>,
  });

  const [newKeyword, setNewKeyword] = useState({ text: "", weight: 1, synonymsText: "" });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiGet<{ modules: Array<{ id: string; code: string; name: string; topics: Array<{ id: string; name: string }> }> }>("teacher/modules"),
      isEditing ? apiGet<{ question: any }>(`teacher/questions/${id}`) : Promise.resolve(null),
    ])
      .then(([modulesData, questionData]) => {
        setModules(modulesData.modules);
        if (questionData?.question) {
          setFormData({
            moduleId: questionData.question.moduleId || "",
            topicId: questionData.question.topicId || "",
            type: questionData.question.type || "MCQ",
            difficulty: questionData.question.difficulty || "Medium",
            status: questionData.question.status || "Draft",
            text: questionData.question.text || "",
            options:
              questionData.question.options && questionData.question.options.length > 0
                ? questionData.question.options
                : ["", "", "", ""],
            correctAnswer: questionData.question.correctAnswer || "",
            referenceAnswer: questionData.question.referenceAnswer || "",
            keywords: questionData.question.keywords || [],
          });
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load question form");
      })
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  const selectedModule = useMemo(
    () => modules.find((m) => m.id === formData.moduleId),
    [modules, formData.moduleId]
  );

  const handleAddKeyword = () => {
    if (!newKeyword.text.trim()) return;

    const synonyms =
      newKeyword.synonymsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) || [];

    setFormData({
      ...formData,
      keywords: [
        ...formData.keywords,
        { text: newKeyword.text, weight: newKeyword.weight, synonyms },
      ],
    });
    setNewKeyword({ text: "", weight: 1, synonymsText: "" });
  };

  const handleRemoveKeyword = (index: number) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter((_, i) => i !== index),
    });
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setFormErrors({});

    const payload = {
      moduleId: formData.moduleId,
      topicId: formData.topicId || null,
      type: formData.type,
      difficulty: formData.difficulty,
      status: formData.status,
      text: formData.text,
      options:
        formData.type === "MCQ" || formData.type === "SCQ"
          ? formData.options.filter((option) => option.trim())
          : [],
      correctAnswer: formData.correctAnswer,
      referenceAnswer: formData.referenceAnswer,
      keywords: formData.keywords,
    };

    const request = isEditing
      ? apiPatch<{ question: { id: string } }>(`teacher/questions/${id}`, payload)
      : apiPost<{ question: { id: string } }>("teacher/questions", payload);

    request
      .then(() => {
        toast.success(isEditing ? "Question updated successfully" : "Question created successfully");
        navigate("/teacher/questions");
      })
      .catch((err: any) => {
        const message = err instanceof Error ? err.message : "Failed to save question";
        if (err && typeof err === "object" && "errors" in err && err.errors) {
          setFormErrors(err.errors as Record<string, string>);
        }
        toast.error(message);
      })
      .finally(() => setSubmitLoading(false));
  };

  const difficultyPoints = formData.difficulty === "Easy" ? 1 : formData.difficulty === "Hard" ? 3 : 2;

  const handleQuickCreateTopic = async () => {
    if (!formData.moduleId) {
      toast.error("Select a module first");
      return;
    }
    if (!quickTopicName.trim()) {
      toast.error("Topic name is required");
      return;
    }
    setTopicCreating(true);
    try {
      const created = await apiPost<{ topic: { id: string; name: string; moduleId: string } }>("teacher/topics", {
        moduleId: formData.moduleId,
        name: quickTopicName.trim(),
      });
      setModules((prev) =>
        prev.map((module) =>
          module.id === formData.moduleId
            ? { ...module, topics: [...module.topics, { id: created.topic.id, name: created.topic.name }] }
            : module
        )
      );
      setFormData((prev) => ({ ...prev, topicId: created.topic.id }));
      setQuickTopicName("");
      setShowQuickTopicForm(false);
      toast.success("Topic created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create topic");
    } finally {
      setTopicCreating(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Loading question form...</div>;
  }

  return (
    <div className="p-8">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate("/teacher/questions")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Question Bank
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? "Edit Question" : "Create New Question"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEditing ? "Update question details" : "Add a new question to your bank"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        {/* Module and Topic */}
        <Card>
          <CardHeader>
            <CardTitle>Module & Topic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="module">Module *</Label>
                <Select
                  value={formData.moduleId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, moduleId: value, topicId: "" });
                    setFormErrors((prev) => ({ ...prev, moduleId: "" }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.code} - {module.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.moduleId && <p className="text-xs text-red-600">{formErrors.moduleId}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="topic">Topic</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-blue-600"
                    onClick={() => setShowQuickTopicForm((value) => !value)}
                    disabled={!formData.moduleId}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Quick Create Topic
                  </Button>
                </div>
                <Select
                  value={formData.topicId}
                  onValueChange={(value) => setFormData({ ...formData, topicId: value })}
                  disabled={!formData.moduleId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedModule?.topics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showQuickTopicForm && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="New topic name"
                      value={quickTopicName}
                      onChange={(e) => setQuickTopicName(e.target.value)}
                    />
                    <Button type="button" onClick={handleQuickCreateTopic} disabled={topicCreating}>
                      Add
                    </Button>
                  </div>
                )}
                {formErrors.topicId && <p className="text-xs text-red-600">{formErrors.topicId}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Type and Points */}
        <Card>
          <CardHeader>
            <CardTitle>Question Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Question Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as QuestionType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MCQ">Multiple Choice (MCQ)</SelectItem>
                    <SelectItem value="SCQ">Single Choice (SCQ)</SelectItem>
                    <SelectItem value="True/False">True/False</SelectItem>
                    <SelectItem value="Descriptive">Descriptive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Difficulty *</Label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(value) => setFormData({ ...formData, difficulty: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Pending Review">Pending Review</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Points are assigned automatically from difficulty: Easy=1, Medium=2, Hard=3.
            </p>

            <div className="space-y-2">
              <Label htmlFor="text">Question Text *</Label>
              <Textarea
                id="text"
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="Enter your question here..."
                rows={4}
              />
                {formErrors.text && <p className="text-xs text-red-600">{formErrors.text}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Question-specific fields */}
        {(formData.type === "MCQ" || formData.type === "SCQ") && (
          <Card>
            <CardHeader>
              <CardTitle>Answer Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={formData.correctAnswer as string}
                onValueChange={(value) => setFormData({ ...formData, correctAnswer: value })}
              >
                {formData.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Input
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1"
                    />
                  </div>
                ))}
              </RadioGroup>
              {formErrors.correctAnswer && <p className="text-xs text-red-600">{formErrors.correctAnswer}</p>}
              <p className="text-sm text-gray-500">
                Select the correct answer by clicking the radio button
              </p>
            </CardContent>
          </Card>
        )}

        {formData.type === "True/False" && (
          <Card>
            <CardHeader>
              <CardTitle>Correct Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.correctAnswer as string}
                onValueChange={(value) => setFormData({ ...formData, correctAnswer: value })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="True" id="true" />
                  <Label htmlFor="true">True</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="False" id="false" />
                  <Label htmlFor="false">False</Label>
                </div>
              </RadioGroup>
              {formErrors.correctAnswer && <p className="text-xs text-red-600">{formErrors.correctAnswer}</p>}
            </CardContent>
          </Card>
        )}

        {formData.type === "Descriptive" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Reference Answer</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.referenceAnswer}
                  onChange={(e) => setFormData({ ...formData, referenceAnswer: e.target.value })}
                  placeholder="Provide a model answer for reference..."
                  rows={5}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Keywords for Auto-Grading</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Add keywords that should be present in student answers. You can also add comma-separated
                  synonyms for each keyword to handle wording variations.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-[2fr,2fr,auto] gap-2">
                    <Input
                      placeholder="Keyword"
                      value={newKeyword.text}
                      onChange={(e) => setNewKeyword({ ...newKeyword, text: e.target.value })}
                    />
                    <Input
                      placeholder="Synonyms / variants (comma separated)"
                      value={newKeyword.synonymsText}
                      onChange={(e) =>
                        setNewKeyword({ ...newKeyword, synonymsText: e.target.value })
                      }
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        placeholder="Weight"
                        value={newKeyword.weight}
                        onChange={(e) =>
                          setNewKeyword({
                            ...newKeyword,
                            weight: parseInt(e.target.value || "1", 10),
                          })
                        }
                        className="w-20"
                      />
                      <Button type="button" onClick={handleAddKeyword}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="gap-2">
                      <span>
                        {keyword.text}
                        {keyword.synonyms && keyword.synonyms.length > 0 && (
                          <> ({keyword.synonyms.join(", ")})</>
                        )}
                      </span>
                      <span className="text-xs text-gray-700">
                        • weight: {keyword.weight}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(index)}
                        className="hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>

                {formData.keywords.length > 0 && (
                  <p className="text-sm text-gray-500">
                    Total weight: {formData.keywords.reduce((sum, kw) => sum + kw.weight, 0)} / {difficultyPoints} points
                  </p>
                )}
                {formErrors.keywords && <p className="text-xs text-red-600">{formErrors.keywords}</p>}
              </CardContent>
            </Card>
          </>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/teacher/questions")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitLoading}>
            {isEditing ? "Update Question" : "Create Question"}
          </Button>
        </div>
      </form>
    </div>
  );
}
