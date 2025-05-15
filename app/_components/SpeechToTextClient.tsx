'use client'

import { useState, useRef, useEffect, FC, useCallback } from 'react'
import { Mic, Square, Copy, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Textarea } from '@/components/ui/textarea'
import { WaveformBar } from './WaveformBar'
import { LiveTranscriptionEvent, LiveTranscriptionEvents, useDeepgram } from '@/context/DeepgramContextProvider'
import { MicrophoneEvents, MicrophoneState, useMicrophone } from '@/context/MicrophoneContextProvider'
import { SOCKET_STATES } from '@deepgram/sdk'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { reviseTextWithGemini } from '@/lib/geminiService'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'

export default function SpeechToTextClient() {
	const [inputText, setInputText] = useState('')
	const [caption, setCaption] = useState<string | undefined>('Powered by Deepgram')
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const { connection, connectToDeepgram, connectionState } = useDeepgram()
	const { setupMicrophone, microphone, startMicrophone, microphoneState, stopMicrophone } = useMicrophone()

	const captionTimeout = useRef<NodeJS.Timeout | null>(null)
	const keepAliveInterval = useRef<NodeJS.Timeout | null>(null)

	// Intent Mode specific state and refs
	const [isIntentModeEnabled, setIsIntentModeEnabled] = useState(false)
	const intentModePauseTimer = useRef<NodeJS.Timeout | null>(null)
	const PAUSE_DURATION_MS = 1000 // Configurable pause duration for intent processing

	// Counts how many times connectToDeepgram effect runs
	const connectEffectCount = useRef(0)

	const [showCopiedTooltip, setShowCopiedTooltip] = useState(false)
	
	// Track status notifications to prevent duplicates
	const hasShownMicReadyToast = useRef(false)
	const hasShownConnectionReadyToast = useRef(false)

	const handleCopy = useCallback(async () => {
		if (textareaRef.current?.value) {
			try {
				await navigator.clipboard.writeText(textareaRef.current.value)
				console.log('Text copied to clipboard!')
				setShowCopiedTooltip(true)
				setTimeout(() => setShowCopiedTooltip(false), 1500)
			} catch (err) {
				console.error('Failed to copy text: ', err)
				alert('Failed to copy text.')
			}
		}
	}, [textareaRef])

	const handleClear = useCallback(() => {
		setInputText('')
		if (textareaRef.current) {
			textareaRef.current.focus()
		}
		console.log('Text cleared!')
	}, [setInputText, textareaRef])

	useEffect(() => {
		setupMicrophone()
	}, [])

	// Monitor microphone state and show toast when ready
	useEffect(() => {
		if (microphoneState === MicrophoneState.Ready && !hasShownMicReadyToast.current) {
			toast.success('Microphone is ready', {
				duration: 3000,
			})
			hasShownMicReadyToast.current = true
		}
	}, [microphoneState])

	// Monitor Deepgram connection state and show toast when ready
	useEffect(() => {
		if (connectionState === SOCKET_STATES.open && !hasShownConnectionReadyToast.current) {
			// toast.success('Deepgram is connected', {
			// 	description: 'You can now start recording',
			// 	duration: 3000,
			// })
			// hasShownConnectionReadyToast.current = true
		}
	}, [connectionState])

	useEffect(() => {
		connectEffectCount.current += 1
		console.log(
			`[useEffect connectToDeepgram] Running - Count: ${connectEffectCount.current}, Microphone State: ${microphoneState}`
		)

		if (microphoneState === MicrophoneState.Ready) {
			console.log('[useEffect connectToDeepgram] Condition met: Microphone ready. Calling connectToDeepgram.')
			connectToDeepgram({
				model: 'nova-3',
				interim_results: true,
				smart_format: true,
				filler_words: true,
				utterance_end_ms: 3000
			})
		} else {
			console.log('[useEffect connectToDeepgram] Condition NOT met: Microphone not ready. State: ', microphoneState)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [microphoneState, connectToDeepgram]) // Added connectToDeepgram

	const handleIntentProcessing = useCallback(async () => {
		if (!isIntentModeEnabled || !textareaRef.current) return

		const currentTextInBox = textareaRef.current.value
		if (currentTextInBox && currentTextInBox.trim()) {
			console.log('Intent Mode: Pause detected. Text for Gemini revision:', currentTextInBox)
			const revisedText = await reviseTextWithGemini(currentTextInBox)

			// Only update if Gemini made a change AND the text in the box hasn't changed
			// (i.e., user didn't start speaking again while Gemini was processing)
			if (textareaRef.current?.value === currentTextInBox) {
				if (revisedText !== currentTextInBox) {
					setInputText(revisedText)
					console.log('Intent Mode: InputText updated by Gemini:', revisedText)
				}
			} else {
				console.log('Intent Mode: Gemini revision skipped as text input changed during processing.')
			}
		}
	}, [isIntentModeEnabled, textareaRef, setInputText])

	const onTranscript = useCallback(
		(data: LiveTranscriptionEvent) => {
			// console.log("Deepgram onTranscript event received:", JSON.stringify(data, null, 2));

			const { is_final: isFinal, speech_final: speechFinal } = data
			let thisCaption = ''
			// Safely access transcript
			if (
				data.channel &&
				data.channel.alternatives &&
				data.channel.alternatives.length > 0 &&
				data.channel.alternatives[0].transcript
			) {
				thisCaption = data.channel.alternatives[0].transcript
			} else {
				// It's possible to receive events with no transcript (e.g. metadata, or empty final utterance)
				// console.warn("No transcript in Deepgram event or event is not structured as expected:", data);
			}

			console.log(`[onTranscript] Event: isFinal=${isFinal}, speechFinal=${speechFinal}, captionText="${thisCaption}"`)

			// Update caption with interim and final results if there's text
			if (thisCaption) {
				setCaption(thisCaption)
				// console.log(`[onTranscript] Caption updated to: "${thisCaption}"`);
			}

			// Update main input text with FINAL, NON-EMPTY transcripts
			if (isFinal && thisCaption.trim() !== '') {
				// Only append if the final transcript is not just whitespace
				console.log(
					`[onTranscript] Met condition to update inputText: isFinal=${isFinal}, thisCaption="${thisCaption}"`
				)
				setInputText((prev) => {
					const newText = prev ? `${prev} ${thisCaption.trim()}`.trim() : thisCaption.trim()
					console.log(`[onTranscript] setInputText: prev="${prev}", newText="${newText}"`)
					return newText
				})

				if (isIntentModeEnabled) {
					console.log('[onTranscript] Intent Mode ON: Setting/resetting pause timer.')
					if (intentModePauseTimer.current) {
						clearTimeout(intentModePauseTimer.current)
					}
					intentModePauseTimer.current = setTimeout(handleIntentProcessing, PAUSE_DURATION_MS)
				}
			} else if (isFinal) {
				console.log(
					`[onTranscript] Skipped setInputText: isFinal=true, but thisCaption is empty or whitespace. Caption: "${thisCaption}"`
				)
			} else {
				// console.log(`[onTranscript] Skipped setInputText: isFinal=false. Caption: "${thisCaption}"`);
			}

			// Handle end of speech for caption clearing
			if (isFinal && speechFinal) {
				console.log('[onTranscript] Met condition for caption timeout: isFinal=true, speechFinal=true.')
				if (captionTimeout.current) clearTimeout(captionTimeout.current)
				captionTimeout.current = setTimeout(() => {
					console.log('[onTranscript] Caption timeout: Clearing caption.')
					setCaption(undefined)
					if (captionTimeout.current) clearTimeout(captionTimeout.current)
				}, 3000)
			}
		},
		[
			isIntentModeEnabled,
			setInputText,
			setCaption,
			handleIntentProcessing,
			captionTimeout,
			intentModePauseTimer,
			PAUSE_DURATION_MS
		]
	)

	useEffect(() => {
		if (!microphone || !connection) return

		const onData = (e: BlobEvent) => {
			if (e.data.size > 0 && connectionState === SOCKET_STATES.open) {
				connection?.send(e.data)
			}
		}

		if (connectionState === SOCKET_STATES.open) {
			connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript)
			microphone.addEventListener(MicrophoneEvents.DataAvailable, onData)
		} else {
			if (microphoneState === MicrophoneState.Open) {
			}
		}

		return () => {
			if (connection) {
				connection.removeListener(LiveTranscriptionEvents.Transcript, onTranscript)
			}
			if (microphone) {
				microphone.removeEventListener(MicrophoneEvents.DataAvailable, onData)
			}
			if (captionTimeout.current) {
				clearTimeout(captionTimeout.current)
			}
			if (intentModePauseTimer.current) {
				clearTimeout(intentModePauseTimer.current)
			}
		}
	}, [connectionState, microphone, connection, onTranscript, microphoneState, stopMicrophone])

	useEffect(() => {
		if (!connection) return

		if (microphoneState === MicrophoneState.Open && connectionState === SOCKET_STATES.open) {
			if (keepAliveInterval.current) clearInterval(keepAliveInterval.current)
			keepAliveInterval.current = setInterval(() => {
				connection.keepAlive()
			}, 10000)
		} else {
			if (keepAliveInterval.current) {
				clearInterval(keepAliveInterval.current)
			}
		}

		return () => {
			if (keepAliveInterval.current) {
				clearInterval(keepAliveInterval.current)
			}
		}
	}, [microphoneState, connectionState, connection])

	useEffect(() => {
		if (!isIntentModeEnabled && intentModePauseTimer.current) {
			clearTimeout(intentModePauseTimer.current)
			console.log('Intent Mode disabled, cleared pending revision timer.')
		}
	}, [isIntentModeEnabled, intentModePauseTimer])

	const isListening = microphoneState === MicrophoneState.Open

	const startListening = useCallback(() => {
		if (microphoneState !== MicrophoneState.Open && microphoneState !== MicrophoneState.Opening) {
			startMicrophone()
		}
	}, [microphoneState, startMicrophone])

	const stopListening = useCallback(() => {
		if (microphoneState === MicrophoneState.Open) {
			stopMicrophone()
			if (intentModePauseTimer.current) {
				clearTimeout(intentModePauseTimer.current)
			}
		}
	}, [microphoneState, stopMicrophone, intentModePauseTimer])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code === 'Space' && !isListening && !e.repeat && document.activeElement !== textareaRef.current) {
				e.preventDefault()
				startListening()
			}
		}

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.code === 'Space' && isListening) {
				e.preventDefault()
				stopListening()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		window.addEventListener('keyup', handleKeyUp)

		return () => {
			window.removeEventListener('keydown', handleKeyDown)
			window.removeEventListener('keyup', handleKeyUp)
		}
	}, [isListening, startListening, stopListening])

	return (
		<TooltipProvider delayDuration={200}>
			<div className="w-full max-w-lg space-y-8 overflow-y-auto max-h-[80vh] pb-10">
				<div className="flex items-center justify-center space-x-2 my-4">
					<Switch id="intent-mode" checked={isIntentModeEnabled} onCheckedChange={setIsIntentModeEnabled} />
					<Label htmlFor="intent-mode" className="text-sm text-gray-700">
						Enable Intent Mode (Experimental)
					</Label>
				</div>

				<div className="relative w-full">
					<Textarea
						ref={textareaRef}
						value={inputText}
						onChange={(e) => setInputText(e.target.value)}
						placeholder="Your text will appear here..."
						className="min-h-[200px] max-h-[50vh] p-4 text-lg pr-16 overflow-y-auto"
					/>
					<div className="absolute top-2 right-2 flex space-x-2">
						{inputText && (
							<>
								<Tooltip open={showCopiedTooltip}>
									<TooltipTrigger asChild>
										<button
											onClick={handleCopy}
											title="Copy text"
											className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
											aria-label="Copy text to clipboard"
										>
											<Copy size={18} />
										</button>
									</TooltipTrigger>
									<TooltipContent>
										<p>Copied!</p>
									</TooltipContent>
								</Tooltip>
								<button
									onClick={handleClear}
									title="Clear text"
									className="p-2 text-gray-500 hover:text-red-500 transition-colors"
									aria-label="Clear text input"
								>
									<XCircle size={18} />
								</button>
							</>
						)}
					</div>
				</div>

				<div className="relative flex justify-center">
					<AnimatePresence>
						{isListening ? (
							<motion.div
								initial={{ width: '48px', borderRadius: '24px' }}
								animate={{ width: '240px', borderRadius: '24px' }}
								exit={{ width: '48px', borderRadius: '24px' }}
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
									{caption ? caption : isListening ? 'Listening...' : 'Powered by Deepgram'}
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
			</div>
		</TooltipProvider>
	)
}
