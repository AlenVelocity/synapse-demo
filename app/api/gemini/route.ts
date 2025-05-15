import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

const MODEL_NAME = process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash'

export async function POST(request: Request) {
	try {
		const { text } = await request.json()

		if (!text) {
			return Response.json({ error: 'Text is required' }, { status: 400 })
		}

		const apiKey = process.env.GEMINI_API_KEY
		if (!apiKey) {
			console.error('GEMINI_API_KEY is not set.')
			return Response.json({ error: 'API key not configured' }, { status: 500 })
		}

		const genAI = new GoogleGenerativeAI(apiKey)
		const model = genAI.getGenerativeModel({ model: MODEL_NAME })

		const generationConfig = {
			temperature: 0.7,
			topK: 1,
			topP: 1,
			maxOutputTokens: 2048
		}

		const safetySettings = [
			{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
			{ category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
			{ category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
			{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
		]

		const prompt = `You are an assistant embedded in a real-time speech-to-text interface. Your task is to revise partial spoken input into a clean, corrected version that reflects the user's most recent intent. The input may contain self-corrections, revisions, or contradictory instructions that the user clarified after a pause or rephrasing.

Instructions:
- Interpret the full input as a stream-of-consciousness from a user speaking out loud.
- Revise the text to reflect only what the user meant to say, removing earlier phrasing that was changed, corrected, or walked back.
- Maintain the user's original tone and wording when possible.
- Do not summarize. Simply rewrite the transcript to be natural, complete, and coherent.
- Output only the revised text with no explanation or formatting.

Input:
${text}

Output:`

		const result = await model.generateContent({
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
			generationConfig,
			safetySettings
		})

		if (result.response) {
			const revisedText = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
			if (revisedText) {
				return Response.json({ revisedText })
			} else {
				console.error('Gemini API response did not contain expected text:', result.response)
				return Response.json({ revisedText: text, note: 'Gemini did not return a revision.' })
			}
		} else {
			console.error('Gemini API call failed or returned no response:', result)
			return Response.json({ error: 'Failed to get response from Gemini API' }, { status: 500 })
		}
	} catch (error) {
		console.error('Error in Gemini API route:', error)
		const errorMessage = error instanceof Error ? error.message : 'Internal server error'
		return Response.json({ error: errorMessage }, { status: 500 })
	}
}
