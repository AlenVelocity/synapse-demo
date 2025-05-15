"use client"

import { useState, useRef, useEffect, FC, useCallback } from "react"
import { Mic, Square } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Textarea } from "@/components/ui/textarea"
import { WaveformBar } from "./_components/WaveformBar"
import {
  LiveTranscriptionEvent,
  LiveTranscriptionEvents,
  useDeepgram,
} from "@/context/DeepgramContextProvider"
import {
  MicrophoneEvents,
  MicrophoneState,
  useMicrophone,
} from "@/context/MicrophoneContextProvider"
import { SOCKET_STATES } from "@deepgram/sdk"

export default function SpeechToText() {
  const [inputText, setInputText] = useState("")
  const [isListening, setIsListening] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Deepgram specific state and refs
  const [caption, setCaption] = useState<string | undefined>("Powered by Deepgram")
  const { connection, connectToDeepgram, connectionState } = useDeepgram()
  const { setupMicrophone, microphone, startMicrophone, microphoneState, stopMicrophone } = useMicrophone()
  const captionTimeout = useRef<NodeJS.Timeout | null>(null)
  const keepAliveInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setupMicrophone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (microphoneState === MicrophoneState.Ready) {
      connectToDeepgram({
        model: "nova-3",
        interim_results: true,
        smart_format: true,
        filler_words: true,
        utterance_end_ms: 3000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState]); // Dependency: connectToDeepgram missing, will add if linter complains or if it's part of a useCallback

  useEffect(() => {
    if (!microphone || !connection) return;

    const onData = (e: BlobEvent) => {
      if (e.data.size > 0) {
        connection?.send(e.data);
      }
    };

    const onTranscript = (data: LiveTranscriptionEvent) => {
      const { is_final: isFinal, speech_final: speechFinal } = data;
      let thisCaption = data.channel.alternatives[0].transcript;

      if (thisCaption !== "") {
        setCaption(thisCaption);
      }

      if (isFinal && speechFinal) {
        setInputText((prev) => prev ? `${prev} ${thisCaption}`.trim() : thisCaption);
        if (captionTimeout.current) {
          clearTimeout(captionTimeout.current);
        }
        captionTimeout.current = setTimeout(() => {
          setCaption(undefined); // Or some placeholder like "Powered by Deepgram"
          if (captionTimeout.current) {
            clearTimeout(captionTimeout.current);
          }
        }, 3000);
      }
    };

    if (connectionState === SOCKET_STATES.open) {
      connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.addEventListener(MicrophoneEvents.DataAvailable, onData);
      // startMicrophone(); // Moved to startListening function
    } else {
      // Ensure microphone is stopped if connection is not open
      if(microphoneState === MicrophoneState.Open) {
        stopMicrophone();
      }
    }

    return () => {
      if (connection) {
        connection.removeListener(LiveTranscriptionEvents.Transcript, onTranscript);
      }
      if (microphone) {
        microphone.removeEventListener(MicrophoneEvents.DataAvailable, onData);
      }
      if (captionTimeout.current) {
        clearTimeout(captionTimeout.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState, microphone, connection, setInputText, stopMicrophone, microphoneState]);

  useEffect(() => {
    if (!connection) return;

    if (
      microphoneState === MicrophoneState.Open && // check Open instead of Not Open
      connectionState === SOCKET_STATES.open
    ) {
      // connection.keepAlive(); // Initial keepAlive is sent by SDK on open, or can be sent if needed
      if (keepAliveInterval.current) clearInterval(keepAliveInterval.current); // Clear previous before setting new
      keepAliveInterval.current = setInterval(() => {
        connection.keepAlive();
      }, 10000);
    } else {
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
      }
    }

    return () => {
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState, connectionState, connection]);

  // Sync isListening state with Deepgram's microphoneState
  useEffect(() => {
    setIsListening(microphoneState === MicrophoneState.Open);
  }, [microphoneState, setIsListening]);

  const startListening = useCallback(() => {
    if (microphoneState !== MicrophoneState.Open) {
      startMicrophone();
    }
  }, [microphoneState, startMicrophone]);

  const stopListening = useCallback(() => {
    if (microphoneState === MicrophoneState.Open) {
      stopMicrophone();
    }
    if (captionTimeout.current) {
      clearTimeout(captionTimeout.current);
    }
    // Reset caption immediately or after a short delay if preferred
    // setCaption("Powered by Deepgram"); 
  }, [microphoneState, stopMicrophone]);

  // Handle spacebar press/release
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isListening && !e.repeat && document.activeElement !== textareaRef.current) {
        e.preventDefault();
        startListening();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && isListening) {
        e.preventDefault();
        stopListening();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isListening, startListening, stopListening]); // Added startListening and stopListening as dependencies

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-lg space-y-8">
        <h1 className="text-2xl font-semibold text-center text-gray-800">Speech to Text</h1>

        {/* Main text input */}
        <Textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Your text will appear here..."
          className="min-h-[200px] p-4 text-lg"
        />

        {/* Microphone button and expanded state */}
        <div className="relative flex justify-center">
          <AnimatePresence>
            {isListening ? (
              <motion.div
                initial={{ width: "48px", borderRadius: "24px" }}
                animate={{ width: "240px", borderRadius: "24px" }}
                exit={{ width: "48px", borderRadius: "24px" }}
                className="relative flex items-center justify-center h-12 bg-white border shadow-md cursor-pointer"
                onClick={stopListening}
              >
                <div className="flex items-center justify-between w-full px-4">
                  <Square className="w-5 h-5 text-red-500" />
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <WaveformBar key={i} isListening={isListening} delay={i * 0.1} />
                    ))}
                  </div>
                </div>
                <div className="absolute w-full text-xs text-center text-gray-600 -bottom-6">
                  {caption ? caption : (isListening ? "Listening..." : "Powered by Deepgram")}
                </div>
              </motion.div>
            ) : (
              <motion.button
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startListening}
                className="flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-md"
              >
                <Mic className="w-5 h-5 text-gray-600" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center text-sm text-gray-500 mt-8">
          Press and hold <kbd className="px-2 py-1 bg-gray-100 rounded">Space</kbd> to record
        </div>
      </div>
    </div>
  )
}

// Waveform animation component
// function WaveformBar({ isListening, delay }: { isListening: boolean; delay: number }) {
// return (
// <motion.div
// initial={{ height: "10px" }}
// animate={
// isListening
// ? {
// height: ["10px", "20px", "10px", "15px", "10px"],
// transition: {
// duration: 1,
// repeat: Number.POSITIVE_INFINITY,
// delay: delay,
// },
// }
// : { height: "10px" }
// }
// className="w-1 bg-red-500 rounded-full"
// />
// )
// }
