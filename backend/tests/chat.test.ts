import { expect, test, describe } from "bun:test";
import request from "supertest";
import app from "../src/index.js";

describe("RAG Chat", () => {
  test("POST /api/chat/message - validation error", async () => {
    const res = await request(app).post("/api/chat/message").send({});
    expect(res.status).toBe(400);
  });

  test("POST /api/chat/message - should respond with 400 for missing sessionId", async () => {
    const res = await request(app)
      .post("/api/chat/message")
      .send({ query: "Hello" });
    expect(res.status).toBe(400);
  });
});
