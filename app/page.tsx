import SpeechToTextClient from './_components/SpeechToTextClient'
import { Github } from 'lucide-react';

export default function SpeechToTextPage() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 overflow-hidden fixed inset-0">
			<div className="w-full max-w-lg space-y-8">
				<h1 className="text-2xl font-semibold text-center text-gray-800">Synapse</h1>
				<SpeechToTextClient />
				<div className="text-center text-sm text-gray-500 mt-8">
					Press and hold <kbd className="px-2 py-1 bg-gray-100 rounded">Space</kbd> to record
				</div>
			</div>
			<a
				href="https://github.com/alenvelocity/synapse-demo"
				target="_blank"
				rel="noopener noreferrer"
				className="fixed bottom-4 right-4 p-2 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
				title="View on GitHub"
			>
				<Github size={24} />
			</a>
		</div>
	)
}
