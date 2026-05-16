import express from "express";
import multer from "multer";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { v4 as uuidv4 } from "uuid";
import {
  qdrantClient,
  COLLECTION_NAME,
  ensureCollection,
} from "../services/qdrant.js";
import { embeddings, chatModel } from "../services/llm.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Ingest PDF
router.post("/upload", upload.single("pdf"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const sessionId = uuidv4();
    await ensureCollection();

    // Load and split PDF
    const blob = new Blob([file.buffer], { type: "application/pdf" });
    const loader = new WebPDFLoader(blob);
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await splitter.splitDocuments(docs);

    // Embed and store
    const texts = chunks.map((c) => c.pageContent);
    const vectorData = await embeddings.embedDocuments(texts);

    const points = vectorData.map((vector, idx) => ({
      id: uuidv4(),
      vector,
      payload: {
        sessionId,
        content: texts[idx],
        metadata: chunks[idx].metadata,
      },
    }));

    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points,
    });

    res.json({ sessionId, message: "PDF ingested successfully" });
  } catch (error) {
    console.error("Ingestion error:", error);
    res.status(500).json({ error: "Failed to process PDF" });
  }
});

// Chat with PDF
router.post("/message", async (req, res) => {
  const { sessionId, query, history } = req.body ?? {};
  const normalizedHistory = Array.isArray(history) ? history : [];

  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  if (typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "query is required" });
  }

  try {
    console.log("[CHAT] 📥 Incoming request:", {
      sessionId,
      query,
      historyLength: normalizedHistory.length,
    });

    // 1. Query Expansion / Rewriting
    const rewritePrompt = `Given the following conversation and a new user question, rewrite the question to be a standalone search query that captures the full context. 
    
    History: ${JSON.stringify(normalizedHistory)}
    Question: ${query}
    
    Standalone Query:`;

    let searchTerms = query;
    try {
      console.log("[CHAT] 🔄 Sending query rewrite prompt to LLM");
      const rewrittenQueryResponse = await chatModel.invoke([
        new HumanMessage(rewritePrompt),
      ]);
      const rewritten = rewrittenQueryResponse.content?.toString().trim();
      if (rewritten) {
        searchTerms = rewritten;
      }
      console.log("[CHAT] ✅ Rewritten query:", searchTerms);
    } catch (rewriteError) {
      console.warn("[CHAT] ⚠️  Query rewrite failed, using original query", {
        message: (rewriteError as any)?.message,
        code: (rewriteError as any)?.code,
      });
    }

    // 2. Retrieval with Threshold
    console.log("[CHAT] 🔍 Embedding query...");
    const queryVector = await embeddings.embedQuery(searchTerms);
    console.log(
      "[CHAT] ✅ Query vector created, dimension:",
      queryVector.length,
    );

    console.log("[CHAT] 🗂️  Searching Qdrant collection...", {
      collection: COLLECTION_NAME,
      sessionId,
      limit: 5,
      score_threshold: 0.3,
    });

    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryVector,
      filter: {
        must: [{ key: "sessionId", match: { value: sessionId } }],
      },
      limit: 5,
      score_threshold: 0.3, // Similarity threshold
    });

    console.log("[CHAT] ✅ Search results:", {
      resultsCount: searchResult.length,
      scores: searchResult.map((hit) => ({
        score: hit.score,
        contentLength: (hit.payload?.content as string)?.length || 0,
      })),
    });

    const context = searchResult
      .map((hit) => hit.payload?.content)
      .filter(Boolean)
      .join("\n---\n");

    console.log("[CHAT] 📄 Context prepared:", {
      contextLength: context.length,
      hasContent: !!context,
    });

    if (!context) {
      console.log("[CHAT] ⚠️  No context found for query");
      return res.json({
        answer:
          "I couldn't find any relevant information in the PDF to answer that.",
        contextFound: false,
      });
    }

    // 3. Full Response
    const systemPrompt = `You are a helpful assistant. Answer the user's question based on the provided context from a PDF. If the answer isn't in the context, say you don't know.
    
    Context:
    ${context}`;

    console.log("[CHAT] 🚀 Generating response...");
    const answerResponse = await chatModel.invoke([
      new SystemMessage(systemPrompt),
      ...normalizedHistory.map((m: any) =>
        m.role === "user"
          ? new HumanMessage(m.content)
          : new SystemMessage(m.content),
      ),
      new HumanMessage(query),
    ]);

    const answer = answerResponse.content?.toString().trim();
    if (!answer) {
      console.warn("[CHAT] ⚠️  Empty LLM response");
      return res.status(502).json({ error: "Empty response from model" });
    }

    console.log("[CHAT] ✅ Response complete");
    return res.json({ answer, contextFound: true });
  } catch (error) {
    console.error("[CHAT] ❌ Chat error:", {
      error,
      message: (error as any).message,
      status: (error as any).status,
      code: (error as any).code,
    });
    return res.status(500).json({ error: "Failed to process chat message" });
  }
});

// Cleanup session
router.delete("/session/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await qdrantClient.delete(COLLECTION_NAME, {
      filter: {
        must: [{ key: "sessionId", match: { value: id } }],
      },
    });
    res.json({ message: "Session data cleared" });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({ error: "Failed to clear session data" });
  }
});

export default router;
