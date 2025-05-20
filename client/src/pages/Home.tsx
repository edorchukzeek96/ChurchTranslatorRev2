import { useState, useRef, useEffect } from "react";
import Recorder from "@/components/Recorder";
import Transcriber from "@/components/Transcriber";
import UIControls from "@/components/UIControls";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<"Ready" | "Recording..." | "Transcribing..." | "Complete">("Ready");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [latency, setLatency] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const { toast } = useToast();

  // Auto-scroll to the bottom of transcript
  useEffect(() => {
    if (transcriptContainerRef.current && isRecording) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcript, isRecording]);

  const handleStartRecording = async () => {
    try {
      setError(null);
      setStatus("Recording...");
      setIsRecording(true);
      retryCountRef.current = 0;
    } catch (err: any) {
      setError(err.message || "Failed to start recording");
      setIsRecording(false);
      setStatus("Ready");
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to start recording"
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      setStatus("Complete");
      setIsRecording(false);
      setLatency(0);
    } catch (err: any) {
      setError(err.message || "Failed to stop recording");
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to stop recording"
      });
    }
  };

  const handleTranscriptionUpdate = (text: string) => {
    setTranscript(prev => [...prev, text]);
  };

  const handleLatencyUpdate = (ms: number) => {
    setLatency(ms);
  };

  const handleTranscriptionError = (err: Error) => {
    if (retryCountRef.current < 3) {
      retryCountRef.current++;
      toast({
        title: "Transcription failed",
        description: `Retrying (${retryCountRef.current}/3)...`,
      });
    } else {
      setError(err.message);
      setIsRecording(false);
      setStatus("Ready");
      toast({
        variant: "destructive",
        title: "Transcription failed",
        description: "Max retries reached. Please try again."
      });
    }
  };

  const handleStatusChange = (newStatus: "Ready" | "Recording..." | "Transcribing..." | "Complete") => {
    setStatus(newStatus);
  };

  const handleCopyTranscript = () => {
    navigator.clipboard.writeText(transcript.join('\n'));
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
              {/* Status Indicator */}
              <div className="flex items-center">
                <div 
                  className={`w-3 h-3 rounded-full mr-2 ${
                    status === "Ready" ? "bg-muted" : 
                    status === "Recording..." ? "bg-secondary animate-pulse" : 
                    status === "Transcribing..." ? "bg-warning" : 
                    "bg-success"
                  }`}
                />
                <span className="text-sm font-medium text-muted-foreground">{status}</span>
              </div>
              
              {/* Latency Display */}
              <div className="text-sm text-muted-foreground">
                <span>{latency}ms</span> latency
              </div>
            </div>
          </div>
          
          {/* Microphone visualization placeholder */}
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
        
        {/* Error Notification */}
        {error && (
          <div className="mt-6 bg-destructive bg-opacity-10 border-l-4 border-destructive text-destructive p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-destructive" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{error}</p>
                <button onClick={dismissError} className="mt-2 text-xs underline text-destructive hover:text-destructive">Dismiss</button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className="mt-12 text-center text-muted-foreground text-sm">
        <p>Church Translation App • Made with 💜</p>
        <p className="mt-1">Compatible with Chrome and Firefox browsers</p>
      </footer>
    </div>
  );
}
