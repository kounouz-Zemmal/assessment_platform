import { useState } from "react";
import { useNavigate } from "react-router";
import { Search, Calendar, Clock } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { StatusBadge } from "../../components/StatusBadge";
import { assessments, submissions, studentEnrollments, modules, getCurrentUser } from "../../mockData";
import { Badge } from "../../components/ui/badge";

export default function StudentAssessments() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");

  const myEnrollments = studentEnrollments.filter((e) => e.studentId === currentUser.id);
  const myModuleIds = myEnrollments.map((e) => e.moduleId);
  const availableAssessments = assessments.filter((a) => myModuleIds.includes(a.moduleId));
  const mySubmissions = submissions.filter((s) => s.studentId === currentUser.id);

  const filteredAssessments = availableAssessments.filter((assessment) =>
    assessment.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const upcomingAssessments = filteredAssessments.filter((a) => 
    a.status === "Scheduled" || a.status === "Active"
  );

  const completedSubmissions = mySubmissions.filter((s) => 
    s.status === "Graded" || s.status === "Submitted"
  );

  const completedAssessments = completedSubmissions.map((sub) => 
    assessments.find((a) => a.id === sub.assessmentId)
  ).filter(Boolean);

  const getSubmissionForAssessment = (assessmentId: string) => {
    return mySubmissions.find((s) => s.assessmentId === assessmentId);
  };

  const renderAssessmentCard = (assessment: any) => {
    const module = modules.find((m) => m.id === assessment.moduleId);
    const submission = getSubmissionForAssessment(assessment.id);
    const canStart = assessment.status === "Active" && !submission;

    return (
      <Card key={assessment.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2">{assessment.title}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{module?.code}</Badge>
                <StatusBadge status={assessment.status} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm mb-4">
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
          </div>

          {submission && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                Status: <StatusBadge status={submission.status} />
              </p>
              {submission.score !== undefined && (
                <p className="text-sm text-gray-700 mt-1">
                  Score: <span className="font-bold">{submission.score}/{submission.maxScore}</span>
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {canStart && (
              <Button
                className="flex-1"
                onClick={() => navigate(`/student/assessments/${assessment.id}/instructions`)}
              >
                Start Assessment
              </Button>
            )}
            {submission && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/student/assessments/${assessment.id}/results`)}
              >
                View Results
              </Button>
            )}
            {!canStart && !submission && assessment.status === "Scheduled" && (
              <Button variant="outline" className="flex-1" disabled>
                Not Started
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Assessments</h1>
        <p className="text-gray-500 mt-1">View and take your assessments</p>
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

      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingAssessments.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedAssessments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-6">
          {upcomingAssessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No upcoming assessments</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {upcomingAssessments.map(renderAssessmentCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-6">
          {completedAssessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No completed assessments</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {completedAssessments.map(renderAssessmentCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
