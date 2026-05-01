import { useEffect, useMemo, useState, useRef } from 'react';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient.js';
import { sendMessageToRag, generateQuizFromRag } from './services/ragApi.js';
import { translations } from './data/translations.js';

const ROUTES = ['/login', '/signup', '/reset', '/dashboard', '/chat', '/quiz', '/settings'];

function getInitialRoute() {
  const pathname = window.location.pathname;
  if (ROUTES.includes(pathname)) return pathname;
  return '/login';
}

function getStoredLanguage() {
  return localStorage.getItem('shikh-ai-language') || 'en';
}

function getLogo(language, size) {
  if (size === 'small') return language === 'bn' ? '/assets/smallLogoB.png' : '/assets/smallLogoE.png';
  return language === 'bn' ? '/assets/largeLogoB.png' : '/assets/largeLogoE.png';
}

function MarkdownText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');

  const parseInline = (line) => {
    const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
      return part;
    });
  };

  return (
    <div className="markdown-body">
      {lines.map((line, idx) => {
        let content = line.trim();
        if (!content) return <div key={idx} style={{ height: '8px' }} />;
        
        // Headers
        if (content.startsWith('### ')) return <h3 key={idx} style={{ marginTop: '16px', marginBottom: '8px' }}>{parseInline(content.replace('### ', ''))}</h3>;
        if (content.startsWith('## ')) return <h2 key={idx} style={{ marginTop: '20px', marginBottom: '10px' }}>{parseInline(content.replace('## ', ''))}</h2>;
        
        // Lists
        if (content.startsWith('* ')) {
          return <li key={idx} style={{ marginLeft: '20px', listStyleType: 'disc', marginBottom: '4px' }}>{parseInline(content.replace('* ', ''))}</li>;
        }

        return <p key={idx} style={{ marginBottom: '8px' }}>{parseInline(content)}</p>;
      })}
    </div>
  );
}


function getDemoUser(language) {
  const t = translations[language];
  return {
    id: 'demo-user',
    email: localStorage.getItem('shikh-ai-demo-email') || t.localUserEmail,
    user_metadata: {
      full_name: language === 'bn' ? translations.bn.profileName : translations.en.profileName,
      language,
    },
    isDemo: true,
  };
}

