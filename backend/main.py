from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from rag import get_embedding, search_supabase, generate_answer, generate_quiz_from_rag

app = FastAPI(title="ShikhAI Backend API")

# Enable CORS for frontend integration
# Production CORS Setup
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "online", "system": "ShikhAI Physics Tutor"}

class ChatRequest(BaseModel):
    message: str
    language: Optional[str] = "bn"
    user_id: Optional[str] = None

class QuizRequest(BaseModel):
    topic: str
    difficulty: Optional[int] = 3
    count: Optional[int] = 5
    language: Optional[str] = "bn"

from rag import get_embedding, search_supabase, generate_answer, generate_quiz_from_rag, is_physics_query

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        # 0. Check for greetings to avoid unnecessary search and weird citations
        is_academic, greeting_resp = is_physics_query(request.message)
        if not is_academic:
            return {
                "answer": greeting_resp,
                "sources": []
            }

        # 1. Get embedding for the message
        emb = get_embedding(request.message)
        
        # 2. Search database
        docs = search_supabase(emb, top_k=4)
        
        # Only keep high-confidence matches
        docs = [d for d in docs if d.get('similarity', 0) >= 0.6]
        
        # 3. Handle case where no textbook info found
        if not docs:
            return {
                "answer": "I'm sorry, I couldn't find specific information about that in the physics textbook. Could you try rephrasing your question or asking about a different physics topic?",
                "sources": []
            }

        # 4. Generate answer
        answer = generate_answer(request.message, docs)
        
        # 5. Extract citations - but ONLY if it's not a refusal
        sources = []
        if not answer.strip().startswith("[REFUSAL]"):
            pages = set()
            for d in docs:
                meta = d.get("metadata", {})
                p_val = meta.get("page") or meta.get("pages")
                if p_val:
                    pages.add(str(p_val))
            
            # Robust page sorting
            def page_key(p):
                try:
                    if '-' in p: return int(p.split('-')[0])
                    return int(''.join(filter(str.isdigit, p)) or 0)
                except: return 0
                
            sorted_pages = sorted(list(pages), key=page_key)
            sources = [f"Page {p}" for p in sorted_pages]
        else:
            # Clean the [REFUSAL] tag before sending to frontend
            answer = answer.replace("[REFUSAL]", "").strip()
        
        return {
            "answer": answer,
            "sources": sources
        }
    except Exception as e:
        print(f"ERROR: {str(e)}") # Log error to console
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/quiz")
async def quiz_endpoint(request: QuizRequest):
    try:
        quiz_data = generate_quiz_from_rag(
            topic=request.topic,
            difficulty=request.difficulty,
            count=request.count,
            language=request.language
        )
        return quiz_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {"status": "online", "message": "ShikhAI Backend is running!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
