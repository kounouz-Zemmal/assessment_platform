import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Pencil, Trash2, Filter } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { questions, modules, getCurrentUser } from "../../mockData";
import { QuestionType } from "../../types";
import { toast } from "sonner";

export default function TeacherQuestionBank() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const myQuestions = questions.filter((q) => q.createdBy === currentUser.id);

  const filteredQuestions = myQuestions.filter((question) => {
    const matchesSearch = question.text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = filterModule === "all" || question.moduleId === filterModule;
    const matchesType = filterType === "all" || question.type === filterType;
    
    return matchesSearch && matchesModule && matchesType;
  });

  const getTypeColor = (type: QuestionType) => {
    const colors: Record<QuestionType, string> = {
      "MCQ": "bg-blue-100 text-blue-700",
      "SCQ": "bg-green-100 text-green-700",
      "True/False": "bg-purple-100 text-purple-700",
      "Descriptive": "bg-orange-100 text-orange-700",
    };
    return colors[type];
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-gray-500 mt-1">Manage your questions library</p>
        </div>
        <Button onClick={() => navigate("/teacher/questions/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Question
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="MCQ">MCQ</SelectItem>
                <SelectItem value="SCQ">SCQ</SelectItem>
                <SelectItem value="True/False">True/False</SelectItem>
                <SelectItem value="Descriptive">Descriptive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No questions found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate("/teacher/questions/create")}
              >
                Create Your First Question
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredQuestions.map((question) => {
            const module = modules.find((m) => m.id === question.moduleId);
            const topic = module?.topics.find((t) => t.id === question.topicId);
            
            return (
              <Card key={question.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getTypeColor(question.type)}>
                          {question.type}
                        </Badge>
                        <Badge variant="outline">
                          {module?.code}
                        </Badge>
                        {topic && (
                          <Badge variant="outline" className="text-xs">
                            {topic.name}
                          </Badge>
                        )}
                        <span className="text-sm text-gray-500 ml-auto">
                          {question.points} {question.points === 1 ? "point" : "points"}
                        </span>
                      </div>
                      
                      <p className="text-gray-900 mb-3">{question.text}</p>
                      
                      {question.type === "Descriptive" && question.keywords && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          <span className="text-xs text-gray-500">Keywords:</span>
                          {question.keywords.slice(0, 5).map((kw, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {kw.text} ({kw.weight})
                            </Badge>
                          ))}
                          {question.keywords.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{question.keywords.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {(question.type === "MCQ" || question.type === "SCQ") && question.options && (
                        <div className="text-sm text-gray-600">
                          {question.options.length} options
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/teacher/questions/edit/${question.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast.success("Question deleted")}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
