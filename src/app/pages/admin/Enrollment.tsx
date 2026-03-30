import { useState } from "react";
import { Plus, Trash2, Search, Upload } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { users, modules, studentEnrollments } from "../../mockData";
import { StudentEnrollment } from "../../types";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";

export default function AdminEnrollment() {
  const [searchQuery, setSearchQuery] = useState("");
  const [enrollments, setEnrollments] = useState(studentEnrollments);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    studentId: "",
    moduleId: "",
    group: "",
  });

  const students = users.filter((u) => u.role === "student");

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const student = users.find((u) => u.id === enrollment.studentId);
    const module = modules.find((m) => m.id === enrollment.moduleId);
    const searchLower = searchQuery.toLowerCase();
    
    return (
      student?.name.toLowerCase().includes(searchLower) ||
      module?.code.toLowerCase().includes(searchLower) ||
      module?.name.toLowerCase().includes(searchLower)
    );
  });

  const handleEnrollStudent = () => {
    if (!formData.studentId || !formData.moduleId) {
      toast.error("Please select both student and module");
      return;
    }

    // Check if already enrolled
    const exists = enrollments.find(
      (e) => e.studentId === formData.studentId && e.moduleId === formData.moduleId
    );
    
    if (exists) {
      toast.error("Student is already enrolled in this module");
      return;
    }

    const newEnrollment: StudentEnrollment = {
      id: `e${Date.now()}`,
      ...formData,
    };
    
    setEnrollments([...enrollments, newEnrollment]);
    toast.success("Student enrolled successfully");
    setIsEnrollDialogOpen(false);
    resetForm();
  };

  const handleRemoveEnrollment = (enrollmentId: string) => {
    setEnrollments(enrollments.filter((e) => e.id !== enrollmentId));
    toast.success("Enrollment removed");
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
                        <SelectItem key={student.id} value={student.id}>
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
                        <SelectItem key={module.id} value={module.id}>
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
                      const student = users.find((u) => u.id === enrollment.studentId);
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
                              onClick={() => handleRemoveEnrollment(enrollment.id)}
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
