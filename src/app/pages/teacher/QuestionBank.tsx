import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { QuestionType } from "../../types";
import { toast } from "sonner";
import { apiDelete, apiGet } from "../../apiClient";

export default function TeacherQuestionBank() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [filterTopic, setFilterTopic] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<
    Array<{
      id: string;
      moduleId: string;
      moduleCode: string;
      moduleName: string;
      topicId: string;
      topicName: string;
      type: QuestionType;
      text: string;
      points: number;
      options?: string[];
      keywords?: Array<{ text: string; weight: number }>;
    }>
  >([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [modules, setModules] = useState<Array<{ id: string; code: string; name: string; topics: Array<{ id: string; name: string }> }>>([]);

  useEffect(() => {
    apiGet<{ modules: Array<{ id: string; code: string; name: string; topics: Array<{ id: string; name: string }> }> }>("teacher/modules")
      .then((data) => setModules(data.modules))
      .catch(() => setModules([]));
  }, []);

  useEffect(() => {
    const params: Record<string, string | number> = {
      page,
      page_size: 12,
      sort: sortBy,
    };
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (filterModule !== "all") params.module_id = filterModule;
    if (filterTopic !== "all") params.topic_id = filterTopic;
    if (filterType !== "all") params.type = filterType;

    setLoading(true);
    setError(null);
    apiGet<{ questions: typeof questions; pagination: { page: number; totalPages: number; total: number } }>("teacher/questions", params)
      .then((data) => {
        setQuestions(data.questions);
        setPagination(data.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load questions"))
      .finally(() => setLoading(false));
  }, [searchQuery, filterModule, filterTopic, filterType, sortBy, page]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterModule, filterTopic, filterType, sortBy]);

  useEffect(() => {
    setFilterTopic("all");
  }, [filterModule]);

  const topicsForSelectedModule = useMemo(() => {
    if (filterModule === "all") return [];
    return modules.find((module) => module.id === filterModule)?.topics ?? [];
  }, [modules, filterModule]);

  const handleDelete = async (questionId: string) => {
    try {
      await apiDelete<{ deleted: boolean }>(`teacher/questions/${questionId}`);
      toast.success("Question deleted");
      setQuestions((prev) => prev.filter((question) => question.id !== questionId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete question");
    }
  };

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
            <Select value={filterTopic} onValueChange={setFilterTopic} disabled={filterModule === "all"}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Topics</SelectItem>
                {topicsForSelectedModule.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.name}
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="year_desc">By Year (Newest)</SelectItem>
                <SelectItem value="year_asc">By Year (Oldest)</SelectItem>
                <SelectItem value="alphabetical_asc">Alphabetical (A-Z)</SelectItem>
                <SelectItem value="alphabetical_desc">Alphabetical (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">Loading questions...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        ) : questions.length === 0 ? (
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
          questions.map((question) => {
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
                          {question.moduleCode}
                        </Badge>
                        {question.topicName && (
                          <Badge variant="outline" className="text-xs">
                            {question.topicName}
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
                        onClick={() => handleDelete(question.id)}
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
      {!loading && !error && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
