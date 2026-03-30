import { useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { users, modules, teacherAssignments } from "../../mockData";
import { TeacherAssignment, TeachingRole } from "../../types";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";

export default function AdminTeacherAssignment() {
  const [searchQuery, setSearchQuery] = useState("");
  const [assignments, setAssignments] = useState(teacherAssignments);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    teacherId: "",
    moduleId: "",
    teachingRole: "Lecturer" as TeachingRole,
  });

  const teachers = users.filter((u) => u.role === "teacher");

  const filteredAssignments = assignments.filter((assignment) => {
    const teacher = users.find((u) => u.id === assignment.teacherId);
    const module = modules.find((m) => m.id === assignment.moduleId);
    const searchLower = searchQuery.toLowerCase();
    
    return (
      teacher?.name.toLowerCase().includes(searchLower) ||
      module?.code.toLowerCase().includes(searchLower) ||
      module?.name.toLowerCase().includes(searchLower) ||
      assignment.teachingRole.toLowerCase().includes(searchLower)
    );
  });

  const handleCreateAssignment = () => {
    if (!formData.teacherId || !formData.moduleId) {
      toast.error("Please select both teacher and module");
      return;
    }

    const newAssignment: TeacherAssignment = {
      id: `ta${Date.now()}`,
      ...formData,
    };
    
    setAssignments([...assignments, newAssignment]);
    toast.success("Teacher assigned successfully");
    setIsCreateDialogOpen(false);
    resetForm();
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    setAssignments(assignments.filter((a) => a.id !== assignmentId));
    toast.success("Assignment removed");
  };

  const resetForm = () => {
    setFormData({
      teacherId: "",
      moduleId: "",
      teachingRole: "Lecturer",
    });
  };

  // Group assignments by module
  const assignmentsByModule = modules.map((module) => ({
    module,
    assignments: assignments.filter((a) => a.moduleId === module.id),
  }));

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teacher Assignment</h1>
          <p className="text-gray-500 mt-1">Assign teachers to modules with specific roles</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Assign Teacher
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Teacher to Module</DialogTitle>
              <DialogDescription>
                Select a teacher, module, and teaching role
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="teacher">Teacher</Label>
                <Select value={formData.teacherId} onValueChange={(value) => setFormData({ ...formData, teacherId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
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
                <Label htmlFor="role">Teaching Role</Label>
                <Select value={formData.teachingRole} onValueChange={(value) => setFormData({ ...formData, teachingRole: value as TeachingRole })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lecturer">Lecturer</SelectItem>
                    <SelectItem value="Lab Instructor">Lab Instructor</SelectItem>
                    <SelectItem value="Tutorial Instructor">Tutorial Instructor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAssignment}>
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by teacher, module, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-6">
        {assignmentsByModule.map(({ module, assignments: moduleAssignments }) => (
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
                  {moduleAssignments.length} {moduleAssignments.length === 1 ? "teacher" : "teachers"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {moduleAssignments.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No teachers assigned to this module
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teaching Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {moduleAssignments.map((assignment) => {
                      const teacher = users.find((u) => u.id === assignment.teacherId);
                      return (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">{teacher?.name}</TableCell>
                          <TableCell>{teacher?.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{assignment.teachingRole}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAssignment(assignment.id)}
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
