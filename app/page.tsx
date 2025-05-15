import SpeechToTextClient from './_components/SpeechToTextClient'

export default function SpeechToTextPage() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
			<div className="w-full max-w-lg space-y-8">
				<h1 className="text-2xl font-semibold text-center text-gray-800">Synapse</h1>
				<SpeechToTextClient />
				<div className="text-center text-sm text-gray-500 mt-8">
					Press and hold <kbd className="px-2 py-1 bg-gray-100 rounded">Space</kbd> to record
				</div>
			</div>
		</div>
	)
}
