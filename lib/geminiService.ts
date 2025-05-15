/**
 * Placeholder for calling the Gemini API to revise text.
 * Replace this with your actual Gemini API client and logic.
 *
 * The prompt to use for Gemini (from user query):
 * You are an assistant embedded in a real-time speech-to-text interface.
 * Your task is to revise partial spoken input into a clean, corrected version
 * that reflects the user's most recent intent. The input may contain
 * self-corrections, revisions, or contradictory instructions that the user
 * clarified after a pause or rephrasing.
 *
 * Instructions:
 * - Interpret the full input as a stream-of-consciousness from a user speaking out loud.
 * - Revise the text to reflect only what the user meant to say, removing earlier
 *   phrasing that was changed, corrected, or walked back.
 * - Maintain the user's original tone and wording when possible.
 * - Do not summarize. Simply rewrite the transcript to be natural, complete, and coherent.
 * - Output only the revised text with no explanation or formatting.
 */
export const reviseTextWithGemini = async (text: string): Promise<string> => {
  console.log("Gemini Service: Requesting revision for text:", text);

  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
      console.error("Gemini Service: API call failed with status", response.status, errorData);
      // In case of an API error from our endpoint, fall back to original text to avoid breaking the flow.
      // You might want to handle this differently, e.g., show a user notification.
      return text; 
    }

    const data = await response.json();
    
    if (data.revisedText) {
      console.log("Gemini Service: Received revised text:", data.revisedText);
      if (data.note) {
        console.warn("Gemini Service: Note from API:", data.note);
      }
      return data.revisedText;
    } else if (data.error) {
      console.error("Gemini Service: API returned an error:", data.error);
      return text; // Fallback to original text
    } else {
      console.warn("Gemini Service: Received unexpected response format, returning original text", data);
      return text; // Fallback for unexpected response
    }

  } catch (error) {
    console.error("Gemini Service: Network or other error during API call:", error);
    // In case of network error, fall back to original text.
    return text; 
  }
}; 