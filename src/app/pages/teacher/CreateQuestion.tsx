import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Badge } from "../../components/ui/badge";
import { modules, questions } from "../../mockData";
import { QuestionType } from "../../types";
import { toast } from "sonner";

export default function TeacherCreateQuestion() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  
  const existingQuestion = id ? questions.find((q) => q.id === id) : null;

  const [formData, setFormData] = useState({
    moduleId: existingQuestion?.moduleId || "",
    topicId: existingQuestion?.topicId || "",
    type: existingQuestion?.type || "MCQ" as QuestionType,
    text: existingQuestion?.text || "",
    points: existingQuestion?.points || 2,
    options: existingQuestion?.options || ["", "", "", ""],
    correctAnswer: existingQuestion?.correctAnswer || "",
    referenceAnswer: existingQuestion?.referenceAnswer || "",
    keywords: existingQuestion?.keywords || [],
  });

const [newKeyword, setNewKeyword] = useState({ text: "", weight: 1, synonymsText: "" });

  const selectedModule = modules.find((m) => m.id === formData.moduleId);

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
    
    if (!formData.moduleId || !formData.topicId || !formData.text) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.type === "Descriptive" && formData.keywords.length === 0) {
      toast.error("Please add at least one keyword for descriptive questions");
      return;
    }

    toast.success(isEditing ? "Question updated successfully" : "Question created successfully");
    navigate("/teacher/questions");
  };

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
                  onValueChange={(value) => setFormData({ ...formData, moduleId: value, topicId: "" })}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic">Topic *</Label>
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
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="points">Points *</Label>
                <Input
                  id="points"
                  type="number"
                  min="1"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="text">Question Text *</Label>
              <Textarea
                id="text"
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="Enter your question here..."
                rows={4}
              />
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
                    Total weight: {formData.keywords.reduce((sum, kw) => sum + kw.weight, 0)} / {formData.points} points
                  </p>
                )}
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
          <Button type="submit">
            {isEditing ? "Update Question" : "Create Question"}
          </Button>
        </div>
      </form>
    </div>
  );
}
