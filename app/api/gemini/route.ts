import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

const MODEL_NAME = process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash'

export async function POST(request: Request) {
	try {
		const { text, customPrompt, outputMarkdown } = await request.json()

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

		console.log('customPrompt', customPrompt)

		const markdownInstruction = outputMarkdown 
			? '\n\nFormat your response using appropriate markdown syntax (headings, lists, bold, italic) to enhance readability and structure.'
			: '\n\nProvide your response in plain text without any markdown formatting.'

		const basePrompt = `You are an AI assistant specializing in real-time speech-to-text refinement. Your primary role is to transform raw spoken input into polished, coherent text while preserving the speaker's authentic voice and intended message.

Core Objectives:
1. Process the input as natural spoken language, complete with typical speech patterns like self-corrections and revisions
2. Remove false starts, repetitions, and corrected phrases
3. Preserve the speaker's original vocabulary, tone, and speaking style
4. Maintain all meaningful content and context
5. Deliver a fluid, natural-sounding result

Key Requirements:
- Focus solely on clarifying and cleaning up the text
- Keep all substantive content intact
- Remove only elements that represent speech disfluencies or corrections
- Preserve the speaker's unique voice and expression style
- Return only the refined text without explanations or meta-commentary${markdownInstruction}`

		const additionalInstructions = customPrompt 
			? `\n\nSpecial Instructions:\n${customPrompt}\n\nIMPORTANT: Provide ONLY the revised text in your response. Do not include any explanations, notes, or additional content.` 
			: ''

		const prompt = `${basePrompt}${additionalInstructions}

Input Text:
${text}

Revised Version:`

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
