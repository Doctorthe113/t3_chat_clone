import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export async function generate(
    prompts: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    provider: "gemini" | "openai",
    model: string,
    thinkingEffort: "none" | "low" | "medium" | "high",
    systemInstruction: string = "",
    nickname: string = "",
    CustomApiKey: string = ""
) {
    const defaultSystem = `You are an AI assistant, you duty is to listen to what user asks you to do, be consice ie use less words to express your response but remain informative, *BUT IF user asks a request where you need to be verbose such as writing an essay*. Ask for more context if you feel confused instead of hallucinating. If user asks you for anything inappropriate such as extreme nsfw or extreme gore or anything unethical. You are allowed to partake in mild flirtation if *user explicitly asks you to roleplay in some way*. When generating output, be sure to properly use github flavored markdown to beautifully format your response, use inline codeblocks, lists, bullet points etc. ${
        nickname
            ? `User's name is: ${nickname}. Address them with that name`
            : ""
    }`;

    let baseUrl;
    if (provider === "gemini") {
        baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
    } else if (provider === "openai") {
        baseUrl = "https://api.openai.com/v1";
    }

    let apiKey = CustomApiKey;
    if (provider === "gemini") {
        apiKey = process.env.GEMINI_API_KEY as string;
    } else if (provider === "openai") {
        apiKey = process.env.OPENAI_API_KEY as string;
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseUrl,
    });

    const completionOptions: Record<string, any> = {
        model: model,
        messages: [
            { role: "system", content: systemInstruction || defaultSystem },
            ...prompts,
        ],
        stream: true,
    };

    // Conditionally add reasoning_effort if thinkingEffort is not null or undefined
    if (thinkingEffort !== null && thinkingEffort !== undefined) {
        completionOptions.reasoning_effort = thinkingEffort;
    }

    const response = await openai.chat.completions.create(
        completionOptions as any
    );

    return response;
}

export async function generate_title(prompt: string) {
    const geminiAi = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
    });
    const response = await geminiAi.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: prompt,
        config: {
            systemInstruction: {
                text: "Generate a relevant title based on the prompt in under 5 words. Do not use informal language. Do not use puncuation",
            },
            maxOutputTokens: 100,
        },
    });

    return response.text;
}
