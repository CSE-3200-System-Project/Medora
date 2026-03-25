"use client";

import React from "react";
import { Bold, Italic, List, Mic, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/doctor/voice-input-button";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { transcribeVoice } from "@/lib/voice-actions";
import { voiceToNotes } from "@/lib/ai-consultation-actions";
import { ButtonLoader } from "@/components/ui/medora-loader";

interface ConsultationWorkspaceProps {
  patientId: string;
  notes: string;
  onNotesChange: (value: string) => void;
  onSaveDraft: () => Promise<void> | void;
  onCompleteConsultation: () => Promise<void> | void;
  savingDraft: boolean;
  completingConsultation: boolean;
}

interface AttachmentItem {
  id: string;
  name: string;
  size: number;
}

const SOAP_PLACEHOLDER = `S: Patient reports persistent fatigue for 2 weeks...
O: BP 142/92, HR 78, RR 16...
A: Hypertension moderately controlled...
P: Adjust Lisinopril dose, order CBC...`;

export function ConsultationWorkspace({
  patientId,
  notes,
  onNotesChange,
  onSaveDraft,
  onCompleteConsultation,
  savingDraft,
  completingConsultation,
}: ConsultationWorkspaceProps) {
  const [voiceBusy, setVoiceBusy] = React.useState(false);
  const [voiceMessage, setVoiceMessage] = React.useState<string | null>(null);
  const [attachments, setAttachments] = React.useState<AttachmentItem[]>([]);

  const processAudio = React.useCallback(
    async (audioBlob: Blob) => {
      setVoiceBusy(true);
      setVoiceMessage(null);
      try {
        const formData = new FormData();
        formData.append("audio_file", new File([audioBlob], "consultation-audio.webm", { type: audioBlob.type }));
        const transcription = await transcribeVoice(formData, "auto");

        if (!transcription.success) {
          setVoiceMessage(transcription.error);
          return;
        }

        const notesResult = await voiceToNotes({
          patient_id: patientId,
          transcript: transcription.normalized_text,
        });

        onNotesChange(notesResult.formatted_notes || transcription.normalized_text);
        setVoiceMessage("Voice converted to SOAP notes.");
      } catch (err) {
        setVoiceMessage(err instanceof Error ? err.message : "Voice processing failed");
      } finally {
        setVoiceBusy(false);
      }
    },
    [patientId, onNotesChange]
  );

  const recorder = useVoiceRecorder({
    maxDuration: 60,
    onRecordingComplete: (blob) => {
      void processAudio(blob);
    },
  });

  const onAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    const next = Array.from(files).map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      size: file.size,
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  return (
    <Card className="rounded-2xl border-border/70 bg-card/90 shadow-surface-strong backdrop-blur-sm">
      <CardHeader className="card-padding pb-0">
        <Tabs defaultValue="notes" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-background/60 rounded-xl">
            <TabsTrigger value="notes">Notes (SOAP)</TabsTrigger>
            <TabsTrigger value="voice">Voice</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Clinical Documentation</Label>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Button variant="ghost" size="icon-sm" type="button">
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" type="button">
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" type="button">
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder={SOAP_PLACEHOLDER}
                rows={16}
                className="min-h-[22rem] rounded-xl bg-background/70 border-border/70"
              />
            </div>
          </TabsContent>

          <TabsContent value="voice" className="mt-5">
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Record consultation speech. It will be transcribed via Whisper and converted to SOAP notes.
                </p>
                <div className="flex items-center gap-3">
                  <VoiceInputButton
                    state={voiceBusy ? "processing" : recorder.state}
                    duration={recorder.duration}
                    isSupported={recorder.isSupported}
                    error={recorder.error}
                    onStartRecording={recorder.startRecording}
                    onStopRecording={recorder.stopRecording}
                  />
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mic className="h-4 w-4 text-primary" />
                    <span>Max 60 seconds</span>
                  </div>
                </div>
                {voiceMessage ? <p className="mt-3 text-sm text-muted-foreground">{voiceMessage}</p> : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="attachments" className="mt-5">
            <div className="space-y-4">
              <Label htmlFor="consultation-attachments" className="text-sm text-muted-foreground">
                Upload supporting reports, images, or documents
              </Label>
              <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4">
                <input
                  id="consultation-attachments"
                  type="file"
                  multiple
                  onChange={onAttachmentChange}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-primary"
                />
              </div>
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((file) => (
                    <div key={file.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm">
                      <Paperclip className="h-4 w-4 text-primary" />
                      <span className="truncate">{file.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </CardHeader>

      <CardFooter className="card-padding border-t border-border/60 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onSaveDraft} disabled={savingDraft}>
          {savingDraft ? <ButtonLoader className="mr-2" /> : null}
          Save Draft
        </Button>
        <Button variant="medical" onClick={onCompleteConsultation} disabled={completingConsultation}>
          {completingConsultation ? <ButtonLoader className="mr-2" /> : null}
          Complete Consultation
        </Button>
      </CardFooter>
    </Card>
  );
}
