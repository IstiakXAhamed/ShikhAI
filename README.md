<div align="center">

<h1>🎓 ShikhAI — বাংলা Physics Tutor</h1>

<p><strong>An AI-powered, RAG-based Physics tutor built on top of the official NCTB Bengali Physics textbook.<br/>Ask questions in Bengali or English — get precise, textbook-grounded answers instantly.</strong></p>

<p>
  <img src="https://img.shields.io/badge/Python-3.10-blue?style=for-the-badge&logo=python" />
  <img src="https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi" />
  <img src="https://img.shields.io/badge/Supabase-pgvector-3ECF8E?style=for-the-badge&logo=supabase" />
  <img src="https://img.shields.io/badge/Gemini_AI-2026_Stack-4285F4?style=for-the-badge&logo=google" />
  <img src="https://img.shields.io/badge/Deployed_on-Cloud_Run-orange?style=for-the-badge&logo=googlecloud" />
</p>

</div>

---

## 📌 What is ShikhAI?

**ShikhAI** (শিখ AI — "Learn AI" in Bengali) is a full-stack, production-ready **Retrieval-Augmented Generation (RAG)** application built as an NLP course project at **AIUB**.

It ingests the entire 366-page **NCTB Bengali Physics textbook** using Gemini Vision AI, stores it in a **Supabase vector database**, and provides students with:
- 💬 A **Chat Interface** to ask physics questions (Bengali + English)
- 📝 An **AI Quiz Generator** with difficulty levels and page citations
- 📖 **Textbook-grounded answers** — the AI only answers from the actual book
- 🔢 **LaTeX math rendering** for all formulas

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA INGESTION PIPELINE                   │
│                                                               │
│  physics.pdf  ──►  PyMuPDF  ──►  Base64 Images               │
│                                      │                        │
│                              Gemini Vision AI                 │
│                         (gemini-3.1-flash-lite)               │
│                                      │                        │
│                         Bengali Text + LaTeX + Diagram Desc. │
│                                      │                        │
│                           make_chunks() (600 chars)           │
│                                      │                        │
│                         gemini-embedding-2 (Batch API)       │
│                                      │                        │
│                         Supabase pgvector Database            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     QUERY (RAG) PIPELINE                      │
│                                                               │
│  User Question  ──►  gemini-embedding-2  ──►  Query Vector   │
│                                                     │         │
│                              Supabase match_documents()       │
│                              (cosine similarity ≥ 0.60)      │
│                                                     │         │
│                              Top-5 Relevant Chunks            │
│                                                     │         │
│                         Gemini Chat (Stacked Failover)        │
│                      (7 models tried in priority order)       │
│                                                     │         │
│                    Answer + Source Page Citations             │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔍 **Semantic Search** | Finds relevant textbook sections using vector cosine similarity |
| 🌐 **Bilingual** | Fully supports Bengali (বাংলা) and English queries |
| 📐 **LaTeX Math** | All physics formulas rendered with proper LaTeX |
| 📖 **Page Citations** | Every answer cites the exact textbook page number |
| 🧠 **AI Quiz Generator** | Generates MCQs at 5 difficulty levels on any topic |
| 🤝 **Greeting Detection** | Intelligently separates casual chat from academic queries |
| 🔄 **Stacked Failover** | 7 Gemini models tried in sequence — never goes offline |
| 💾 **Resumable Ingestion** | OCR pipeline saves progress after every page, can resume anytime |
| 🚫 **Grounding Filter** | AI strictly refuses to answer non-textbook questions |

---

## 🛠️ Tech Stack

### Backend
| Technology | Role |
|---|---|
| **Python 3.10** | Core language |
| **FastAPI** | REST API server |
| **Uvicorn** | ASGI production server |
| **PyMuPDF (fitz)** | PDF to image conversion |
| **Gemini Vision AI** | OCR — extracts Bengali text, diagrams, and formulas from scanned pages |
| **gemini-embedding-2** | Creates 3072-dimension semantic vectors |
| **Supabase + pgvector** | Vector database for similarity search |
| **Docker** | Containerization |
| **Google Cloud Run** | Production deployment |

### Frontend
| Technology | Role |
|---|---|
| **React + Vite** | UI framework |
| **Vanilla CSS** | Styling — no Tailwind dependency |
| **Vercel** | Production hosting |

---

## 📁 Project Structure

```
ShikhAI/
│
├── backend/
│   ├── main.py              # FastAPI server — /api/chat and /api/quiz endpoints
│   ├── rag.py               # Core RAG engine — embedding, search, generation, quiz
│   ├── ingest.py            # 2-phase ingestion pipeline (OCR → embed → upload)
│   ├── config.py            # Loads API keys from .env
│   ├── Dockerfile           # Docker config for Cloud Run deployment
│   ├── requirements.txt     # All Python dependencies (hard-pinned for stability)
│   ├── .env.example         # Template for environment variables
│   └── data/
│       └── physics.pdf      # The source NCTB Physics textbook (not committed)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React application
│   │   ├── styles.css       # Complete UI design system
│   │   ├── components/      # Reusable UI components
│   │   ├── data/
│   │   │   └── translations.js  # Bengali/English i18n strings
│   │   └── services/        # API call helpers
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json          # Vercel deployment config
│
└── README.md
```

