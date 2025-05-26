'use client'

import { createContext, useCallback, useContext, useState, ReactNode } from 'react'

interface MicrophoneContextType {
	microphone: MediaRecorder | null
	startMicrophone: () => void
	stopMicrophone: () => void
	setupMicrophone: () => Promise<void>
	cleanupMicrophone: () => void
	microphoneState: MicrophoneState | null
}

export enum MicrophoneEvents {
	DataAvailable = 'dataavailable',
	Error = 'error',
	Pause = 'pause',
	Resume = 'resume',
	Start = 'start',
	Stop = 'stop'
}

export enum MicrophoneState {
	NotSetup = -1,
	SettingUp = 0,
	Ready = 1,
	Opening = 2,
	Open = 3,
	Error = 4,
	Pausing = 5,
	Paused = 6
}

const MicrophoneContext = createContext<MicrophoneContextType | undefined>(undefined)

interface MicrophoneContextProviderProps {
	children: ReactNode
}

const MicrophoneContextProvider: React.FC<MicrophoneContextProviderProps> = ({ children }) => {
	const [microphoneState, setMicrophoneState] = useState<MicrophoneState>(MicrophoneState.NotSetup)
	const [microphone, setMicrophone] = useState<MediaRecorder | null>(null)
	const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)

	const setupMicrophone = async () => {
		setMicrophoneState(MicrophoneState.SettingUp)

		try {
			const userMedia = await navigator.mediaDevices.getUserMedia({
				audio: {
					noiseSuppression: true,
					echoCancellation: true
				}
			})

			const microphone = new MediaRecorder(userMedia)

			setMicrophoneState(MicrophoneState.Ready)
			setMicrophone(microphone)
			setMediaStream(userMedia)
		} catch (err: any) {
			console.error(err)
			setMicrophoneState(MicrophoneState.Error)
			throw err
		}
	}

	const cleanupMicrophone = useCallback(() => {
		if (microphone?.state === 'recording') {
			microphone.stop()
		}
		
		if (mediaStream) {
			mediaStream.getTracks().forEach(track => track.stop())
			setMediaStream(null)
		}
		
		setMicrophone(null)
		setMicrophoneState(MicrophoneState.NotSetup)
	}, [microphone, mediaStream])

	const stopMicrophone = useCallback(() => {
		setMicrophoneState(MicrophoneState.Pausing)

		if (microphone?.state === 'recording') {
			microphone.pause()
			setMicrophoneState(MicrophoneState.Paused)
		}
	}, [microphone])

	const startMicrophone = useCallback(() => {
		setMicrophoneState(MicrophoneState.Opening)

		if (microphone?.state === 'paused') {
			microphone.resume()
		} else {
			microphone?.start(250)
		}

		setMicrophoneState(MicrophoneState.Open)
	}, [microphone])

	return (
		<MicrophoneContext.Provider
			value={{
				microphone,
				startMicrophone,
				stopMicrophone,
				setupMicrophone,
				cleanupMicrophone,
				microphoneState
			}}
		>
			{children}
		</MicrophoneContext.Provider>
	)
}

function useMicrophone(): MicrophoneContextType {
	const context = useContext(MicrophoneContext)

	if (context === undefined) {
		throw new Error('useMicrophone must be used within a MicrophoneContextProvider')
	}

	return context
}

export { MicrophoneContextProvider, useMicrophone }
