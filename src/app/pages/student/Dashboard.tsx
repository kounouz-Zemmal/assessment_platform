import { useNavigate } from "react-router";
import { Clock, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { StatCard } from "../../components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/StatusBadge";
import { assessments, submissions, studentEnrollments, modules, getCurrentUser } from "../../mockData";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // Get student's enrolled modules
  const myEnrollments = studentEnrollments.filter((e) => e.studentId === currentUser.id);
  const myModuleIds = myEnrollments.map((e) => e.moduleId);
  
  // Get assessments for enrolled modules
  const availableAssessments = assessments.filter((a) => myModuleIds.includes(a.moduleId));
  
  // Get my submissions
  const mySubmissions = submissions.filter((s) => s.studentId === currentUser.id);

  const upcomingAssessments = availableAssessments.filter((a) => 
    a.status === "Scheduled" || a.status === "Active"
  );

  const completedAssessments = mySubmissions.filter((s) => s.status === "Graded" || s.status === "Submitted");

  const averageScore = mySubmissions.filter((s) => s.score !== undefined).length > 0
    ? Math.round(
        mySubmissions
          .filter((s) => s.score !== undefined)
          .reduce((sum, s) => sum + ((s.score! / s.maxScore) * 100), 0) /
          mySubmissions.filter((s) => s.score !== undefined).length
      )
    : 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {currentUser.name}!</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Upcoming Assessments"
          value={upcomingAssessments.length}
          icon={Clock}
          description="Scheduled or active"
        />
        <StatCard
          title="Completed"
          value={completedAssessments.length}
          icon={CheckCircle}
          description="Submitted or graded"
        />
        <StatCard
          title="Average Score"
          value={`${averageScore}%`}
          icon={AlertCircle}
          description="Overall performance"
        />
        <StatCard
          title="Enrolled Modules"
          value={myEnrollments.length}
          icon={Calendar}
          description="Active courses"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Assessments */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAssessments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No upcoming assessments
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingAssessments.slice(0, 5).map((assessment) => {
                  const module = modules.find((m) => m.id === assessment.moduleId);
                  const mySubmission = mySubmissions.find((s) => s.assessmentId === assessment.id);
                  const canStart = assessment.status === "Active";

                  return (
                    <div
                      key={assessment.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {assessment.title}
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {module?.code} • {new Date(assessment.startTime).toLocaleDateString()} • {assessment.duration} min
                        </p>
                        <div className="mt-2">
                          <StatusBadge status={assessment.status} />
                        </div>
                      </div>
                      {canStart && !mySubmission && (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/student/assessments/${assessment.id}/instructions`)}
                        >
                          Start
                        </Button>
                      )}
                      {mySubmission && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/student/assessments/${assessment.id}/results`)}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/student/assessments")}
                >
                  View All Assessments
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Results */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Results</CardTitle>
          </CardHeader>
          <CardContent>
            {completedAssessments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No results available yet
              </p>
            ) : (
              <div className="space-y-3">
                {completedAssessments.slice(0, 5).map((submission) => {
                  const assessment = assessments.find((a) => a.id === submission.assessmentId);
                  const module = modules.find((m) => m.id === assessment?.moduleId);

                  return (
                    <div
                      key={submission.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                      onClick={() => navigate(`/student/assessments/${assessment?.id}/results`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {assessment?.title}
                        </p>
                        <p className="text-sm text-gray-600">{module?.code}</p>
                      </div>
                      {submission.score !== undefined ? (
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            {Math.round((submission.score / submission.maxScore) * 100)}%
                          </p>
                          <p className="text-xs text-gray-500">
                            {submission.score}/{submission.maxScore}
                          </p>
                        </div>
                      ) : (
                        <StatusBadge status={submission.status} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
