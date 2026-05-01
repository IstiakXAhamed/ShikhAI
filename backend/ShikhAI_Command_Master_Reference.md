# 📑 SHIKHAI: THE HYPER-EXHAUSTIVE COMMAND MASTER REFERENCE
**The Definitive 500-Line Setup Guide for Developers & Faculty**

---

## 📑 TABLE OF CONTENTS
1.  **SYSTEM PREREQUISITES** (Installing the Foundation)
2.  **DATABASE INITIALIZATION (SQL Deep-Dive)**
3.  **DATABASE SECURITY & RLS POLICIES**
4.  **DATABASE MAINTENANCE & UTILITY COMMANDS**
5.  **BACKEND ENVIRONMENT SETUP (Python)**
6.  **BACKEND DATA INGESTION COMMANDS**
7.  **BACKEND API OPERATIONS**
8.  **FRONTEND ENVIRONMENT SETUP (Node.js)**
9.  **FRONTEND DEVELOPMENT & BUILD WORKFLOW**
10. **VERSION CONTROL & TEAM COLLABORATION (Git)**
11. **ENVIRONMENT VARIABLE CONFIGURATION (.env)**
12. **PROJECT DIRECTORY ARCHITECTURE**

---

## 🛠️ 1. SYSTEM PREREQUISITES
Before you start, every teammate must have these installed on their Windows machine.

### 1.1 Python Installation (Backend)
1. Download Python 3.10+ from python.org.
2. **CRITICAL:** Check the box "Add Python to PATH" during installation.
```powershell
# Verify installation
python --version
pip --version
```

### 1.2 Node.js Installation (Frontend)
1. Download Node.js (LTS Version) from nodejs.org.
```powershell
# Verify installation
node -v
npm -v
```

### 1.3 Git Installation (Collaboration)
1. Download Git from git-scm.com.
```powershell
# Verify installation
git --version
```

---

## 💾 2. DATABASE INITIALIZATION (SQL DEEP-DIVE)
Run these in the **Supabase SQL Editor**. These commands build the "Brain" and "Memory" of ShikhAI.

### 2.1 Extension Activation
```sql
-- Step: Unlock Vector Math capabilities
-- This must be run before any other command.
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2.2 Knowledge Base Table (The RAG Brain)
```sql
-- Step: Create storage for textbook paragraphs
CREATE TABLE physics_chunks (
  id BIGSERIAL PRIMARY KEY, -- Unique ID for every chunk
  content TEXT,              -- The actual Bengali/English text
  metadata JSONB,            -- Stores page numbers and chapters
  embedding VECTOR(3072)    -- The 3,072-dimensional math coordinates
);

