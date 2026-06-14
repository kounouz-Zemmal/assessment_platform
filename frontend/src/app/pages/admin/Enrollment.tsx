import { useState, useEffect } from "react";
import { Plus, Trash2, Search, Upload } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { apiGet, apiPost, apiDelete } from "../../apiClient";
import { StudentEnrollment } from "../../types";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";

export default function AdminEnrollment() {
  const [searchQuery, setSearchQuery] = useState("");
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    studentId: "",
    moduleId: "",
    group: "",
  });

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const student = students.find((u) => u.id === enrollment.studentId);
    const module = modules.find((m) => m.id === enrollment.moduleId);
    const searchLower = searchQuery.toLowerCase();
    
    return (
      student?.name?.toLowerCase().includes(searchLower) ||
      module?.code?.toLowerCase().includes(searchLower) ||
      module?.name?.toLowerCase().includes(searchLower) ||
      enrollment.group?.toLowerCase().includes(searchLower)
    );
  });

  const loadEnrollments = async () => {
    setLoading(true);
    try {
      // Load modules
      const modulesResponse = await apiGet<{ modules: any[] }>("admin/modules");
      if (!modulesResponse || !modulesResponse.modules) {
        throw new Error("Could not load modules");
      }
      setModules(modulesResponse.modules);

      // Load all enrollments for all modules
      const allEnrollments: StudentEnrollment[] = [];
      for (const module of modulesResponse.modules) {
        const enrollmentsResponse = await apiGet<{ enrollments: StudentEnrollment[] }>(`admin/modules/${module.id}/enrollments`);
        if (enrollmentsResponse && enrollmentsResponse.enrollments) {
          allEnrollments.push(...enrollmentsResponse.enrollments);
        }
      }
      setEnrollments(allEnrollments);

      // Load students
      const studentsResponse = await apiGet<{ users: any[] }>("admin/users?role=student&page=1&page_size=1000");
      if (!studentsResponse || !studentsResponse.users) {
        throw new Error("Could not load students");
      }
      setStudents(studentsResponse.users.map((user: any) => ({
        ...user,
        name: user.name || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
      })));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to load enrollments";
      console.error("Error loading enrollments:", error);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnrollments();
  }, []);

  const handleEnrollStudent = async () => {
    if (!formData.studentId || !formData.moduleId) {
      toast.error("Please select both student and module");
      return;
    }

    try {
      const response = await apiPost<{ enrollment: StudentEnrollment }>(`admin/modules/${formData.moduleId}/enroll-student`, {
        studentId: formData.studentId,
        group: formData.group || "Default",
      });

      if (!response || !response.enrollment) {
        throw new Error("Invalid response from server");
      }

      setEnrollments([...enrollments, response.enrollment]);
      toast.success("Student enrolled successfully");
      setIsEnrollDialogOpen(false);
      resetForm();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to enroll student";
      console.error("Error enrolling student:", error);
      toast.error(errorMsg);
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: string, moduleId: string) => {
    try {
      await apiDelete(`admin/modules/${moduleId}/enrollments/${enrollmentId}`);
      setEnrollments(enrollments.filter((e) => e.id !== enrollmentId));
      toast.success("Enrollment removed");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to remove enrollment";
      console.error("Error removing enrollment:", error);
      toast.error(errorMsg);
    }
  };

  const handleImportStudents = () => {
    toast.info("CSV import feature would be implemented here");
  };

  const resetForm = () => {
    setFormData({
      studentId: "",
      moduleId: "",
      group: "",
    });
  };

  // Group enrollments by module
  const enrollmentsByModule = modules.map((module) => ({
    module,
    enrollments: enrollments.filter((e) => e.moduleId === module.id),
  }));

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enrollment Management</h1>
          <p className="text-gray-500 mt-1">Manage student enrollments in modules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImportStudents}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Enroll Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enroll Student</DialogTitle>
                <DialogDescription>
                  Assign a student to a module
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="student">Student</Label>
                  <Select value={formData.studentId} onValueChange={(value) => setFormData({ ...formData, studentId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={String(student.id)}>
                          {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="module">Module</Label>
                  <Select value={formData.moduleId} onValueChange={(value) => setFormData({ ...formData, moduleId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select module" />
                    </SelectTrigger>
                    <SelectContent>
                      {modules.map((module) => (
                        <SelectItem key={module.id} value={String(module.id)}>
                          {module.code} - {module.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group">Group (Optional)</Label>
                  <Input
                    id="group"
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    placeholder="e.g., A, B, 1, 2"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEnrollDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEnrollStudent}>
                  Enroll
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by student or module..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-6">
        {enrollmentsByModule.map(({ module, enrollments: moduleEnrollments }) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div>
                  <span className="text-lg">{module.code}</span>
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    {module.name}
                  </span>
                </div>
                <Badge variant="secondary">
                  {moduleEnrollments.length} {moduleEnrollments.length === 1 ? "student" : "students"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {moduleEnrollments.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No students enrolled in this module
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {moduleEnrollments.map((enrollment) => {
                      const student = students.find((u) => u.id === enrollment.studentId);
                      return (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-medium">{student?.name}</TableCell>
                          <TableCell>{student?.email}</TableCell>
                          <TableCell>
                            {enrollment.group ? (
                              <Badge variant="outline">Group {enrollment.group}</Badge>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEnrollment(String(enrollment.id), String(module.id))}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
