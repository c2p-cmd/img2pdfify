import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

if (!QDRANT_URL || !QDRANT_API_KEY) {
  console.warn(
    "QDRANT_URL or QDRANT_API_KEY not set. Qdrant service will be unavailable.",
  );
  process.exit(1);
}

export const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

export const COLLECTION_NAME = "ephemeral_pdfs";

export async function ensureCollection() {
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === COLLECTION_NAME,
    );

    if (!exists) {
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 1024,
          distance: "Cosine",
        },
      });
      
      // Create index for sessionId field
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: "sessionId",
        field_schema: "keyword",
      });
      
      console.log(`Collection ${COLLECTION_NAME} created.`);
    }
  } catch (error) {
    console.error("Error ensuring Qdrant collection:", error);
  }
}
