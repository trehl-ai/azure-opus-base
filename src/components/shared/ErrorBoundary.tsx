import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-5">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Etwas ist schiefgelaufen
          </h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            Ein unerwarteter Fehler ist aufgetreten. Bitte lade die Seite neu.
          </p>
          {this.state.error?.message && (
            <p className="text-xs text-muted-foreground mb-4 font-mono bg-muted rounded-lg px-3 py-2 max-w-lg break-all">
              {this.state.error.message}
            </p>
          )}
          <Button onClick={() => window.location.reload()}>
            Seite neu laden
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
