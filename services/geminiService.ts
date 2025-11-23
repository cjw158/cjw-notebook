import { GoogleGenAI } from "@google/genai";
import { AIActionType } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const performAIAction = async (
  action: AIActionType,
  text: string,
  context?: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const modelId = 'gemini-2.5-flash';
  let prompt = '';

  switch (action) {
    case AIActionType.SUMMARIZE:
      prompt = `请将以下笔记总结为一段简洁的文字：\n\n${text}`;
      break;
    case AIActionType.FIX_GRAMMAR:
      prompt = `请修改以下文本的语法和拼写错误，保持语气自然且符合中文表达习惯：\n\n${text}`;
      break;
    case AIActionType.CONTINUE_WRITING:
      prompt = `请根据上下文富有创意地续写以下文本，增加约 2-3 句话：\n\n${text}`;
      break;
    case AIActionType.GENERATE_TITLE:
      prompt = `请为以下笔记内容生成一个简短、吸引人的标题（最多 15 个汉字）。只返回标题文本，不要加引号：\n\n${text}`;
      break;
    default:
      return text;
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    
    return response.text?.trim() || text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};