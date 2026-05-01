import os
import json
import requests
import time
from dotenv import load_dotenv

# Load Environment Variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# 2026 Model Stack (Verified Names)
CHAT_MODELS = [
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash-preview",
    "gemini-2.5-pro-preview",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
]

# Embedding Models (2026 Verified)
EMBED_MODELS = [
    "gemini-embedding-2",
    "gemini-embedding-001",
    "gemini-embedding-2:embedContent",
]

def get_chat_url(model_name):
    # Ensure models/ prefix if needed
    full_name = model_name if model_name.startswith("models/") else f"models/{model_name}"
    return f"https://generativelanguage.googleapis.com/v1beta/{full_name}:generateContent?key={GEMINI_API_KEY}"

def get_embed_url(model_name):
    full_name = model_name if model_name.startswith("models/") else f"models/{model_name}"
    return f"https://generativelanguage.googleapis.com/v1beta/{full_name}:embedContent?key={GEMINI_API_KEY}"

def is_physics_query(text):
    """Greeting detection logic"""
    greetings = ["hi", "hello", "hey", "hola", "hi there", "hello there", "good morning", "good afternoon", "yo", "how are you"]
    bengali_greetings = ["ওহে", "হ্যালো", "হাই", "কেমন আছো", "সালাম", "নমস্কার", "শুভ সকাল"]
    cleaned = text.lower().strip().replace("?", "").replace("!", "")
    if cleaned in greetings or cleaned in bengali_greetings:
        return False, "Hello! I am your ShikhAI Physics Tutor. How can I help you today?"
    return True, None

def get_embedding(text):
    """Stacked Embedding retrieval with Failover"""
    for model in EMBED_MODELS:
        url = get_embed_url(model)
        # Handle models/ prefix for the body as well
        model_id = model if model.startswith("models/") else f"models/{model}"
        body = {"model": model_id, "content": {"parts": [{"text": text}]}}
        for attempt in range(2):
            try:
                resp = requests.post(url, json=body, timeout=10)
                if resp.status_code == 200:
                    return resp.json()["embedding"]["values"]
                elif resp.status_code == 503:
                    time.sleep(1)
                else:
                    print(f"Embedding {model} failed with {resp.status_code}")
                    break
            except Exception as e:
                print(f"Embedding {model} error: {str(e)}")
                break
    raise Exception("Critical: All Embedding models are overloaded.")

def search_supabase(query_embedding, top_k=5):
    """High-precision Supabase search"""
    headers = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "Content-Type": "application/json"}
    body = {"query_embedding": query_embedding, "match_threshold": 0.6, "match_count": top_k}
    resp = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/match_documents", headers=headers, json=body)
    if resp.status_code == 200: return resp.json()
    raise Exception(f"Search failed: {resp.text}")

def generate_answer(query, retrieved_chunks):
    """Stacked Chat generation with Failover"""
    context_text = "\n\n---\n\n".join([chunk["content"] for chunk in retrieved_chunks])
    sys_prompt = "You are a Physics tutor. Answer based on context. Reply in user's language. Use LaTeX."
    body = {"systemInstruction": {"parts": [{"text": sys_prompt}]}, "contents": [{"role": "user", "parts": [{"text": f"CONTEXT:\n{context_text}\n\nQUERY: {query}"}]}]}
    for model in CHAT_MODELS:
        url = get_chat_url(model)
        for attempt in range(2):
            try:
                resp = requests.post(url, json=body, timeout=30)
                if resp.status_code == 200:
                    return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                elif resp.status_code == 503:
                    print(f"Model {model} busy (503).")
                    break
                else:
                    print(f"Model {model} error {resp.status_code}")
                    break
            except Exception as e:
                print(f"Model {model} connection error: {str(e)}")
                break
    raise Exception("All Chat models are currently busy.")

def generate_quiz_from_rag(topic, difficulty=3, count=5, language='bn'):
    """Generates a conceptual MCQ quiz with accurate page citations"""
    emb = get_embedding(topic)
    docs = search_supabase(emb, top_k=10)
    
    # Include the actual page number in the context for the AI to see
    context_items = []
    for chunk in docs:
        pg = chunk.get("metadata", {}).get("page") or chunk.get("metadata", {}).get("pages") or "Unknown"
        context_items.append(f"SOURCE (PAGE {pg}):\n{chunk['content']}")
    
    context_text = "\n\n---\n\n".join(context_items)
    
    sys_prompt = (
        f"You are an expert Physics examiner. Generate {count} Multiple Choice Questions (MCQs) "
        f"at Difficulty Level {difficulty}/5 in {('Bengali' if language == 'bn' else 'English')}. \n"
        f"RULES:\n"
        f"1. Return ONLY a valid JSON ARRAY.\n"
        f"2. Each object MUST have: 'question', 'options' (array of 4), 'correct_index' (0-3), 'explanation', and 'source_page'.\n"
        f"3. IMPORTANT: For the 'source_page' field, use the EXACT Page Number provided in the SOURCE headers above (e.g., 'Page 42')."
    )
    
    body = {
        "systemInstruction": {"parts": [{"text": sys_prompt}]}, 
        "contents": [{"role": "user", "parts": [{"text": f"CONTEXT:\n{context_text}\n\nTOPIC: {topic}"}]}], 
        "generationConfig": {"responseMimeType": "application/json"}
    }
    
    for model in CHAT_MODELS:
        url = get_chat_url(model)
        try:
            resp = requests.post(url, json=body, timeout=40)
            if resp.status_code == 200:
                data = resp.json()
                json_text = data["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(json_text)
        except Exception as e:
            print(f"Quiz model {model} failed: {str(e)}")
            continue
    raise Exception("Quiz generation failed.")

if __name__ == "__main__":
    print("ShikhAI Ultra-Stacked RAG Engine Online.")
