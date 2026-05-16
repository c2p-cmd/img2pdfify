import { useState, useRef, useEffect } from "react";
import DropZone from "./DropZone";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3000";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPdf() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionId) {
        fetch(`${BASE_URL}/api/chat/session/${sessionId}`, {
          method: "DELETE",
        }).catch(console.error);
      }
    };
  }, [sessionId]);

  const handleUpload = async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file || file.type !== "application/pdf") {
      setError("Please upload a valid PDF file.");
      return;
    }

    setIsUploading(true);
    setError("");
    setFileName(file.name);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await fetch(`${BASE_URL}/api/chat/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setSessionId(data.sessionId);
      setMessages([
        {
          role: "assistant",
          content: `Finished processing "${file.name}". How can I help you with it?`,
        },
      ]);
    } catch (err) {
      setError("Failed to process PDF. Please try again.");
      setFileName("");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !sessionId || isTyping) return;

    const userQuery = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userQuery }]);
    setIsTyping(true);

    try {
      const response = await fetch(`${BASE_URL}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          query: userQuery,
          history: messages.slice(-6), // Send last 3 turns
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      let assistantMessage = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") break;
            try {
              const { token } = JSON.parse(dataStr);
              assistantMessage += token;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1].content = assistantMessage;
                return next;
              });
            } catch (e) {
              // Ignore parse errors for partial chunks
              console.warn(e);
            }
          }
        }
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsTyping(false);
    }
  };

  const resetSession = () => {
    if (sessionId) {
      fetch(`${BASE_URL}/api/chat/session/${sessionId}`, {
        method: "DELETE",
      }).catch(console.error);
    }
    setSessionId(null);
    setMessages([]);
    setFileName("");
    setError("");
  };

  return (
    <div className="tool-panel chat-panel">
      {!sessionId ? (
        <div className="upload-section">
          <DropZone
            eyebrow="AI analysis"
            icon="AI"
            text={
              isUploading
                ? "Processing PDF..."
                : "Upload a PDF to start chatting"
            }
            subtext="Your file is processed and stored ephemerally for this session only."
            inputRef={fileInputRef}
            accept=".pdf,application/pdf"
            onFilesDropped={handleUpload}
            onFilesSelected={handleUpload}
            isHovering={false}
            onDragStateChange={() => {}}
          />
          {error && <p className="error-message">{error}</p>}
        </div>
      ) : (
        <div className="chat-interface">
          <div className="chat-header">
            <span className="file-tag">📄 {fileName}</span>
            <button className="reset-btn" onClick={resetSession}>
              New Chat
            </button>
          </div>

          <div className="messages-container">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {isTyping && (
              <div className="message assistant typing">
                <div className="typing-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form className="chat-input-area" onSubmit={handleSendMessage}>
            <input
              type="text"
              placeholder="Ask a question about the PDF..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping}
            />
            <button type="submit" disabled={!input.trim() || isTyping}>
              Send
            </button>
          </form>

          <p className="privacy-disclaimer">
            Privacy Note: This chat is ephemeral. PDF data and history are
            deleted when you close this session.
          </p>
        </div>
      )}
    </div>
  );
}
