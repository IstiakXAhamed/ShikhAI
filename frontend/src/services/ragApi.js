const DEFAULT_ENDPOINT = '/api/chat';

export async function sendMessageToRag(message, context = {}) {
  const baseUrl = import.meta.env.VITE_RAG_BACKEND_URL;
  const endpoint = import.meta.env.VITE_RAG_CHAT_ENDPOINT || DEFAULT_ENDPOINT;

  if (!baseUrl) {
    return {
      answer:
        context.language === 'bn'
          ? 'ডেমো মোড: এখানে পরে RAG backend যুক্ত হবে। এখন আপনার প্রশ্নটি স্থানীয়ভাবে দেখানো হচ্ছে।'
          : 'Demo mode: the RAG backend can be connected here later. For now, your question is handled locally.',
      sources: [],
      demo: true,
    };
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(context.accessToken ? { Authorization: `Bearer ${context.accessToken}` } : {}),
    },
    body: JSON.stringify({
      message,
      language: context.language || 'en',
      user_id: context.userId || null,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown backend error');
    throw new Error(errorText || `Backend returned ${response.status}`);
  }

  return response.json();
}
export async function generateQuizFromRag(topic, options = {}) {
  const baseUrl = import.meta.env.VITE_RAG_BACKEND_URL;
  const endpoint = '/api/quiz';

  if (!baseUrl) {
    return [
      {
        question: 'Demo Quiz: Physics Chapter 1',
        options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        correct_index: 0,
        explanation: 'This is a demo explanation.',
        source_page: '1',
      },
    ];
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: JSON.stringify({
      topic,
      difficulty: options.difficulty || 3,
      count: options.count || 5,
      language: options.language || 'en',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown backend error');
    throw new Error(errorText || `Backend returned ${response.status}`);
  }

  return response.json();
}
