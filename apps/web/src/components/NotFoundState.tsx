import { Link } from "@tanstack/react-router";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function NotFoundState() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <MapPinOff aria-hidden="true" />
          <CardTitle>Page not found</CardTitle>
        </div>
        <CardDescription>
          This workspace has one authoritative decision route.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/">Return to the workspace</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
