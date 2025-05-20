import React from "react";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";

interface UIControlsProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const UIControls: React.FC<UIControlsProps> = ({ 
  isRecording, 
  onStartRecording, 
  onStopRecording 
}) => {
  return (
    <div className="flex justify-center space-x-4">
      <Button
        onClick={onStartRecording}
        disabled={isRecording}
        className={`px-6 py-6 flex items-center justify-center ${
          isRecording 
            ? "bg-muted text-muted-foreground cursor-not-allowed opacity-75" 
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        <span className="mr-2">Start Recording</span>
        <Play className="h-5 w-5" />
      </Button>
      
      <Button
        onClick={onStopRecording}
        disabled={!isRecording}
        className={`px-6 py-6 flex items-center justify-center ${
          !isRecording 
            ? "bg-muted text-muted-foreground cursor-not-allowed opacity-75" 
            : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
        }`}
      >
        <span className="mr-2">Stop</span>
        <Square className="h-5 w-5" />
      </Button>
    </div>
  );
};

export default UIControls;
