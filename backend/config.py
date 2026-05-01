import os
from dotenv import load_dotenv

# Reads the .env file and loads all variables into the environment
load_dotenv()

# ── Pull each key out of the environment ──────────────────────
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY")
SUPABASE_URL     = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