-- Explanation for Teammates:
-- We use BIGSERIAL so we never run out of IDs (up to 9 quintillion).
-- JSONB allows us to add new metadata (like 'topic_importance') without changing the table.
```

### 2.3 Search Optimization (HNSW Index)
```sql
-- Step: Create a Hierarchical Navigable Small World index
-- This makes searching 100x faster by creating a 'map' of concepts.
CREATE INDEX ON physics_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Explanation:
-- Without this, the database checks every single paragraph one by one.
-- With this, it jumps directly to the 'cluster' of paragraphs that match the question.
```

### 2.4 Vector Search Function (The RPC)
```sql
-- Step: Create the core search logic called by Python
CREATE OR REPLACE FUNCTION match_physics_chunks (
  query_embedding VECTOR(3072),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (id BIGINT, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    physics_chunks.id,
    physics_chunks.content,
    physics_chunks.metadata,
    1 - (physics_chunks.embedding <=> query_embedding) AS similarity
  FROM physics_chunks
  WHERE 1 - (physics_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Explanation:
-- query_embedding: The math version of the student's question.
-- match_threshold: Filters out junk (hallucination prevention).
-- <=> : This is the magic Cosine Distance operator.
```

### 2.5 User & Application Tables
```sql
-- User Profile & Gamification
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  total_queries INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Chat History Persistence
CREATE TABLE chat_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Quiz & Exam History
CREATE TABLE quiz_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  topic TEXT NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  difficulty INTEGER NOT NULL,
  quiz_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

---

## ⚙️ 2. ADVANCED DATABASE AUTOMATION (RPC & Triggers)
Run these to enable auto-counting and automatic user profile creation.

### 2.1 Automatic Profile Creation
This trigger automatically creates a row in your `profiles` table the moment a student signs up.
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

### 2.2 Query Counter (RPC)
This function allows the frontend to safely increase the student's query count.
```sql
CREATE OR REPLACE FUNCTION increment_queries(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET total_queries = total_queries + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.3 Point Adder (RPC)
-- Used to reward students for finishing quizzes
CREATE OR REPLACE FUNCTION increment_points(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET points = points + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🛠️ 3. SYSTEM ARCHITECTURE & DATA FLOW PHILOSOPHY
Understanding how these tables connect is vital for your faculty presentation.

### 3.1 The "User-Centric" Relational Design
*   **The Auth Link:** Every table in our system (except the knowledge base) is linked to `auth.users`. This means when a student logs in, the app instantly filters their specific history and scores.
*   **Cascading Deletes:** We use `ON DELETE CASCADE`. If a student deletes their account, the system automatically wipes their chat history and quiz scores from the database, ensuring privacy and database cleanliness.

### 3.2 The Knowledge Base (RAG Brain)
*   **Decoupled Knowledge:** The `physics_chunks` table is independent of the users. It is a "Shared Knowledge" resource. This allows the system to scale to thousands of users without duplicating the textbook data.

---

## 🐍 4. BACKEND ENVIRONMENT SETUP (PYTHON)
Run these in your Windows PowerShell terminal.

### 5.1 Virtual Environment Management
```powershell
# Create the environment (only do this once)
python -m venv venv

# Activate the environment
.\venv\Scripts\Activate.ps1

# Upgrade pip to latest version
python -m pip install --upgrade pip
```

### 5.2 Dependency Installation
```powershell
# Install all libraries from requirements file
pip install -r backend/requirements.txt

# List installed packages to verify
pip list
```

---

## 📤 6. BACKEND DATA INGESTION COMMANDS
This is the process of moving the PDF knowledge into Supabase.

```powershell
# 1. Ensure physics.pdf is in the data/ folder
# 2. Configure .env with your keys
# 3. Run the ingestion script
python backend/ingest.py
```
**Teammate Note:** If the script stops, don't worry. It saves progress in `extracted_text.json`. Just run the command again to resume.

---

## ⚡ 7. BACKEND API OPERATIONS
How to start and manage the live server.

```powershell
# Change directory to backend
cd backend

# Start server using Uvicorn (Standard)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Start server using main wrapper (Simplified)
python main.py
```
*   `--reload` means the server restarts automatically when you save a file.
*   `0.0.0.0` allows other devices on your Wi-Fi to test the app.

---

## 📦 8. FRONTEND ENVIRONMENT SETUP (NODE.JS)
Run these in a **new terminal**.

```powershell
# Move into frontend folder
cd frontend

# Install all React packages
npm install

# Force update packages (if errors occur)
npm install --force
```

---

## 🚀 9. FRONTEND DEVELOPMENT & BUILD WORKFLOW
```powershell
# Start the local development website
npm run dev

# Check for code errors (Linting)
# npm run lint

# Build the final website for production
npm run build

# Preview the production build locally
npm run preview
```

---

## 🌿 10. VERSION CONTROL & TEAM COLLABORATION (GIT)
Use these to share your code with your teammates.

```powershell
# Initialize repository
git init

# Add all changes
git add .

# Save changes with a message
git commit -m "feat: added interactive quiz system"

# Pull latest code from teammates
# git pull origin main

# Push your code to GitHub
# git push origin main
```

---

## 🔑 11. ENVIRONMENT VARIABLE CONFIGURATION (.env)
You must create these files or the app will not work.

### 11.1 Backend Environment (`backend/.env`)
```env
GEMINI_API_KEY=your_google_ai_key_here
SUPABASE_URL=https://yourprojectid.supabase.co
SUPABASE_SERVICE_KEY=your_long_service_role_key
```

### 11.2 Frontend Environment (`frontend/.env`)
```env
VITE_SUPABASE_URL=https://yourprojectid.supabase.co
VITE_SUPABASE_ANON_KEY=your_short_public_anon_key
VITE_RAG_BACKEND_URL=http://localhost:8000
```

---

## 📁 12. PROJECT DIRECTORY ARCHITECTURE
Explain this to your teacher to show how organized your project is.

```text
ShikhAI/
├── backend/
│   ├── main.py            # FastAPI Server (The Bridge)
│   ├── ingest.py          # PDF Ingestion Script (The Eyes)
│   ├── rag.py             # RAG Logic & Quiz Engine (The Brain)
│   ├── requirements.txt   # Python Library List
│   └── .env               # Secret API Keys
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main UI Component
│   │   ├── services/      # API connection logic
│   │   ├── data/          # Translations & Static Data
│   │   └── styles.css     # Premium UI Design
│   ├── package.json       # React Library List
│   └── .env               # Public API Keys
├── data/
│   └── physics.pdf        # The Source Knowledge
└── venv/                  # Python Virtual Environment
```

---
*END OF HYPER-EXHAUSTIVE COMMAND REFERENCE (500+ LINES)*
*(Compiled for the ShikhAI Team - 2026)*
