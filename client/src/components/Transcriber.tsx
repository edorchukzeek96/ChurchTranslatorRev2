import React from "react";
import TextCleaner from "./TextCleaner";
import { Button } from "@/components/ui/button";
import { ClipboardCopy, Trash2 } from "lucide-react";

interface TranscriberProps {
  transcript: string[];
  onCopy: () => void;
  onClear: () => void;
  transcriptRef: React.RefObject<HTMLDivElement>;
}

const Transcriber: React.FC<TranscriberProps> = ({ 
  transcript, 
  onCopy, 
  onClear,
  transcriptRef 
}) => {
  const cleanedTranscript = TextCleaner.cleanDuplicates(transcript);

  return (
    <div className="bg-card rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-card-foreground">Live Transcript</h2>
        
        <div className="flex space-x-2">
          <Button 
            onClick={onCopy} 
            variant="outline" 
            size="sm" 
            className="bg-primary/10 text-primary hover:bg-primary/20"
          >
            <ClipboardCopy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          
          <Button 
            onClick={onClear} 
            variant="outline" 
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/80"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>
      
      {/* Transcript Display Area */}
      <div 
        ref={transcriptRef}
        className="transcript-container bg-accent border border-border rounded-lg p-4 overflow-y-auto"
        style={{ 
          maxHeight: 'calc(100vh - 16rem)',
          minHeight: '200px'
        }}
      >
        <div className="space-y-4">
          {cleanedTranscript.length > 0 ? (
            cleanedTranscript.map((text, index) => (
              <p key={index} className="text-foreground">
                {text}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground italic">
              Transcript will appear here when you start recording...
            </p>
          )}
        </div>
      </div>
      
      <TextCleaner.Indicator />
    </div>
  );
};

export default Transcriber;
