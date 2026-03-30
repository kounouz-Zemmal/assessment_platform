import { useNavigate } from "react-router";
import { FileQuestion, ClipboardList, GraduationCap, Clock, Plus } from "lucide-react";
import { StatCard } from "../../components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/StatusBadge";
import { questions, assessments, submissions, getCurrentUser } from "../../mockData";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const myQuestions = questions.filter((q) => q.createdBy === currentUser.id);
  const myAssessments = assessments.filter((a) => a.createdBy === currentUser.id);
  const totalSubmissions = submissions.filter((s) => 
    myAssessments.some((a) => a.id === s.assessmentId)
  );
  const pendingGrading = totalSubmissions.filter((s) => s.status === "Submitted");

  const activeAssessments = myAssessments.filter((a) => a.status === "Active" || a.status === "Scheduled");

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's your overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Questions Created"
          value={myQuestions.length}
          icon={FileQuestion}
          description="In question bank"
        />
        <StatCard
          title="Total Assessments"
          value={myAssessments.length}
          icon={ClipboardList}
          description="All time"
        />
        <StatCard
          title="Pending Grading"
          value={pendingGrading.length}
          icon={Clock}
          description="Needs your review"
        />
        <StatCard
          title="Total Submissions"
          value={totalSubmissions.length}
          icon={GraduationCap}
          description="Student attempts"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full justify-start"
              onClick={() => navigate("/teacher/questions/create")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Question
            </Button>
            <Button
              className="w-full justify-start"
              onClick={() => navigate("/teacher/assessments/create")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Assessment
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/teacher/questions")}
            >
              <FileQuestion className="h-4 w-4 mr-2" />
              View Question Bank
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/teacher/analytics")}
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              View Analytics
            </Button>
          </CardContent>
        </Card>

        {/* Active/Scheduled Assessments */}
        <Card>
          <CardHeader>
            <CardTitle>Active & Scheduled Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            {activeAssessments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No active or scheduled assessments
              </p>
            ) : (
              <div className="space-y-3">
                {activeAssessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => navigate(`/teacher/assessments/${assessment.id}/submissions`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {assessment.title}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(assessment.startTime).toLocaleDateString()} • {assessment.duration} min
                      </p>
                    </div>
                    <StatusBadge status={assessment.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Grading */}
      {pendingGrading.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Submissions Pending Grading
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingGrading.slice(0, 5).map((submission) => {
                const assessment = myAssessments.find((a) => a.id === submission.assessmentId);
                return (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 cursor-pointer"
                    onClick={() => navigate(`/teacher/grading/${submission.id}`)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{assessment?.title}</p>
                      <p className="text-sm text-gray-600">
                        Submitted {new Date(submission.submittedAt!).toLocaleString()}
                      </p>
                    </div>
                    <Button size="sm">Grade Now</Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
