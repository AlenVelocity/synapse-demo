'use client'

import { useState, useRef, useEffect, FC, useCallback } from 'react'
import { Mic, Square, Copy, XCircle, HelpCircle, Settings, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Textarea } from '@/components/ui/textarea'
import MarkdownEditor, { MarkdownEditorRef } from './MarkdownEditor'
import { WaveformBar } from './WaveformBar'
import { LiveTranscriptionEvent, LiveTranscriptionEvents, useDeepgram } from '@/context/DeepgramContextProvider'
import { MicrophoneEvents, MicrophoneState, useMicrophone } from '@/context/MicrophoneContextProvider'
import { SOCKET_STATES } from '@deepgram/sdk'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { reviseTextWithGemini } from '@/lib/geminiService'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useMediaQuery } from "@/hooks/use-media-query"

interface Mode {
	id: string
	title: string
	emoji: string
	prompt: string
	isCustom: boolean
}

const PRESET_MODES: Mode[] = [
	{ 
		id: 'note-taking', 
		title: 'Note-taking', 
		emoji: '📝', 
		prompt: `Clean up this text for note-taking. Remove filler words, fix grammar, and organize thoughts clearly.

Example Raw Speech:
"Ok so for the project timeline we need to um finish the design phase by next week - no actually make that end of month, and then development starts in... I think February? No wait March is better because of team availability. And we should probably add an extra sprint for QA testing... yeah definitely need that extra time for testing."

Example Output:
Project Timeline:
- Design phase completion: End of month
- Development start: March (aligned with team availability) 
- Added: Extra sprint for QA testing`,
		isCustom: false
	},
	{ 
		id: 'email-draft', 
		title: 'Email Draft', 
		emoji: '📧', 
		prompt: `Convert this speech into a professional email format with proper structure and tone.

Example Raw Speech:
"Hey Priya, just wanted to see if we could move our 1:1 from Thursday to Friday - no wait actually ask about next Monday instead. Mention that I have a conflict that came up - oh actually say it's a client meeting. And maybe add that I'm happy to adjust based on her availability. End it with thanks and let me know what works for you."

Example Output:
Hey Priya,

Just wanted to see if we could move our 1:1 from Thursday to next Monday. A client meeting came up on my end. Totally happy to adjust based on your availability.

Thanks, and let me know what works for you.`,
		isCustom: false
	},
	{ 
		id: 'meeting-notes', 
		title: 'Meeting Notes', 
		emoji: '🤝', 
		prompt: `Format this as meeting notes with clear action items and key points.

Example Raw Speech:
"Ok for the marketing campaign we need to um first finalize the budget which Sarah will handle - no wait I think John's taking that now. Then we need social media posts ready by... was it the 15th? Yeah 15th of next month. Oh and don't forget we need to coordinate with the design team for assets - actually make that the brand team specifically."

Example Output:
Marketing Campaign Notes:
Key Points:
- Budget finalization: Owner - John
- Social media posts deadline: 15th next month
- Brand team to provide design assets

Action Items:
1. John to finalize campaign budget
2. Prepare social posts for 15th deadline
3. Coordinate with brand team for asset creation`,
		isCustom: false
	},
	{ 
		id: 'blogging', 
		title: 'Blogging', 
		emoji: '✍️', 
		prompt: `Format this as a blog post with proper headings and organize ideas for readability.

Example Raw Speech:
"Ok so for this post about productivity tips let's start with time management - no actually let's call it time blocking specifically. Talk about how it helps focus... oh and mention the Pomodoro Technique too. Then we should cover workspace organization, like keeping your desk clean - actually expand that to include digital workspace too. And finally something about taking breaks... yeah regular breaks are super important for maintaining focus."

Example Output:
# Maximizing Productivity: A Comprehensive Guide

## The Power of Time Blocking
Time blocking is a game-changer for focus and productivity. The Pomodoro Technique, a popular time-blocking method, helps maintain concentrated work periods while preventing burnout.

## Organizing Your Work Environment
A clean workspace, both physical and digital, sets the foundation for productive work. Keep your desk organized and maintain a structured digital filing system for optimal efficiency.

## The Importance of Regular Breaks
Taking strategic breaks throughout the day is crucial for maintaining focus and sustaining long-term productivity.`,
		isCustom: false
	}
]