export default function App() {
  const [route, setRoute] = useState(getInitialRoute);
  const [language, setLanguageState] = useState(getStoredLanguage);
  const [user, setUser] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [notice, setNotice] = useState('');
  const t = translations[language];

  const navigate = (nextRoute) => {
    window.history.pushState({}, '', nextRoute);
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setLanguage = (nextLanguage) => {
    localStorage.setItem('shikh-ai-language', nextLanguage);
    setLanguageState(nextLanguage);
  };

  useEffect(() => {
    const onPopState = () => setRoute(getInitialRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let unsubscribe;

    async function loadSession() {
      if (!isSupabaseConfigured) {
        const demoLoggedIn = localStorage.getItem('shikh-ai-demo-auth') === 'true';
        setUser(demoLoggedIn ? getDemoUser(language) : null);
        setLoadingSession(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
      setLoadingSession(false);

      const listener = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user || null);
      });
      unsubscribe = listener.data.subscription.unsubscribe;
    }

    loadSession();
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'bn' ? 'bn' : 'en';
  }, [language]);

  const authStatus = isSupabaseConfigured ? t.authReady : t.demoMode;
  const currentUser = user || (isSupabaseConfigured ? null : null);

  const authActions = useMemo(
    () => ({
      async signIn({ email, password }) {
        if (!email || !password) throw new Error(t.fillEmailPassword);

        if (!isSupabaseConfigured) {
          localStorage.setItem('shikh-ai-demo-auth', 'true');
          localStorage.setItem('shikh-ai-demo-email', email);
          const demoUser = getDemoUser(language);
          demoUser.email = email;
          setUser(demoUser);
          setNotice(t.loggedIn);
          navigate('/dashboard');
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setNotice(t.loggedIn);
        navigate('/dashboard');
      },
      async signUp({ email, password, fullName }) {
        if (!email || !password) throw new Error(t.fillEmailPassword);

        if (!isSupabaseConfigured) {
          localStorage.setItem('shikh-ai-demo-auth', 'true');
          localStorage.setItem('shikh-ai-demo-email', email);
          localStorage.setItem('shikh-ai-demo-name', fullName || 'Student');
          const demoUser = getDemoUser(language);
          demoUser.email = email;
          demoUser.user_metadata.full_name = fullName || t.profileName;
          setUser(demoUser);
          setNotice(t.accountCreated);
          navigate('/dashboard');
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || 'Student',
              language,
            },
          },
        });
        if (error) throw error;
        setNotice(t.accountCreated);
        navigate(data.session ? '/dashboard' : '/login');
      },
      async resetPassword({ email, newPassword }) {
        if (!email) throw new Error(t.fillEmail);

        if (!isSupabaseConfigured) {
          setNotice(t.resetSent);
          navigate('/login');
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data.session && newPassword) {
          if (newPassword.length < 6) throw new Error(t.fillNewPassword);
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          setNotice(t.passwordUpdated);
          navigate('/settings');
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset`,
        });
        if (error) throw error;
        setNotice(t.resetSent);
        navigate('/login');
      },
      async signOut() {
        if (isSupabaseConfigured) await supabase.auth.signOut();
        localStorage.removeItem('shikh-ai-demo-auth');
        setUser(null);
        setNotice(t.loggedOut);
        navigate('/login');
      },
    }),
    [language, t]
  );

  if (loadingSession) {
    return (
      <main className="app-shell centered-shell">
        <div className="loading-card">Shikh-AI</div>
      </main>
    );
  }

  const sharedProps = {
    t,
    language,
    setLanguage,
    navigate,
    notice,
    setNotice,
    authStatus,
    authActions,
    user: currentUser,
  };

  if (route === '/signup') return <AuthPage mode="signup" {...sharedProps} />;
  if (route === '/reset') return <ResetPage {...sharedProps} />;
  if (route === '/dashboard') return <DashboardPage {...sharedProps} user={user || getDemoUser(language)} />;
  if (route === '/chat') return <ChatPage {...sharedProps} user={user || getDemoUser(language)} />;
  if (route === '/quiz') return <QuizPage {...sharedProps} user={user || getDemoUser(language)} />;
  if (route === '/settings') return <SettingsPage {...sharedProps} user={user || getDemoUser(language)} />;
  return <AuthPage mode="login" {...sharedProps} />;
}

function StatusMessage({ notice, setNotice, authStatus }) {
  return (
    <div className="status-stack">
      {notice ? (
        <button className="status success" type="button" onClick={() => setNotice('')}>
          {notice}
        </button>
      ) : null}
      <div className="status neutral">{authStatus}</div>
    </div>
  );
}

function LanguageSwitch({ language, setLanguage, t }) {
  return (
    <div className="language-switch" aria-label="Language switcher">
      <button
        type="button"
        className={language === 'bn' ? 'active' : ''}
        onClick={() => setLanguage('bn')}
      >
        {language === 'bn' ? 'বাংলা' : 'Bangla'}
      </button>
      <button
        type="button"
        className={language === 'en' ? 'active' : ''}
        onClick={() => setLanguage('en')}
      >
        {language === 'bn' ? 'ইংরেজি' : 'English'}
      </button>
    </div>
  );
}

function AuthTabs({ mode, navigate, t }) {
  return (
    <div className="auth-tabs">
      <button className={mode === 'login' ? 'active' : ''} onClick={() => navigate('/login')} type="button">
        {t.signIn}
      </button>
      <button className={mode === 'signup' ? 'active' : ''} onClick={() => navigate('/signup')} type="button">
        {t.signUp}
      </button>
    </div>
  );
}

function AuthPage({ mode, t, language, setLanguage, navigate, notice, setNotice, authStatus, authActions }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') {
        await authActions.signUp({ email, password, fullName });
      } else {
        await authActions.signIn({ email, password });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="brand-block auth-brand">
        <img src={getLogo(language, 'small')} alt={t.logoAlt} className="small-logo" />
      </section>

      <form className="auth-card" onSubmit={handleSubmit}>
        <AuthTabs mode={mode} navigate={navigate} t={t} />
        {mode === 'signup' ? (
          <label className="input-row">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.namePlaceholder} />
            <UserIcon />
          </label>
        ) : null}
        <label className="input-row">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPlaceholder} />
          <MailIcon />
        </label>
        <label className="input-row">
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.passwordPlaceholder} />
          <button type="button" className="icon-toggle" onClick={() => setShowPassword(!showPassword)}>
            <EyeIcon />
          </button>
        </label>
        <div className="auth-options">
          <label className="check-row">
            <input type="checkbox" />
            <span>{t.rememberMe}</span>
          </label>
          {mode === 'login' ? (
            <button type="button" className="link-button" onClick={() => navigate('/reset')}>
              {t.forgotPassword}
            </button>
          ) : null}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? '...' : mode === 'signup' ? t.createAccount : t.login}
        </button>
      </form>

      <LanguageSwitch language={language} setLanguage={setLanguage} t={t} />
      <StatusMessage notice={notice} setNotice={setNotice} authStatus={authStatus} />
    </main>
  );
}

function ResetPage({ t, language, setLanguage, navigate, notice, setNotice, authStatus, authActions }) {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authActions.resetPassword({ email, newPassword });
    } catch (err) {
      setError(err.message || 'Reset failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="brand-block auth-brand">
        <img src={getLogo(language, 'small')} alt={t.logoAlt} className="small-logo" />
      </section>
      <form className="auth-card reset-card" onSubmit={handleSubmit}>
        <h1>{t.resetPassword}</h1>
        <p className="muted-text">{t.resetHint}</p>
        <label className="input-row">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPlaceholder} />
          <MailIcon />
        </label>
        <label className="input-row">
          <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t.newPasswordPlaceholder} />
          <button type="button" className="icon-toggle" onClick={() => setShowPassword(!showPassword)}>
            <EyeIcon />
          </button>
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? '...' : t.resetPassword}
        </button>
        <button type="button" className="link-button center-link" onClick={() => navigate('/login')}>
          {t.signIn}
        </button>
      </form>
      <LanguageSwitch language={language} setLanguage={setLanguage} t={t} />
      <StatusMessage notice={notice} setNotice={setNotice} authStatus={authStatus} />
    </main>
  );
}

function AppLayout({ children, active, t, language, navigate, authActions }) {
  const navItems = [
    { key: 'dashboard', label: t.dashboard, route: '/dashboard', icon: <DashboardIcon /> },
    { key: 'chat', label: t.aiChat, route: '/chat', icon: <ChatIcon /> },
    { key: 'quiz', label: t.quiz, route: '/quiz', icon: <QuizIcon /> },
    { key: 'settings', label: t.settings, route: '/settings', icon: <SettingsIcon /> },
  ];

  return (
    <main className="app-frame">
      <aside className="sidebar">
        <button type="button" className="logo-button" onClick={() => navigate('/dashboard')}>
          <img src={getLogo(language, 'large')} alt={t.logoAlt} className="large-logo" />
        </button>
        <nav className="side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={active === item.key ? 'active' : ''}
              onClick={() => navigate(item.route)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button type="button" className="logout-button" onClick={() => authActions.signOut()}>
          <LogoutIcon />
          <span>{t.logout}</span>
        </button>
      </aside>
      <section className="content-area">{children}</section>
    </main>
  );
}

function TopBar({ t, user, language }) {
  const name = user?.user_metadata?.full_name || t.profileName;
  const [time, setTime] = useState(new Date().toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' }));
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, [language]);

  const today = new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).format(new Date());

  return (
    <header className="topbar">
      <div>
        <div className="time-line">{time}</div>
        <div className="date-line">{today}</div>
      </div>
      <div className="profile-pill">
        <Avatar initials={t.profileInitials} />
        <div>
          <strong>{name}</strong>
          <span>{t.sscBatch}</span>
        </div>
      </div>
    </header>
  );
}

function DashboardPage(props) {
  const { t, user, language, navigate, authActions } = props;
  const [stats, setStats] = useState({ queries: 0, points: 0, lastQuery: t?.lastQueryText || '...' });

  useEffect(() => {
    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      fetchStats();
    }
  }, [user]);

  if (!t) return null;

  async function fetchStats() {
    if (!user?.id) return;
    try {
      const { data: pData, error: pError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      if (pError && pError.code === 'PGRST116' && user.id !== 'demo-user') {
        await supabase.from('profiles').insert([{ id: user.id, full_name: user.user_metadata?.full_name || 'Student' }]);
      } else if (pData) {
        setStats(prev => ({ ...prev, queries: pData.total_queries, points: pData.points }));
      }

      const { data: cData } = await supabase.from('chat_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
      if (cData && cData[0]) setStats(prev => ({ ...prev, lastQuery: cData[0].message }));
    } catch (err) { console.error(err); }
  }

  const todayDate = new Date().getDate();
  const monthName = new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-US', { month: 'long' }).format(new Date());

  return (
    <AppLayout active="dashboard" t={t} language={language} navigate={navigate} authActions={authActions}>
      <TopBar t={t} user={user} language={language} />
      <section className="dashboard-grid">
        <div className="welcome-card">
          <p className="eyebrow">{t.studentProgress}</p>
          <h1>{t.welcome}, {(user?.user_metadata?.full_name || t.profileName).split(' ')[0]}</h1>
          <div className="search-row">
            <input placeholder={t.search} />
            <button type="button">{t.filter}</button>
          </div>
        </div>
        <div className="month-card">
          <p>{monthName} {new Date().getFullYear()}</p>
          <div className="calendar-strip">
            {[-2, -1, 0, 1, 2].map((offset) => {
              const d = new Date();
              d.setDate(todayDate + offset);
              const dateNum = d.getDate();
              return (
                <span key={offset} className={offset === 0 ? 'active' : ''}>
                  {language === 'bn' ? toBanglaNumber(dateNum) : dateNum}
                </span>
              );
            })}
          </div>
        </div>
        <ProgressCard t={t} queries={stats.queries} points={stats.points} />
        <div className="info-card">
          <p className="eyebrow">{t.lastAskedQuery}</p>
          <h2>{stats.lastQuery.length > 40 ? stats.lastQuery.substring(0, 40) + '...' : stats.lastQuery}</h2>
          <button type="button" className="outline-button" onClick={() => navigate('/chat')}>{t.goToChatbox}</button>
        </div>
        <MiniChat t={t} navigate={navigate} />
      </section>
    </AppLayout>
  );
}

function ProgressCard({ t, queries, points }) {
  const goal = 10; 
  const percent = Math.min(Math.round((queries / goal) * 100), 100);
  
  return (
    <div className="progress-card">
      <p className="eyebrow">{t.todaysProgress}</p>
      <div className="progress-ring" style={{'--percent': `${percent}%`}} aria-label={`${percent} percent progress`}>{percent}%</div>
      <div className="progress-items">
        <div>
          <span>{t.totalQueries}</span>
          <strong>{queries}</strong>
        </div>
        <div>
          <span>{t.pointsEarned}</span>
          <strong>{points} XP</strong>
        </div>
      </div>
    </div>
  );
}

function MiniChat({ t, navigate }) {
  return (
    <div className="mini-chat-card">
      <div className="chat-heading">
        <Avatar initials="AI" variant="ai" />
        <div>
          <p className="eyebrow">{t.aiTutor}</p>
          <strong>{t.aiChat}</strong>
        </div>
      </div>
      <p>{t.chatIntro}</p>
      <button type="button" className="fake-input" onClick={() => navigate('/chat')}>{t.askTutor}</button>
    </div>
  );
}

function ChatPage(props) {
  const { t, language, user, navigate, authActions } = props;
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ queries: 0, points: 0, topPages: [] });
  const [quizResults, setQuizResults] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      fetchChatData();
      fetchDashboardStats();
    }
  }, [user]);

  if (!t) return null;

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Auto-render Math
    if (window.renderMathInElement) {
      window.renderMathInElement(document.body, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false}
        ],
        throwOnError: false
      });
    }
  }, [messages, busy]);

  async function fetchChatData() {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      
      if (data) {
        const formatted = data.map(row => ([
          { role: 'user', text: row.message },
          { role: 'assistant', text: row.response, sources: row.sources || [] }
        ])).flat();
        setMessages(formatted.length > 0 ? formatted : [{ role: 'assistant', text: t.chatIntro, sources: [] }]);
        
        // Populate left history sidebar with unique session starts
        const uniqueStarts = data.slice(-10).reverse();
        setHistory(uniqueStarts);
      }
    } catch (err) { console.error(err); }
  }

  async function fetchDashboardStats() {
    if (!user?.id) return;
    try {
      // Fetch Quiz Results for Right Sidebar
      const { data: qData } = await supabase
        .from('quiz_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (qData) setQuizResults(qData);

      // Fetch Profile Stats
      const { data: pData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (pData) setStats(prev => ({ ...prev, queries: pData.total_queries, points: pData.points }));
    } catch (err) { console.error(err); }
  }

  async function handleSend(event) {
    event.preventDefault();
    const clean = input.trim();
    if (!clean) return;

    const userMsg = { role: 'user', text: clean };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);
    setError('');

    try {
      let accessToken = null;
      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token || null;
      }

      const result = await sendMessageToRag(clean, {
        language,
        userId: user?.id,
        accessToken,
      });

      const aiText = result.answer || result.response || t.sampleAnswer;
      const aiSources = result.sources || [];
      const aiMsg = { role: 'assistant', text: aiText, sources: aiSources };

      setMessages((prev) => [...prev, aiMsg]);

      // Persist to Supabase
      if (isSupabaseConfigured && user) {
        await supabase.from('chat_history').insert([{
          user_id: user.id,
          message: clean,
          response: aiText,
          sources: aiSources
        }]);
        
        // Update query count in profile
        await supabase.rpc('increment_queries', { user_id: user.id });
        fetchDashboardStats();
      }
    } catch (err) {
      setError(t.backendError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout active="chat" t={t} language={language} navigate={navigate} authActions={authActions}>
      <section className="chat-layout-3col">
        {/* LEFT PANEL: Chat History */}
        <aside className="chat-panel-left">
          <div className="panel-header-row">
            <h3>{t.history}</h3>
            <button type="button" className="new-chat-btn" onClick={() => setMessages([{ role: 'assistant', text: t.chatIntro, sources: [] }])}>
              + {t.newChat || 'New Chat'}
            </button>
          </div>
          <div className="history-list">
            {history.length > 0 ? history.map((item) => (
              <button key={item.id} className="history-item" onClick={() => setMessages([
                { role: 'user', text: item.message },
                { role: 'assistant', text: item.response, sources: item.sources || [] }
              ])}>
                <ChatIcon />
                <span>{item.message.substring(0, 24)}...</span>
              </button>
            )) : <p className="muted-text">{t.noHistory}</p>}
          </div>
        </aside>

        {/* MIDDLE PANEL: Chat Main */}
        <div className="chat-main-area">
          <div className="page-title-row">
            <h1>{t.aiChat}</h1>
            <span>{t.today}</span>
          </div>
          <div className="chat-window" ref={scrollRef}>
            {messages.map((message, index) => (
              <div className={`message-row ${message.role}`} key={`${message.role}-${index}`}>
                {message.role === 'assistant' ? <Avatar initials="AI" variant="ai" /> : null}
                <div className="message-bubble">
                  <MarkdownText text={message.text} />
                  {message.sources?.length ? (
                    <div className="source-list">
                      {message.sources.map((source) => <span key={source}>{source}</span>)}
                    </div>
                  ) : null}
                </div>
                {message.role === 'user' ? <Avatar initials={t.profileInitials} /> : null}
              </div>
            ))}
            {busy ? <div className="typing">AI is thinking...</div> : null}
          </div>
          {error ? <p className="form-error chat-error">{error}</p> : null}
          <form className="chat-input-row" onSubmit={handleSend}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.askTutor} />
            <button className="primary-button send-button" type="submit" disabled={busy}>↗</button>
          </form>
        </div>

        {/* RIGHT PANEL: Stats & Progress */}
        <aside className="chat-panel-right">
          <div className="stat-card-mini">
            <p className="eyebrow">{t.totalQueries}</p>
            <strong>{stats.queries}</strong>
          </div>
          <div className="stat-card-mini">
            <p className="eyebrow">{t.pointsEarned}</p>
            <strong>{stats.points} XP</strong>
          </div>
          
          <div className="right-section-block">
            <h4>{t.recentQuizzes}</h4>
            <div className="mini-quiz-list">
              {quizResults.length > 0 ? quizResults.map(q => (
                <div key={q.id} className="mini-quiz-item">
                  <span>{q.topic}</span>
                  <strong>{q.score}/{q.total_questions}</strong>
                </div>
              )) : <p className="muted-text">No quiz data yet</p>}
            </div>
          </div>

          <div className="right-section-block">
            <h4>{t.topQueries}</h4>
            <div className="tag-cloud">
              <span className="tag">Gravity</span>
              <span className="tag">Motion</span>
              <span className="tag">Newton</span>
            </div>
          </div>
        </aside>
      </section>
    </AppLayout>
  );
}

function QuizPage(props) {
  const { t, language, user, navigate, authActions } = props;
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [count, setCount] = useState(5);
  const [quizLang, setQuizLang] = useState(language);
  const [quizData, setQuizData] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!t) return null;

  async function handleGenerate(event) {
    event.preventDefault();
    if (!topic.trim()) return;
    setBusy(true);
    setError('');
    setQuizData(null);
    setUserAnswers({});
    setSubmitted(false);
    try {
      let accessToken = null;
      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token || null;
      }
      const data = await generateQuizFromRag(topic, {
        language: quizLang,
        difficulty,
        count,
        accessToken,
      });
      setQuizData(data);
    } catch (err) {
      setError(t.backendError);
    } finally {
      setBusy(false);
    }
  }

  function handleSelectOption(qIndex, oIndex) {
    if (submitted) return;
    setUserAnswers((prev) => ({ ...prev, [qIndex]: oIndex }));
  }

  async function handleSubmit() {
    setSubmitted(true);
    const correctCount = quizData.reduce((acc, q, i) => acc + (userAnswers[i] === q.correct_index ? 1 : 0), 0);
    
    // Persist result to Supabase
    if (isSupabaseConfigured && user && user.id !== 'demo-user') {
      try {
        await supabase.from('quiz_history').insert([{
          user_id: user.id,
          topic,
          difficulty,
          score: correctCount,
          total_questions: quizData.length,
          quiz_data: quizData
        }]);
        
        // Add points for completing a quiz
        await supabase.rpc('increment_points', { user_id: user.id, amount: correctCount * 10 });
      } catch (err) { console.error('Failed to save quiz results:', err); }
    }
  }

  const score = quizData?.reduce((acc, q, i) => acc + (Number(userAnswers[i]) === Number(q.correct_index) ? 1 : 0), 0) || 0;

  return (
    <AppLayout active="quiz" t={t} language={language} navigate={navigate} authActions={authActions}>
      <section className="quiz-page">
        <div className="page-title-row">
          <h1>{t.quiz}</h1>
        </div>

        {!quizData ? (
          <form className="quiz-setup-card" onSubmit={handleGenerate}>
            <h2>{t.generateQuiz}</h2>
            <label className="field">
              <span>{t.selectTopic}</span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Newton's Laws" required />
            </label>
            <div className="row">
              <label className="field">
                <span>{t.difficulty} (1-5)</span>
                <input type="number" min="1" max="5" value={difficulty} onChange={(e) => setDifficulty(parseInt(e.target.value))} />
              </label>
              <label className="field">
                <span>{t.questionCount} (Max 50)</span>
                <input type="number" min="1" max="50" value={count} onChange={(e) => setCount(parseInt(e.target.value))} />
              </label>
            </div>
            <label className="field">
              <span>{t.language}</span>
              <select value={quizLang} onChange={(e) => setQuizLang(e.target.value)} className="quiz-select">
                <option value="bn">বাংলা (Bengali)</option>
                <option value="en">English</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? '...' : t.startQuiz}
            </button>
            {error ? <p className="form-error">{error}</p> : null}
          </form>
        ) : (
          <div className="quiz-container">
            <div className="quiz-header">
              <h2>{topic}</h2>
              {submitted ? <div className="score-pill">{t.score}: {score} / {quizData.length}</div> : null}
            </div>

            <div className="questions-list">
              {quizData.map((q, qIndex) => (
                <div className={`question-card ${submitted ? (Number(userAnswers[qIndex]) === Number(q.correct_index) ? 'correct' : 'incorrect') : ''}`} key={qIndex}>
                  <h3>{qIndex + 1}. <MarkdownText text={q.question} /></h3>
                  <div className="options-grid">
                    {q.options.map((opt, oIndex) => (
                      <button
                        key={oIndex}
                        type="button"
                        className={`option-button ${Number(userAnswers[qIndex]) === oIndex ? 'selected' : ''} ${submitted && Number(q.correct_index) === oIndex ? 'actual-correct' : ''}`}
                        onClick={() => handleSelectOption(qIndex, oIndex)}
                        disabled={submitted}
                      >
                        <MarkdownText text={opt} />
                      </button>
                    ))}
                  </div>
                  {submitted ? (
                    <div className="quiz-explanation">
                      <p><strong>{t.explanation}:</strong> <MarkdownText text={q.explanation || 'See textbook for details.'} /></p>
                      <span className="source-tag">{t.sourcePage}: {q.source_page || 'Physics Textbook'}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {!submitted ? (
              <button className="primary-button" onClick={handleSubmit}>{t.submitQuiz}</button>
            ) : (
              <button className="outline-button" onClick={() => setQuizData(null)}>{t.generateQuiz}</button>
            )}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function SettingsPage(props) {
  const { t, language, setLanguage, user, navigate, authActions, notice, setNotice, authStatus } = props;
  const name = user?.user_metadata?.full_name || t?.profileName || 'Student';
  const email = user?.email || t?.localUserEmail || 'student@shikhai.com';

  if (!t) return null;

  return (
    <AppLayout active="settings" t={t} language={language} navigate={navigate} authActions={authActions}>
      <section className="settings-page">
        <h1>{t.settings}</h1>
        <div className="settings-grid">
          <div className="settings-card basic-card">
            <h2>{t.basicInfo}</h2>
            <div className="profile-large">
              <Avatar initials={t.profileInitials} />
              <div>
                <h3>{name}</h3>
                <p>{t.sscBatch}</p>
                <span>{email}</span>
              </div>
            </div>
            <button type="button" className="outline-button" onClick={() => navigate('/reset')}>{t.resetPassword}</button>
          </div>
          <div className="settings-card">
            <h2>{t.language}</h2>
            <LanguageSwitch language={language} setLanguage={setLanguage} t={t} />
          </div>
        </div>
        <StatusMessage notice={notice} setNotice={setNotice} authStatus={authStatus} />
      </section>
    </AppLayout>
  );
}

function Avatar({ initials, variant = 'user' }) {
  return <div className={`avatar ${variant}`}>{initials}</div>;
}

function toBanglaNumber(value) {
  const map = { 0: '০', 1: '১', 2: '২', 3: '৩', 4: '৪', 5: '৫', 6: '৬', 7: '৭', 8: '৮', 9: '৯' };
  return String(value).replace(/[0-9]/g, (digit) => map[digit]);
}

function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>;
}
function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.2-6 8-6s6.5 2 8 6"/></svg>;
}
function DashboardIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>;
}
function ChatIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z"/></svg>;
}
function QuizIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1 14.5l-3.5-3.5 1.41-1.41L11 13.67l4.59-4.59L17 10.5 11 16.5z"/></svg>;
}
function SettingsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V20h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1-2-2 .1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V4h4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2v4h-.2a1.7 1.7 0 0 0-1.5 1Z"/></svg>;
}
function LogoutIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6H5v12h5"/><path d="M14 8l4 4-4 4"/><path d="M8 12h10"/></svg>;
}
