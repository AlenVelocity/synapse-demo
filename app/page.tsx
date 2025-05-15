"use client"

import { useState, useRef, useEffect } from "react"
import { Mic, Square } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Textarea } from "@/components/ui/textarea"
import { WaveformBar } from "./components/WaveformBar"

export default function SpeechToText() {
  const [inputText, setInputText] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true

        recognitionRef.current.onresult = (event: any) => {
          const current = event.resultIndex
          const transcriptText = event.results[current][0].transcript
          setTranscript(transcriptText)

          // Update input text directly with the transcription
          if (event.results[current].isFinal) {
            setInputText((prev) => {
              return prev ? `${prev} ${transcriptText}` : transcriptText
            })
          }
        }

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error)
          stopListening()
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  // Handle spacebar press/release
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isListening && !e.repeat && document.activeElement !== textareaRef.current) {
        e.preventDefault()
        startListening()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && isListening) {
        e.preventDefault()
        stopListening()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [isListening])

  const startListening = () => {
    setTranscript("")
    setIsListening(true)

    if (recognitionRef.current) {
      recognitionRef.current.start()
    }
  }

  const stopListening = () => {
    setIsListening(false)

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    // Clear the transcript after stopping
    setTranscript("")
  }

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
                  {transcript ? transcript : "Listening..."}
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
