import { useState, useRef, useEffect } from "react";
import Recorder from "@/components/Recorder";
import Transcriber from "@/components/Transcriber";
import UIControls from "@/components/UIControls";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<"Ready" | "Recording..." | "Transcribing..." | "Complete">("Ready");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [latency, setLatency] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [microphoneDisconnected, setMicrophoneDisconnected] = useState(false);
  
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const sessionStartTimeRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Reset session time when recording starts
  useEffect(() => {
    if (isRecording && !sessionStartTimeRef.current) {
      sessionStartTimeRef.current = Date.now();
    } else if (!isRecording) {
      sessionStartTimeRef.current = null;
    }
  }, [isRecording]);

  const handleStartRecording = async () => {
    try {
      setError(null);
      setMicrophoneDisconnected(false);
      setStatus("Recording...");
      setIsRecording(true);
      retryCountRef.current = 0;
      
      toast({
        title: "Recording started",
        description: "SermoCast is now recording audio in real-time",
      });
    } catch (err: any) {
      handleRecordingError(err);
    }
  };

  const handleStopRecording = async () => {
    try {
      setStatus("Complete");
      setIsRecording(false);
      setLatency(0);
      
      // Calculate total recording time
      if (sessionStartTimeRef.current) {
        const totalTimeMs = Date.now() - sessionStartTimeRef.current;
        const minutes = Math.floor(totalTimeMs / 60000);
        const seconds = ((totalTimeMs % 60000) / 1000).toFixed(0);
        
        toast({
          title: "Recording complete",
          description: `Total recording time: ${minutes}m ${seconds}s`,
        });
      } else {
        toast({
          title: "Recording stopped",
        });
      }
      
      sessionStartTimeRef.current = null;
    } catch (err: any) {
      handleRecordingError(err, "stop");
    }
  };

  const handleTranscriptionUpdate = (text: string) => {
    if (text.trim()) {
      setTranscript(prev => [...prev, text]);
    }
  };

  const handleLatencyUpdate = (ms: number) => {
    setLatency(ms);
  };

  const handleTranscriptionError = (err: Error) => {
    console.error("Transcription error:", err);
    
    if (err.message.includes("Microphone disconnected")) {
      setMicrophoneDisconnected(true);
      setError("Microphone disconnected. Please reconnect your microphone and try again.");
      setIsRecording(false);
      setStatus("Ready");
      toast({
        variant: "destructive",
        title: "Microphone disconnected",
        description: "Please check your microphone connection and try again.",
      });
    } else if (retryCountRef.current < 3) {
      retryCountRef.current++;
      toast({
        variant: "default",
        title: "Transcription failed",
        description: `Retrying (${retryCountRef.current}/3)...`,
      });
    } else {
      setError(`Transcription failed: ${err.message}`);
      setIsRecording(false);
      setStatus("Ready");
      toast({
        variant: "destructive",
        title: "Transcription failed",
        description: "Max retries reached. Please check your internet connection and try again.",
      });
    }
  };

  const handleStatusChange = (newStatus: "Ready" | "Recording..." | "Transcribing..." | "Complete") => {
    setStatus(newStatus);
  };

  const handleCopyTranscript = () => {
    navigator.clipboard.writeText(transcript.join('\n\n'));
    toast({
      title: "Copied!",
      description: "Transcript copied to clipboard"
    });
  };

  const handleClearTranscript = () => {
    setTranscript([]);
    toast({
      title: "Cleared",
      description: "Transcript has been cleared"
    });
  };

  const dismissError = () => {
    setError(null);
    setMicrophoneDisconnected(false);
  };
  
  const handleRecordingError = (err: any, action: "start" | "stop" = "start") => {
    const errorMsg = err.message || `Failed to ${action} recording`;
    setError(errorMsg);
    setIsRecording(false);
    setStatus("Ready");
    toast({
      variant: "destructive",
      title: "Error",
      description: errorMsg
    });
  };
  
  const retryMicrophoneAccess = async () => {
    if (!recorderRef.current?.retryMicrophoneAccess) return;
    
    setError(null);
    setMicrophoneDisconnected(false);
    
    try {
      const success = await recorderRef.current.retryMicrophoneAccess();
      if (success) {
        toast({
          title: "Microphone reconnected",
          description: "You can now start recording again"
        });
      } else {
        setMicrophoneDisconnected(true);
        setError("Failed to reconnect microphone. Please check permissions and try again.");
        toast({
          variant: "destructive",
          title: "Microphone access denied",
          description: "Please check your browser permissions"
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to reconnect microphone");
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to reconnect microphone"
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary text-center mb-2">SermoCast</h1>
        <p className="text-muted-foreground text-center">Real-time audio transcription for church services</p>
      </header>

      <main>
        <div className="bg-card rounded-xl shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-card-foreground mb-1">Audio Recorder</h2>
              <p className="text-sm text-muted-foreground">Records in 5-second chunks with 500ms overlap</p>
            </div>
            
            <div className="flex items-center mt-3 sm:mt-0 space-x-4">
              {/* Status Indicator with improved visual feedback */}
              <div className="flex items-center bg-accent/50 px-3 py-1 rounded-full">
                <div 
                  className={`w-3 h-3 rounded-full mr-2 ${
                    status === "Ready" ? "bg-muted" : 
                    status === "Recording..." ? "bg-secondary animate-pulse" : 
                    status === "Transcribing..." ? "bg-warning animate-pulse" : 
                    "bg-success"
                  }`}
                />
                <span className="text-sm font-medium text-foreground">{status}</span>
              </div>
              
              {/* Latency Display */}
              <div className={`text-sm px-2 py-1 rounded ${
                latency > 1500 ? "bg-warning/20 text-warning" : 
                latency > 0 ? "bg-success/20 text-success" : 
                "text-muted-foreground"
              }`}>
                <span>{latency}</span> ms latency
              </div>
            </div>
          </div>
          
          {/* Microphone visualization with improved feedback */}
          <Recorder 
            ref={recorderRef}
            isRecording={isRecording}
            onTranscriptionUpdate={handleTranscriptionUpdate}
            onTranscriptionError={handleTranscriptionError}
            onStatusChange={handleStatusChange}
            onLatencyUpdate={handleLatencyUpdate}
          />
          
          <UIControls 
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />
        </div>
        
        <Transcriber 
          transcript={transcript}
          onCopy={handleCopyTranscript}
          onClear={handleClearTranscript}
          transcriptRef={transcriptContainerRef}
        />
        
        {/* Error Notification with Retry Button for Microphone Issues */}
        {error && (
          <div className="mt-6 bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="ml-3 flex-grow">
                <p className="text-sm font-medium">{error}</p>
                <div className="mt-3 flex gap-2">
                  {microphoneDisconnected && (
                    <Button 
                      onClick={retryMicrophoneAccess} 
                      variant="outline" 
                      size="sm"
                      className="bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Reconnect Microphone
                    </Button>
                  )}
                  <Button 
                    onClick={dismissError} 
                    variant="outline" 
                    size="sm"
                    className="bg-accent text-accent-foreground hover:bg-accent/80"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className="mt-12 text-center text-muted-foreground text-sm">
        <p>SermoCast • Real-time church translation</p>
        <p className="mt-1">Compatible with Chrome and Firefox browsers</p>
      </footer>
    </div>
  );
}
