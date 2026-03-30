import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Calendar, Clock, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { StatusBadge } from "../../components/StatusBadge";
import { assessments, modules, submissions, getCurrentUser } from "../../mockData";
import { Badge } from "../../components/ui/badge";
import { canPublishAssessment } from "../../permissions";

export default function TeacherAssessments() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [assessmentList, setAssessmentList] = useState(
    assessments.filter((a) => a.createdBy === currentUser.id)
  );

  const filteredAssessments = assessmentList.filter((assessment) =>
    assessment.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSubmissionCount = (assessmentId: string) => {
    return submissions.filter((s) => s.assessmentId === assessmentId).length;
  };

  const handleTogglePublish = (assessmentId: string) => {
    setAssessmentList((prev) =>
      prev.map((a) =>
        a.id === assessmentId
          ? {
              ...a,
              // Simple toggle between Draft and Published for demo purposes
              status: a.status === "Published" ? "Draft" : "Published",
            }
          : a
      )
    );
    // TODO: Integrate with backend endpoint for publishing/unpublishing assessments
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assessments</h1>
          <p className="text-gray-500 mt-1">Manage your assessments and exams</p>
        </div>
        <Button onClick={() => navigate("/teacher/assessments/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Assessment
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search assessments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredAssessments.map((assessment) => {
          const module = modules.find((m) => m.id === assessment.moduleId);
          const submissionCount = getSubmissionCount(assessment.id);
          const canPublish = canPublishAssessment(currentUser, assessment.moduleId);
          
          return (
            <Card
              key={assessment.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/teacher/assessments/${assessment.id}/submissions`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{assessment.title}</CardTitle>
                    <Badge variant="outline">{module?.code}</Badge>
                  </div>
                  <StatusBadge status={assessment.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(assessment.startTime).toLocaleDateString()} •{" "}
                      {new Date(assessment.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{assessment.duration} minutes</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 mt-3 pt-3 border-t">
                    <span className="font-medium">
                      {assessment.questions.length} {assessment.questions.length === 1 ? "question" : "questions"}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="font-medium">
                      {submissionCount} {submissionCount === 1 ? "submission" : "submissions"}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/teacher/assessments/edit/${assessment.id}`);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/teacher/assessments/${assessment.id}/submissions`);
                    }}
                  >
                    View Submissions
                  </Button>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canPublish}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePublish(assessment.id);
                      }}
                    >
                      {assessment.status === "Published" ? "Unpublish Results" : "Publish Results"}
                    </Button>
                    {!canPublish && (
                      <p className="text-xs text-gray-500">
                        Only the module Lecturer can publish or unpublish results.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredAssessments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No assessments found</p>
            <Button onClick={() => navigate("/teacher/assessments/create")}>
              Create Your First Assessment
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
