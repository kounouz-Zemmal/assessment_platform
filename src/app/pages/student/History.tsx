import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Clock, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { StatusBadge } from "../../components/StatusBadge";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  assessments,
  submissions,
  modules,
  getCurrentUser,
} from "../../mockData";

export default function StudentHistory() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<
    string | null
  >(null);

  const mySubmissions = submissions.filter(
    (s) => s.studentId === currentUser.id,
  );

  // History should display past attempts only.
  const pastAttempts = mySubmissions.filter(
    (submission) =>
      submission.status === "Submitted" || submission.status === "Graded",
  );

  const rows = pastAttempts
    .map((submission) => {
      const assessment = assessments.find(
        (a) => a.id === submission.assessmentId,
      );
      if (!assessment) return null;
      const module = modules.find((m) => m.id === assessment.moduleId);
      return { submission, assessment, module };
    })
    .filter(Boolean) as {
    submission: (typeof submissions)[number];
    assessment: (typeof assessments)[number];
    module: (typeof modules)[number] | undefined;
  }[];

  const filteredRows = useMemo(() => {
    return rows.filter(({ submission, assessment, module }) => {
      const matchesSearch =
        assessment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        module?.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        module?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || submission.status === statusFilter;

      return Boolean(matchesSearch) && matchesStatus;
    });
  }, [rows, searchQuery, statusFilter]);

  const selectedRow = filteredRows.find(
    ({ submission }) => submission.id === selectedSubmissionId,
  );

  const gradedRows = rows.filter(
    ({ submission }) => submission.status === "Graded",
  );
  const averageScore =
    gradedRows.length === 0
      ? 0
      : gradedRows.reduce(
          (sum, row) =>
            sum +
            (((row.submission.score ?? 0) / row.submission.maxScore) * 100 ||
              0),
          0,
        ) / gradedRows.length;

  useEffect(() => {
    if (!selectedSubmissionId && filteredRows.length > 0) {
      setSelectedSubmissionId(filteredRows[0].submission.id);
      return;
    }

    if (
      selectedSubmissionId &&
      !filteredRows.some(
        ({ submission }) => submission.id === selectedSubmissionId,
      )
    ) {
      setSelectedSubmissionId(filteredRows[0]?.submission.id ?? null);
    }
  }, [filteredRows, selectedSubmissionId]);

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div>
          <Badge variant="outline" className="mb-2 bg-white">
            Attempt Tracker
          </Badge>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
            Exam History
          </h1>
          <p className="text-gray-500 mt-1">
            Review your past assessments, scores, and statuses
          </p>
        </div>
      </div>

      <Card className="mb-6 shadow-sm border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by assessment or module"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="Graded">Graded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card className="shadow-sm border-gray-200">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Total Attempts</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">
              {rows.length}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-200">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Graded Attempts</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">
              {gradedRows.length}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-200">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Average Score</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">
              {averageScore.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card className="shadow-sm border-gray-200">
          <CardContent className="py-12 text-center space-y-2">
            <Clock className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-gray-500">You have no exam history yet.</p>
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No past attempts match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2 shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle>All Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        Assessment
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Module
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">
                        Status
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Score
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map(({ submission, assessment, module }) => (
                      <TableRow
                        key={submission.id}
                        className={`cursor-pointer transition-colors duration-200 ease-out hover:bg-gray-50 focus-within:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ${selectedSubmissionId === submission.id ? "bg-blue-50" : ""}`}
                        onClick={() => setSelectedSubmissionId(submission.id)}
                        tabIndex={0}
                        role="button"
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedSubmissionId(submission.id);
                          }
                        }}
                      >
                        <TableCell className="font-medium min-w-[180px]">
                          {assessment.title}
                        </TableCell>
                        <TableCell>
                          {module && (
                            <Badge variant="outline">{module.code}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          {submission.submittedAt
                            ? new Date(submission.submittedAt).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={submission.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {submission.score !== undefined ? (
                            <span className="font-semibold">
                              {submission.score}/{submission.maxScore}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500">
                              Pending
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(
                                `/student/assessments/${assessment.id}/results`,
                              );
                            }}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle>Attempt Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedRow ? (
                <p className="text-sm text-gray-500">
                  Select an attempt to review a summary here.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500">
                      Assessment
                    </p>
                    <p className="text-sm text-gray-900">
                      {selectedRow.assessment.title}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">
                      Module
                    </p>
                    <p className="text-sm text-gray-900">
                      {selectedRow.module?.code} - {selectedRow.module?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">
                      Attempt Date
                    </p>
                    <p className="text-sm text-gray-900">
                      {selectedRow.submission.submittedAt
                        ? new Date(
                            selectedRow.submission.submittedAt,
                          ).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">
                      Status
                    </p>
                    <div className="mt-1">
                      <StatusBadge status={selectedRow.submission.status} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">Score</p>
                    <p className="text-sm text-gray-900">
                      {selectedRow.submission.score !== undefined
                        ? `${selectedRow.submission.score}/${selectedRow.submission.maxScore}`
                        : "Pending"}
                    </p>
                  </div>

                  <Button
                    className="w-full mt-2"
                    onClick={() =>
                      navigate(
                        `/student/assessments/${selectedRow.assessment.id}/results`,
                      )
                    }
                  >
                    Open Full Results
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
