import React, { useEffect, useRef } from "react";
import TextCleaner from "./TextCleaner";
import { Button } from "@/components/ui/button";
import { ClipboardCopy, Download, FileDown, Trash2 } from "lucide-react";

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
  const lastItemRef = useRef<HTMLParagraphElement>(null);
  
  // Enhanced auto-scroll logic - smooth scroll to the latest transcript
  useEffect(() => {
    if (lastItemRef.current && cleanedTranscript.length > 0) {
      lastItemRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [cleanedTranscript.length]);

  // Function to save transcript as text file
  const saveTranscriptAsFile = () => {
    if (cleanedTranscript.length === 0) return;
    
    const text = cleanedTranscript.join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `sermocast-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
            disabled={cleanedTranscript.length === 0}
          >
            <ClipboardCopy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          
          <Button 
            onClick={saveTranscriptAsFile} 
            variant="outline" 
            size="sm"
            className="bg-secondary/10 text-secondary hover:bg-secondary/20"
            disabled={cleanedTranscript.length === 0}
          >
            <FileDown className="h-4 w-4 mr-1" />
            Save
          </Button>
          
          <Button 
            onClick={onClear} 
            variant="outline" 
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/80"
            disabled={cleanedTranscript.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>
      
      {/* Transcript Display Area - Improved */}
      <div 
        ref={transcriptRef}
        className="transcript-container bg-accent border border-border rounded-lg p-4 overflow-y-auto"
        style={{ 
          maxHeight: 'calc(100vh - 16rem)',
          minHeight: '250px'
        }}
      >
        <div className="space-y-4">
          {cleanedTranscript.length > 0 ? (
            cleanedTranscript.map((text, index) => (
              <p 
                key={index} 
                ref={index === cleanedTranscript.length - 1 ? lastItemRef : null}
                className={`text-foreground ${
                  index === cleanedTranscript.length - 1 
                    ? 'py-1 px-2 rounded bg-primary/5 border-l-2 border-primary/50' 
                    : ''
                }`}
              >
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
      
      <div className="mt-4 flex justify-between items-center">
        <TextCleaner.Indicator />
        
        {cleanedTranscript.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {cleanedTranscript.length} segment{cleanedTranscript.length !== 1 ? 's' : ''} transcribed
          </div>
        )}
      </div>
    </div>
  );
};

export default Transcriber;
