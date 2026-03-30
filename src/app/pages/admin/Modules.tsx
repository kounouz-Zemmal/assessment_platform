import { useState } from "react";
import { Plus, Pencil, Trash2, Search, BookOpen } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../../components/ui/alert-dialog";
import { modules } from "../../mockData";
import { Module, Topic } from "../../types";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";

export default function AdminModules() {
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleList, setModuleList] = useState(modules);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [newTopicName, setNewTopicName] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    topics: [] as Topic[],
  });

  const filteredModules = moduleList.filter(
    (module) =>
      module.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateModule = () => {
    const newModule: Module = {
      id: `m${Date.now()}`,
      ...formData,
    };
    setModuleList([...moduleList, newModule]);
    toast.success("Module created successfully");
    setIsCreateDialogOpen(false);
    resetForm();
  };

  const handleUpdateModule = () => {
    if (!editingModule) return;
    
    setModuleList(
      moduleList.map((module) =>
        module.id === editingModule.id ? { ...module, ...formData } : module
      )
    );
    toast.success("Module updated successfully");
    setEditingModule(null);
    resetForm();
  };

  const handleDeleteModule = (moduleId: string) => {
    setModuleList(moduleList.filter((module) => module.id !== moduleId));
    toast.success("Module deleted successfully");
  };

  const handleAddTopic = () => {
    if (!newTopicName.trim()) return;
    
    const newTopic: Topic = {
      id: `t${Date.now()}`,
      name: newTopicName,
      moduleId: editingModule?.id || "",
    };
    
    setFormData({
      ...formData,
      topics: [...formData.topics, newTopic],
    });
    setNewTopicName("");
  };

  const handleRemoveTopic = (topicId: string) => {
    setFormData({
      ...formData,
      topics: formData.topics.filter((t) => t.id !== topicId),
    });
  };

  const openEditDialog = (module: Module) => {
    setEditingModule(module);
    setFormData({
      code: module.code,
      name: module.name,
      description: module.description,
      topics: [...module.topics],
    });
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      topics: [],
    });
    setNewTopicName("");
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingModule(null);
    resetForm();
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Module Management</h1>
          <p className="text-gray-500 mt-1">Create and manage course modules and topics</p>
        </div>
        <Dialog open={isCreateDialogOpen || !!editingModule} onOpenChange={handleCloseDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Module
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingModule ? "Edit Module" : "Create New Module"}</DialogTitle>
              <DialogDescription>
                {editingModule ? "Update module information and topics" : "Add a new module to the system"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="code">Module Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="CS101"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Module Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Introduction to Programming"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the module"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Topics</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    placeholder="Topic name"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTopic();
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddTopic}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.topics.map((topic) => (
                    <Badge key={topic.id} variant="secondary" className="gap-2">
                      {topic.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(topic.id)}
                        className="hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={editingModule ? handleUpdateModule : handleCreateModule}>
                {editingModule ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{module.code}</h3>
                    <p className="text-sm text-gray-500">{module.name}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">{module.description}</p>
              
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">Topics ({module.topics.length})</p>
                <div className="flex flex-wrap gap-1">
                  {module.topics.slice(0, 3).map((topic) => (
                    <Badge key={topic.id} variant="outline" className="text-xs">
                      {topic.name}
                    </Badge>
                  ))}
                  {module.topics.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{module.topics.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditDialog(module)}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Module</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {module.code}? This will affect all associated assessments.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteModule(module.id)} className="bg-red-600 hover:bg-red-700">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
