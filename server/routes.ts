import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import OpenAI from "openai";
import { File } from "@web-std/file";

// Extend the Request type to include the multer file
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

// Configure OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max size
  },
});

// Helper to create a file from buffer for OpenAI API
const createFileFromBuffer = (buffer: Buffer, name: string, type: string): File => {
  return new File([buffer], name, { type });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Test API route
  app.get("/api/status", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });
  
  // Audio transcription endpoint
  app.post("/api/transcribe", upload.single('audio'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      
      // Create a file from the buffer for the OpenAI API
      const audioFile = createFileFromBuffer(
        req.file.buffer, 
        "audio.webm", 
        req.file.mimetype || "audio/webm"
      );
      
      // Check OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
          error: "OpenAI API key is missing",
          details: "Please provide a valid OpenAI API key"
        });
      }
      
      // Call OpenAI Whisper API with proper file upload format
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        temperature: 0,  // Lower temperature for more accurate results
        language: "en",  // Default to English, can be made configurable later
      });
      
      res.json({ text: transcription.text });
    } catch (err: any) {
      console.error("Transcription error:", err);
      
      // Provide more detailed error information
      let errorMessage = "Failed to transcribe audio";
      let statusCode = 500;
      
      if (err.status === 401) {
        errorMessage = "Invalid OpenAI API key";
        statusCode = 401;
      } else if (err.status === 429) {
        errorMessage = "OpenAI API rate limit exceeded";
        statusCode = 429;
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        errorMessage = "Network error - could not connect to OpenAI API";
        statusCode = 503;
      }
      
      res.status(statusCode).json({ 
        error: errorMessage, 
        details: err.message 
      });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