---

## ⚙️ How the Ingestion Pipeline Works (`ingest.py`)

The ingestion is a **2-phase pipeline** that only needs to run **once**:

### Phase 1 — Vision OCR
1. Opens `physics.pdf` using **PyMuPDF**
2. Converts each page to a **1.5× resolution PNG image**
3. Encodes the image in **Base64** and sends it to **Gemini Vision AI**
4. The AI extracts:
   - All Bengali text as structured bullet points
   - Math formulas in **LaTeX** format (`$...$` or `$$...$$`)
   - Detailed descriptions of every diagram and graph
5. Progress is **saved after every page** to `extracted_text.json` so the process can be **resumed** if interrupted

### Phase 2 — Embed & Upload
1. Loads the extracted text chunks from the JSON cache
2. Sends batches of **90 chunks** to `gemini-embedding-2` via the **batchEmbedContents** API
3. Uploads the text + 3072-dim vector to **Supabase** along with the source page number as metadata
4. Tracks uploaded indexes to avoid **duplicate uploads** on resume

> **Quota-Aware:** The pipeline respects Gemini's free-tier limits — 5-second delays between OCR calls, 45-second waits on 503/429 errors, and 60-second pauses between embedding batches.

---

## 🔎 How the RAG Query Pipeline Works (`rag.py`)

When a user asks a question:

1. **Greeting Check** — Detects casual messages ("hi", "হ্যালো") and responds friendly without hitting the database
2. **Embed the Query** — The user's question is converted to a vector using `gemini-embedding-2`
3. **Search Supabase** — Finds the top-5 most semantically similar textbook chunks (similarity threshold ≥ 0.60)
4. **Generate Answer** — The retrieved chunks are passed as context to a Gemini chat model with the instruction to answer only from the provided context
5. **Cite Sources** — Source page numbers are extracted from chunk metadata and returned alongside the answer
6. **Stacked Failover** — If one Gemini model is busy (503), the next one in a list of 7 models is tried automatically

---

## 🧪 API Endpoints

### `POST /api/chat`
Ask a physics question.

**Request:**
```json
{
  "message": "নিউটনের গতিসূত্র কী?",
  "language": "bn"
}
```

**Response:**
```json
{
  "answer": "নিউটনের প্রথম গতিসূত্র হলো...",
  "sources": ["Page 42", "Page 43"]
}
```

---

### `POST /api/quiz`
Generate an MCQ quiz on any topic.

**Request:**
```json
{
  "topic": "আলোর প্রতিফলন",
  "difficulty": 3,
  "count": 5,
  "language": "bn"
}
```

**Response:**
```json
[
  {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct_index": 1,
    "explanation": "...",
    "source_page": "Page 87"
  }
]
```

---

### `GET /api/health`
Health check endpoint.

---

## 🚀 Local Setup Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- A [Gemini API Key](https://aistudio.google.com) (free)
- A [Supabase](https://supabase.com) project with the `pgvector` extension enabled

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/ShikhAI.git
cd ShikhAI
```

### 2. Backend Setup
```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Open .env and fill in your GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

# Run the API server
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
copy .env.example .env
# Set VITE_BACKEND_URL=http://localhost:8000

# Start the dev server
npm run dev
```

### 4. Run the Ingestion Pipeline *(One-time only)*
> ⚠️ Place your `physics.pdf` inside `backend/data/` before running.
```bash
cd backend
python ingest.py
```
This will process the entire textbook, embed all chunks, and upload them to Supabase. It is resumable — safe to stop and restart at any point.

---

## 🌍 Deployment

### Backend — Google Cloud Run
```bash
cd backend
gcloud run deploy shikhai-backend --source . --region=asia-south1 --allow-unauthenticated
```

### Frontend — Vercel
```bash
cd frontend
vercel --prod
```

---

## 🔒 Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (for server-side writes) |

### Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `VITE_BACKEND_URL` | URL of the deployed backend API |

---

## 🛡️ Design Decisions & Challenges Solved

| Challenge | Solution |
|---|---|
| Scanned Bengali PDF (no selectable text) | Gemini Vision AI used for OCR instead of PyPDF |
| Copyright recitation filters blocking text | Structured prompt engineering — converts paragraphs to Bengali bullet points |
| API rate limits (15 RPM free tier) | 5-second delays + 45-second exponential backoff on 503/429 |
| Incomplete ingestion on network errors | JSON cache saves progress after every page — fully resumable |
| AI hallucinating outside the textbook | Similarity threshold filter (≥ 0.60) + strict grounding system prompt |
| Single model API downtime | Stacked failover across 7 Gemini models in priority order |
| Embedding quota (1000 RPD) | `batchEmbedContents` API — 90 chunks in a single request |

---

## 👩‍💻 Author

**Samia** — AIUB CSE  
*NLP Course Project — Spring 2026*

---

## 📄 License

This project is for academic purposes only. The textbook content belongs to **NCTB (National Curriculum and Textbook Board), Bangladesh**.
