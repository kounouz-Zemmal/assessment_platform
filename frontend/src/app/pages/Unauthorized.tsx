import React from "react";
import { useNavigate } from "react-router";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-gray-600">
            You do not have permission to view this page with your current account.
          </p>
          <p className="text-xs text-gray-500">
            If you believe this is a mistake, please contact the system administrator or try signing in with a different role.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Go Back
            </Button>
            <Button onClick={() => navigate("/")}>
              Go to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

