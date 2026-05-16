import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { OpenAI } from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = process.env.OPENAI_BASE_URL;
const OPENAI_MODEL = process.env.OPENAI_MODEL;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL;

if (!OPENAI_API_KEY || !OPENAI_API_URL || !OPENAI_MODEL || !EMBEDDING_MODEL) {
  console.warn(
    "OpenAI parameters not set.",
    OPENAI_API_KEY,
    OPENAI_API_URL,
    OPENAI_MODEL,
    EMBEDDING_MODEL,
  );
  process.exit(1);
}

// Custom OpenAI client that handles asymmetric embedding models
class AsymmetricOpenAIEmbeddings extends OpenAIEmbeddings {
  private openaiClient: OpenAI;

  constructor(params: ConstructorParameters<typeof OpenAIEmbeddings>[0]) {
    super(params);
    this.openaiClient = new OpenAI({
      apiKey: params.apiKey,
      baseURL: params.configuration?.baseURL,
    });
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const response = await this.openaiClient.embeddings.create({
      model: this.model!,
      input: texts,
      input_type: "passage",
    } as any);
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await this.openaiClient.embeddings.create({
      model: this.modelName!,
      input: text,
      input_type: "query",
    } as any);
    return response.data[0].embedding;
  }
}

export const embeddings = new AsymmetricOpenAIEmbeddings({
  apiKey: OPENAI_API_KEY,
  configuration: {
    baseURL: OPENAI_API_URL,
  },
  model: EMBEDDING_MODEL,
});

export const chatModel = new ChatOpenAI({
  openAIApiKey: OPENAI_API_KEY,
  configuration: {
    baseURL: OPENAI_API_URL,
  },
  model: OPENAI_MODEL,
  temperature: 0.7,
  topP: 1,
  maxTokens: 16384,
  modelKwargs: {
    extra_body: {
      chat_template_kwargs: {
        enable_thinking: false,
        clear_thinking: true,
      },
    },
  },
});