const EMOJI_OPTIONS = [
	'📝', '📧', '🤝', '💼', '📊', '🎯', 
	'💡', '📋', '🔍', '⚡', '🚀', '📱'
]

export default function SpeechToTextClient() {
	const [inputText, setInputText] = useState('')
	const [caption, setCaption] = useState<string | undefined>('Powered by Deepgram')
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const markdownEditorRef = useRef<MarkdownEditorRef>(null)

	const { connection, connectToDeepgram, connectionState } = useDeepgram()
	const { setupMicrophone, microphone, startMicrophone, microphoneState, stopMicrophone, cleanupMicrophone } = useMicrophone()

	const captionTimeout = useRef<NodeJS.Timeout | null>(null)
	const keepAliveInterval = useRef<NodeJS.Timeout | null>(null)

	// Intent Mode specific state and refs
	const [isIntentModeEnabled, setIsIntentModeEnabled] = useState(false)
	const [selectedMode, setSelectedMode] = useState<string>('none')
	const [customModes, setCustomModes] = useState<Mode[]>([])
	const [isHydrated, setIsHydrated] = useState(false)
	const [aiOutputMarkdown, setAiOutputMarkdown] = useState(false)
	
	const intentModePauseTimer = useRef<NodeJS.Timeout | null>(null)
	const isGeminiProcessing = useRef<boolean>(false)
	const PAUSE_DURATION_MS = 1000 // Configurable pause duration for intent processing

	// Counts how many times connectToDeepgram effect runs
	const connectEffectCount = useRef(0)

	const [showCopiedTooltip, setShowCopiedTooltip] = useState(false)
	
	// Track status notifications to prevent duplicates
	const hasShownMicReadyToast = useRef(false)
	const hasShownConnectionReadyToast = useRef(false)

	// State for drawer
	const [isDrawerOpen, setIsDrawerOpen] = useState(false)
	const [isSettingsOpen, setIsSettingsOpen] = useState(false)
	const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'settings'>('general')
	const isDesktop = useMediaQuery("(min-width: 768px)")

	// Hydration effect to load localStorage values
	useEffect(() => {
		setIsIntentModeEnabled(localStorage.getItem('intentModeEnabled') === 'true')
		setSelectedMode(localStorage.getItem('selectedMode') || 'none')
		setAiOutputMarkdown(localStorage.getItem('aiOutputMarkdown') === 'true')
		
		const savedCustomModes = localStorage.getItem('customModes')
		if (savedCustomModes) {
			try {
				setCustomModes(JSON.parse(savedCustomModes))
			} catch (error) {
				console.error('Failed to parse custom modes from localStorage:', error)
				setCustomModes([])
			}
		}
		
		setIsHydrated(true)
	}, [])

	// Get all modes (preset + custom)
	const allModes = [...PRESET_MODES, ...customModes]

	// Get the current mode's prompt
	const getCurrentModePrompt = useCallback(() => {
		if (!selectedMode || selectedMode === 'none') return ''
		const mode = allModes.find(m => m.id === selectedMode)
		return mode?.prompt || ''
	}, [selectedMode, allModes])

	// Save selected mode to localStorage
	const handleModeChange = useCallback((modeId: string) => {
		setSelectedMode(modeId)
		if (isHydrated) {
			localStorage.setItem('selectedMode', modeId)
		}
	}, [isHydrated])

	// Save custom modes to localStorage
	const saveCustomModes = useCallback((modes: Mode[]) => {
		setCustomModes(modes)
		if (isHydrated) {
			localStorage.setItem('customModes', JSON.stringify(modes))
		}
	}, [isHydrated])

	const handleCopy = useCallback(async () => {
		const textToCopy = markdownEditorRef.current?.getMarkdown() || inputText
		if (textToCopy) {
			try {
				await navigator.clipboard.writeText(textToCopy)
				console.log('Text copied to clipboard!')
				setShowCopiedTooltip(true)
				setTimeout(() => setShowCopiedTooltip(false), 1500)
			} catch (err) {
				console.error('Failed to copy text: ', err)
				alert('Failed to copy text.')
			}
		}
	}, [inputText])

	const handleClear = useCallback(() => {
		setInputText('')
		if (markdownEditorRef.current) {
			markdownEditorRef.current.focus()
		}
		console.log('Text cleared!')
	}, [setInputText])

	// Remove automatic microphone setup on component mount
	// Microphone will be set up when user first tries to start recording

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
		console.log('🎯 handleIntentProcessing called!', { 
			isIntentModeEnabled, 
			hasEditor: !!markdownEditorRef.current,
			textValue: inputText,
			isProcessing: isGeminiProcessing.current
		})
		
		if (!isIntentModeEnabled || !markdownEditorRef.current) {
			console.log('🎯 Early return - Intent mode disabled or no editor')
			return
		}

		// Prevent concurrent Gemini calls
		if (isGeminiProcessing.current) {
			console.log('🎯 Gemini is already processing, skipping this call')
			return
		}

		const currentTextInBox = inputText
		if (currentTextInBox && currentTextInBox.trim()) {
			console.log('🎯 Intent Mode: Pause detected. Text for Gemini revision:', currentTextInBox)
			
			// Get prompt from selected mode
			const modePrompt = getCurrentModePrompt()
			console.log('🎯 Using mode prompt:', modePrompt)
			
			try {
				isGeminiProcessing.current = true
				const revisedText = await reviseTextWithGemini(currentTextInBox, modePrompt, aiOutputMarkdown)
				console.log('🎯 Gemini response received:', revisedText)

				// Check if new text was added while Gemini was processing
				setInputText((currentInputText) => {
					// If the text hasn't changed since we started processing, replace it with Gemini's revision
					if (currentInputText === currentTextInBox) {
						if (revisedText !== currentTextInBox) {
							console.log('🎯 Intent Mode: InputText updated by Gemini:', revisedText)
							return revisedText
						} else {
							console.log('🎯 Gemini returned same text, no update needed')
							return currentInputText
						}
					} 
					// If new text was added during processing, preserve the new content
					else if (currentInputText.startsWith(currentTextInBox)) {
						// New text was appended - replace the original part with Gemini's revision and keep the new part
						const newTextPortion = currentInputText.slice(currentTextInBox.length)
						const combinedText = revisedText + newTextPortion
						console.log('🎯 Intent Mode: Preserving new transcript while applying Gemini revision:', combinedText)
						return combinedText
					} 
					// If the text changed in an unexpected way, don't apply Gemini's revision
					else {
						console.log('🎯 Intent Mode: Gemini revision skipped as text input changed unexpectedly during processing.')
						return currentInputText
					}
				})
			} catch (error) {
				console.error('🎯 Error calling Gemini:', error)
			} finally {
				isGeminiProcessing.current = false
			}
		} else {
			console.log('🎯 No text to process')
		}
	}, [isIntentModeEnabled, inputText, getCurrentModePrompt, aiOutputMarkdown])

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
				console.log('isIntentModeEnabled', isIntentModeEnabled)
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
						console.log('🎯 Cleared existing timer')
					}
					intentModePauseTimer.current = setTimeout(handleIntentProcessing, PAUSE_DURATION_MS)
					console.log('🎯 Timer set for', PAUSE_DURATION_MS, 'ms')
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
			// Note: intentModePauseTimer is managed separately and should not be cleared here
			// as this useEffect runs frequently and would prevent the timer from executing
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
		// Save to localStorage
		if (isHydrated) {
			localStorage.setItem('intentModeEnabled', isIntentModeEnabled.toString())
		}
	}, [isIntentModeEnabled, intentModePauseTimer, isHydrated])

	const isListening = microphoneState === MicrophoneState.Open
	const isMicrophoneBusy = microphoneState === MicrophoneState.SettingUp || 
		microphoneState === MicrophoneState.Opening || 
		microphoneState === MicrophoneState.Open ||
		microphoneState === MicrophoneState.Pausing

	const startListening = useCallback(async () => {
		// Set up microphone if it hasn't been set up yet
		if (microphoneState === MicrophoneState.NotSetup) {
			try {
				await setupMicrophone()
				// Note: We'll connect to Deepgram when microphone state becomes Ready
			} catch (error) {
				console.error('Failed to setup microphone:', error)
				return
			}
		}
		
		// Start microphone if it's ready and not already open
		if (microphoneState === MicrophoneState.Ready || microphoneState === MicrophoneState.Paused) {
			startMicrophone()
		}
	}, [microphoneState, startMicrophone, setupMicrophone])

	const stopListening = useCallback(() => {
		if (microphoneState === MicrophoneState.Open) {
			stopMicrophone()
			if (intentModePauseTimer.current) {
				clearTimeout(intentModePauseTimer.current)
			}
			// Reset Gemini processing flag when stopping
			isGeminiProcessing.current = false
		}
	}, [microphoneState, stopMicrophone, intentModePauseTimer])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Check if the active element is within the markdown editor
			const isInEditor = document.activeElement?.closest('.ProseMirror')
			if (e.code === 'Space' && !isListening && !e.repeat && !isInEditor) {
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
				<div className="space-y-4">
					<div className="flex items-center justify-center space-x-2">
						<Switch 
							id="intent-mode" 
							checked={isIntentModeEnabled} 
							onCheckedChange={setIsIntentModeEnabled}
							disabled={isMicrophoneBusy}
						/>
						<Label htmlFor="intent-mode" className={`text-sm ${isMicrophoneBusy ? 'text-gray-400' : 'text-gray-700'}`}>
							Intent Mode
						</Label>
						
						{/* Popover for desktop (hidden on mobile) */}
						<div className="hidden md:block">
							<Popover>
								<PopoverTrigger asChild>
									<button 
										className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-gray-300"
										aria-label="Learn more about Intent Mode"
									>
										<HelpCircle size={16} />
									</button>
								</PopoverTrigger>
								<PopoverContent className="w-80 p-4" side="top">
									<IntentModeHelp />
								</PopoverContent>
							</Popover>
						</div>
						
						{/* Drawer for mobile (hidden on desktop) */}
						<div className="block md:hidden">
							<Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
								<DrawerTrigger asChild>
									<button 
										className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-gray-300"
										aria-label="Learn more about Intent Mode"
									>
										<HelpCircle size={16} />
									</button>
								</DrawerTrigger>
								<DrawerContent>
									<DrawerHeader>
										<DrawerTitle>Intent Mode</DrawerTitle>
									</DrawerHeader>
									<div className="px-4 pb-4">
										<IntentModeHelp />
									</div>
									<DrawerFooter>
										<DrawerClose asChild>
											<button className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500">
												Close
											</button>
										</DrawerClose>
									</DrawerFooter>
								</DrawerContent>
							</Drawer>
						</div>
					</div>

					{/* Mode Selector - only show when Intent Mode is enabled */}
					{isIntentModeEnabled && (
						<div className="flex justify-center">
							<div className="w-48">
								<Select 
									value={selectedMode} 
									onValueChange={handleModeChange}
									disabled={isMicrophoneBusy}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select a mode (optional)">
											{selectedMode && selectedMode !== 'none' && allModes.find(m => m.id === selectedMode) ? (
												<span className="flex items-center space-x-2">
													<span>{allModes.find(m => m.id === selectedMode)?.emoji}</span>
													<span>{allModes.find(m => m.id === selectedMode)?.title}</span>
												</span>
											) : (
												<span className="text-gray-500">Default</span>
											)}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">
											<span className="text-gray-500">Default</span>
										</SelectItem>
										{allModes.map((mode) => (
											<SelectItem key={mode.id} value={mode.id}>
												<span className="flex items-center space-x-2">
													<span>{mode.emoji}</span>
													<span>{mode.title}</span>
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					)}
				</div>

				<div className="relative w-full border rounded-md">
					<MarkdownEditor
						ref={markdownEditorRef}
						value={inputText}
						onChange={setInputText}
						placeholder="Your text will appear here..."
						className="min-h-[200px] max-h-[50vh] p-4 text-lg pr-16 overflow-y-auto border-0 focus:ring-0"
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

			{/* Settings Button */}
			<button
				onClick={() => setIsSettingsOpen(true)}
				disabled={isMicrophoneBusy}
				className={`fixed bottom-4 right-4 p-2 rounded-full shadow-lg transition-colors ${
					isMicrophoneBusy 
						? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
						: 'bg-gray-800 text-white hover:bg-gray-700'
				}`}
				title="Settings"
			>
				<Settings size={24} />
			</button>

			{/* Responsive Settings Dialog/Drawer */}
			{isDesktop ? (
				<Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
					<DialogTrigger asChild>
						<div />
					</DialogTrigger>
					<DialogContent className="max-w-lg w-full max-h-[80vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>Settings</DialogTitle>
						</DialogHeader>
						<SettingsContent 
							activeTab={activeSettingsTab}
							setActiveTab={setActiveSettingsTab}
							isIntentModeEnabled={isIntentModeEnabled}
							setIsIntentModeEnabled={setIsIntentModeEnabled}
							isMicrophoneBusy={isMicrophoneBusy}
							customModes={customModes}
							saveCustomModes={saveCustomModes}
							aiOutputMarkdown={aiOutputMarkdown}
							setAiOutputMarkdown={setAiOutputMarkdown}
							isHydrated={isHydrated}
						/>
					</DialogContent>
				</Dialog>
			) : (
				<Drawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
					<DrawerTrigger asChild>
						<div />
					</DrawerTrigger>
					<DrawerContent className="max-h-[85vh]">
						<DrawerHeader>
							<DrawerTitle>Settings</DrawerTitle>
						</DrawerHeader>
						<div className="px-4 pb-4 overflow-y-auto flex-1">
							<SettingsContent 
								activeTab={activeSettingsTab}
								setActiveTab={setActiveSettingsTab}
								isIntentModeEnabled={isIntentModeEnabled}
								setIsIntentModeEnabled={setIsIntentModeEnabled}
								isMicrophoneBusy={isMicrophoneBusy}
								customModes={customModes}
								saveCustomModes={saveCustomModes}
								aiOutputMarkdown={aiOutputMarkdown}
								setAiOutputMarkdown={setAiOutputMarkdown}
								isHydrated={isHydrated}
							/>
						</div>
						<DrawerFooter>
							<DrawerClose asChild>
								<button className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500">
									Close
								</button>
							</DrawerClose>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>
			)}
		</TooltipProvider>
	)
}

// Extracted Intent Mode Help content as a separate component for reuse
function IntentModeHelp() {
	return (
		<div className="space-y-4">
			<p className="text-xs text-gray-500">
				Intent Mode uses AI to clean up your speech and revise it based on your intended meaning.
				It automatically processes your text during pauses in speech.
			</p>
			<div className="space-y-2">
				<h5 className="font-medium text-xs">Examples:</h5>
				<div className="bg-gray-50 p-2 rounded text-xs">
					<p className="text-gray-400">You say:</p>
					<p className="mb-1">Hey Alex, let's meet at 4 pm tomorrow... make that 5 pm day after tomorrow instead.</p>
					<p className="text-gray-400">Intent Mode revises to:</p>
					<p className="text-emerald-600">Hey Alex, let's meet at 5 pm the day after tomorrow.</p>
				</div>
				<div className="bg-gray-50 p-2 rounded text-xs">
					<p className="text-gray-400">You say:</p>
					<p className="mb-1">Remind me to book the dentist. Actually cancel that. Call the vet instead.</p>
					<p className="text-gray-400">Intent Mode revises to:</p>
					<p className="text-emerald-600">Call the vet instead.</p>
				</div>
				<div className="bg-gray-50 p-2 rounded text-xs">
					<p className="text-gray-400">You say:</p>
					<p className="mb-1">Buy eggs, milk, and... wait, remove eggs, just milk and bread.</p>
					<p className="text-gray-400">Intent Mode revises to:</p>
					<p className="text-emerald-600">Buy milk and bread.</p>
				</div>
			</div>
		</div>
	)
}

// Settings Content Component
interface SettingsContentProps {
	activeTab: 'general' | 'settings'
	setActiveTab: (tab: 'general' | 'settings') => void
	isIntentModeEnabled: boolean
	setIsIntentModeEnabled: (enabled: boolean) => void
	isMicrophoneBusy: boolean
	customModes: Mode[]
	saveCustomModes: (modes: Mode[]) => void
	aiOutputMarkdown: boolean
	setAiOutputMarkdown: (enabled: boolean) => void
	isHydrated: boolean
}

function SettingsContent({ 
	activeTab, 
	setActiveTab, 
	isIntentModeEnabled, 
	setIsIntentModeEnabled, 
	isMicrophoneBusy,
	customModes,
	saveCustomModes,
	aiOutputMarkdown,
	setAiOutputMarkdown,
	isHydrated
}: SettingsContentProps) {
	return (
		<div className="w-full">
			{/* Tab Navigation */}
			<div className="flex border-b">
				<button
					onClick={() => setActiveTab('general')}
					className={`flex-1 px-4 py-2 text-sm font-medium ${
						activeTab === 'general'
							? 'border-b-2 border-blue-500 text-blue-600'
							: 'text-gray-500 hover:text-gray-700'
					}`}
				>
					General
				</button>
				<button
					onClick={() => setActiveTab('settings')}
					className={`flex-1 px-4 py-2 text-sm font-medium ${
						activeTab === 'settings'
							? 'border-b-2 border-blue-500 text-blue-600'
							: 'text-gray-500 hover:text-gray-700'
					}`}
				>
					Settings
				</button>
			</div>

			{/* Tab Content */}
			<div className="p-4">
				{activeTab === 'general' ? (
					<GeneralTab 
						isIntentModeEnabled={isIntentModeEnabled}
						setIsIntentModeEnabled={setIsIntentModeEnabled}
						isMicrophoneBusy={isMicrophoneBusy}
						customModes={customModes}
						saveCustomModes={saveCustomModes}
					/>
				) : (
					<SettingsTab 
						isMicrophoneBusy={isMicrophoneBusy}
						aiOutputMarkdown={aiOutputMarkdown}
						setAiOutputMarkdown={setAiOutputMarkdown}
						isHydrated={isHydrated}
					/>
				)}
			</div>
		</div>
	)
}

// General Tab Component
interface GeneralTabProps {
	isIntentModeEnabled: boolean
	setIsIntentModeEnabled: (enabled: boolean) => void
	isMicrophoneBusy: boolean
	customModes: Mode[]
	saveCustomModes: (modes: Mode[]) => void
}

function GeneralTab({ isIntentModeEnabled, setIsIntentModeEnabled, isMicrophoneBusy, customModes, saveCustomModes }: GeneralTabProps) {
	const [expandedMode, setExpandedMode] = useState<string | null>(null)
	const [isCreatingMode, setIsCreatingMode] = useState(false)
	const [newMode, setNewMode] = useState({ title: '', emoji: '', prompt: '' })

	const allModes = [...PRESET_MODES, ...customModes]

	const handleCreateMode = () => {
		if (newMode.title && newMode.emoji && newMode.prompt) {
			const mode: Mode = {
				id: `custom-${Date.now()}`,
				title: newMode.title,
				emoji: newMode.emoji,
				prompt: newMode.prompt,
				isCustom: true
			}
			saveCustomModes([...customModes, mode])
			setNewMode({ title: '', emoji: '', prompt: '' })
			setIsCreatingMode(false)
		}
	}

	const handleDeleteMode = (modeId: string) => {
		const updatedModes = customModes.filter(mode => mode.id !== modeId)
		saveCustomModes(updatedModes)
	}

	return (
		<div className="space-y-6">
			{/* Intent Mode Toggle */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-medium">Intent Mode</h3>
					<p className="text-xs text-gray-500">AI-powered text cleanup and revision</p>
				</div>
				<Switch 
					checked={isIntentModeEnabled} 
					onCheckedChange={setIsIntentModeEnabled}
					disabled={isMicrophoneBusy}
				/>
			</div>

			{/* Modes List */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label className="text-sm font-medium">Modes</Label>
					<Button
						size="sm"
						variant="outline"
						onClick={() => setIsCreatingMode(true)}
						disabled={isMicrophoneBusy || isCreatingMode}
						className="h-8"
					>
						<Plus size={14} className="mr-1" />
						Add Mode
					</Button>
				</div>

				{/* Create New Mode Form */}
				{isCreatingMode && (
					<div className="border rounded-lg p-3 space-y-3 bg-gray-50">
						<div className="grid grid-cols-2 gap-2">
							<Input
								placeholder="Title"
								value={newMode.title}
								onChange={(e) => setNewMode(prev => ({ ...prev, title: e.target.value }))}
								className="text-sm"
							/>
							<Select
								value={newMode.emoji}
								onValueChange={(value) => setNewMode(prev => ({ ...prev, emoji: value }))}
							>
								<SelectTrigger className="text-sm">
									<SelectValue placeholder="Select emoji">
										{newMode.emoji && (
											<span className="text-lg">{newMode.emoji}</span>
										)}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{EMOJI_OPTIONS.map((emoji) => (
										<SelectItem key={emoji} value={emoji}>
											<span className="text-lg">{emoji}</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<Textarea
							placeholder="Prompt instructions..."
							value={newMode.prompt}
							onChange={(e) => setNewMode(prev => ({ ...prev, prompt: e.target.value }))}
							className="min-h-[60px] text-xs"
						/>
						<div className="flex space-x-2">
							<Button size="sm" onClick={handleCreateMode} disabled={!newMode.title || !newMode.emoji || !newMode.prompt}>
								Create
							</Button>
							<Button size="sm" variant="outline" onClick={() => {
								setIsCreatingMode(false)
								setNewMode({ title: '', emoji: '', prompt: '' })
							}}>
								Cancel
							</Button>
						</div>
					</div>
				)}

				{/* Modes List */}
				<div className="space-y-2 max-h-64 overflow-y-auto">
					{allModes.map((mode) => (
						<div key={mode.id} className="border rounded-lg">
							<div 
								className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
								onClick={() => setExpandedMode(expandedMode === mode.id ? null : mode.id)}
							>
								<div className="flex items-center space-x-2">
									<span className="text-lg">{mode.emoji}</span>
									<span className="text-sm font-medium">{mode.title}</span>
									{!mode.isCustom && (
										<span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Preset</span>
									)}
								</div>
								<div className="flex items-center space-x-2">
									{mode.isCustom && (
										<Button
											size="sm"
											variant="ghost"
											onClick={(e) => {
												e.stopPropagation()
												handleDeleteMode(mode.id)
											}}
											disabled={isMicrophoneBusy}
											className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
										>
											<Trash2 size={12} />
										</Button>
									)}
									<ChevronDown 
										size={16} 
										className={`transition-transform ${expandedMode === mode.id ? 'rotate-180' : ''}`}
									/>
								</div>
							</div>
							{expandedMode === mode.id && (
								<div className="px-3 pb-3 border-t bg-gray-50">
									<p className="text-xs text-gray-600 mt-2">{mode.prompt}</p>
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

// Settings Tab Component
interface SettingsTabProps {
	isMicrophoneBusy: boolean
	aiOutputMarkdown: boolean
	setAiOutputMarkdown: (enabled: boolean) => void
	isHydrated: boolean
}

function SettingsTab({ isMicrophoneBusy, aiOutputMarkdown, setAiOutputMarkdown, isHydrated }: SettingsTabProps) {
	const [microphoneGain, setMicrophoneGain] = useState(() => {
		if (typeof window !== 'undefined') {
			return parseFloat(localStorage.getItem('microphoneGain') || '1')
		}
		return 1
	})
	
	const [noiseReduction, setNoiseReduction] = useState(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem('noiseReduction') === 'true'
		}
		return true
	})
	
	const [echoCancellation, setEchoCancellation] = useState(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem('echoCancellation') === 'true'
		}
		return true
	})

	const saveMicrophoneGain = (gain: number) => {
		setMicrophoneGain(gain)
		if (typeof window !== 'undefined') {
			localStorage.setItem('microphoneGain', gain.toString())
		}
	}

	const saveNoiseReduction = (enabled: boolean) => {
		setNoiseReduction(enabled)
		if (typeof window !== 'undefined') {
			localStorage.setItem('noiseReduction', enabled.toString())
		}
	}

	const saveEchoCancellation = (enabled: boolean) => {
		setEchoCancellation(enabled)
		if (typeof window !== 'undefined') {
			localStorage.setItem('echoCancellation', enabled.toString())
		}
	}

	const saveAiOutputMarkdown = (enabled: boolean) => {
		setAiOutputMarkdown(enabled)
		if (isHydrated) {
			localStorage.setItem('aiOutputMarkdown', enabled.toString())
		}
	}

	return (
		<div className="space-y-6">
			{/* AI Output Format */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-medium">AI Output Markdown</h3>
					<p className="text-xs text-gray-500">Enable AI to output text with markdown formatting</p>
				</div>
				<Switch 
					checked={aiOutputMarkdown} 
					onCheckedChange={saveAiOutputMarkdown}
					disabled={isMicrophoneBusy}
				/>
			</div>

			{/* Microphone Gain */}
			<div className="space-y-2">
				<Label className="text-sm font-medium">Microphone Gain</Label>
				<div className="space-y-2">
					<input
						type="range"
						min="0.1"
						max="2"
						step="0.1"
						value={microphoneGain}
						onChange={(e) => saveMicrophoneGain(parseFloat(e.target.value))}
						disabled={isMicrophoneBusy}
						className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
					/>
					<div className="flex justify-between text-xs text-gray-500">
						<span>0.1x</span>
						<span className="font-medium">{microphoneGain.toFixed(1)}x</span>
						<span>2.0x</span>
					</div>
				</div>
				<p className="text-xs text-gray-500">
					Adjust microphone sensitivity. Higher values make the microphone more sensitive.
				</p>
			</div>

			{/* Noise Reduction */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-medium">Noise Reduction</h3>
					<p className="text-xs text-gray-500">Reduce background noise during recording</p>
				</div>
				<Switch 
					checked={noiseReduction} 
					onCheckedChange={saveNoiseReduction}
					disabled={isMicrophoneBusy}
				/>
			</div>

			{/* Echo Cancellation */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-medium">Echo Cancellation</h3>
					<p className="text-xs text-gray-500">Cancel audio feedback and echoes</p>
				</div>
				<Switch 
					checked={echoCancellation} 
					onCheckedChange={saveEchoCancellation}
					disabled={isMicrophoneBusy}
				/>
			</div>

			{/* Microphone Test */}
			<div className="space-y-2">
				<Label className="text-sm font-medium">Microphone Test</Label>
				<Button 
					variant="outline" 
					className="w-full"
					disabled={isMicrophoneBusy}
				>
					Test Microphone
				</Button>
				<p className="text-xs text-gray-500">
					Test your microphone to ensure it's working properly.
				</p>
			</div>

			{/* Audio Input Device */}
			<div className="space-y-2">
				<Label className="text-sm font-medium">Audio Input Device</Label>
				<Select disabled={isMicrophoneBusy}>
					<SelectTrigger>
						<SelectValue placeholder="Default microphone" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="default">Default microphone</SelectItem>
						<SelectItem value="system">System microphone</SelectItem>
					</SelectContent>
				</Select>
				<p className="text-xs text-gray-500">
					Select which microphone to use for recording.
				</p>
			</div>
		</div>
	)
}
