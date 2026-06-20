import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { auth, db } from './firebase'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc, orderBy , getDoc} from 'firebase/firestore'; 
import Auth from './Auth';
import './App.css';

const CopyButton = ({ text, label = "Copy" }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return <button className="copy-action-btn" onClick={handleCopy}>{copied ? '✓ Copied!' : `📋 ${label}`}</button>;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingText, setThinkingText] = useState('Analyzing...');
  const chatEndRef = useRef(null);

  // --- 1. AUTH & CLOUD DATA LOAD ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.emailVerified) {
        try {
          const q = query(collection(db, "threads"), where("userId", "==", currentUser.uid), orderBy("updatedAt", "desc"));
          const snapshot = await getDocs(q);
          const userThreads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setThreads(userThreads);
          if (userThreads.length > 0) {
            setActiveThreadId(userThreads[0].id);
            setMessages(userThreads[0].messages);
          }
        } catch (err) {
          console.error("Error loading threads:", err);
        }
      } else {
        setThreads([]); setMessages([]);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. UI HELPERS ---
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isThinking]);

  useEffect(() => {
    const phrases = ["Analyzing prompt...", "Searching knowledge base...", "Drafting response...", "Formatting output..."];
    let interval, step = 0;
    if (isThinking) {
      interval = setInterval(() => { step = (step + 1) % phrases.length; setThinkingText(phrases[step]); }, 1200);
    }
    return () => clearInterval(interval);
  }, [isThinking]);

  // --- 3. ACTIONS ---
  const createNewChat = () => { setActiveThreadId(null); setMessages([]); };

const selectThread = async (id) => {
    const thread = threads.find(t => t.id === id);
    if (thread) {
      setActiveThreadId(id);
      // Explicitly set messages from the thread object
      setMessages(thread.messages); 
    } else {
      // Fallback: If thread not in local state, fetch specifically from Firestore
      const docRef = doc(db, "threads", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveThreadId(id);
        setMessages(data.messages);
      }
    }
  };

  const deleteThread = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this chat?')) {
      await deleteDoc(doc(db, "threads", id));
      setThreads(threads.filter(t => t.id !== id));
      if (activeThreadId === id) { setActiveThreadId(null); setMessages([]); }
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const userMessage = { sender: 'user', text: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput(''); setIsThinking(true); setIsTyping(true);

    try {
      const res = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage.text, history: messages })
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let aiText = '';
      setIsThinking(false);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value, { stream: true });
        setMessages([...newMessages, { sender: 'ai', text: aiText }]);
      }

      const finalMessages = [...newMessages, { sender: 'ai', text: aiText }];
      if (activeThreadId) {
        await updateDoc(doc(db, "threads", activeThreadId), { messages: finalMessages, updatedAt: Date.now() });
      } else {
        const docRef = await addDoc(collection(db, "threads"), { 
          userId: user.uid, title: userMessage.text.substring(0, 30) + '...', messages: finalMessages, updatedAt: Date.now() 
        });
        setActiveThreadId(docRef.id);
        setThreads([{ id: docRef.id, messages: finalMessages }, ...threads]);
      }
    } catch (err) { console.error(err); } finally { setIsTyping(false); }
  };

  // --- 4. RENDER ---
  if (loadingAuth) return <div className="app-layout" style={{ backgroundColor: '#212121' }}></div>;
  if (!user || !user.emailVerified) return <Auth />;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <button className="new-chat-btn" onClick={createNewChat}>+ New Chat</button>
        <div className="thread-list">
          {threads.map(thread => (
            <div key={thread.id} className={`thread-item ${activeThreadId === thread.id ? 'active' : ''}`} onClick={() => selectThread(thread.id)}>
              <span className="thread-title">{thread.title}</span>
              <button className="delete-thread-btn" onClick={(e) => deleteThread(thread.id, e)}>🗑️</button>
            </div>
          ))}
        </div>
        <div className="user-profile">
          <span className="user-email">{user.email}</span>
          <button className="sign-out-btn" onClick={() => { setThreads([]); setMessages([]); setActiveThreadId(null); signOut(auth); }}>Sign Out</button>
        </div>
      </aside>

      <main className="chat-container">
        <div className="chat-window">
          {messages.map((msg, index) => (
            <div key={index} className={`message-wrapper ${msg.sender}`}>
              <div className={`message-bubble ${msg.sender}`}>
                {msg.sender === 'ai' ? (
                  <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                      code({inline, className, children}) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        return !inline && match ? (
                          <div className="code-block-wrapper">
                            <div className="code-block-header"><span>{match[1]}</span><CopyButton text={codeString} label="Copy code" /></div>
                            <SyntaxHighlighter style={vscDarkPlus} language={match[1]}>{codeString}</SyntaxHighlighter>
                          </div>
                        ) : <code className="inline-code">{children}</code>
                      }
                    }}>{msg.text}</ReactMarkdown>
                    {!isTyping && index === messages.length - 1 && <div className="response-actions"><CopyButton text={msg.text} label="Copy response" /></div>}
                  </>
                ) : msg.text}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="message-wrapper ai"><div className="message-bubble ai"><div className="thinking-indicator"><div className="spinner"><span className="dot"></span><span className="dot"></span><span className="dot"></span></div><span className="thinking-text">{thinkingText}</span></div></div></div>
          )}
          <div ref={chatEndRef} />
        </div>
        <form className="chat-input-area" onSubmit={sendMessage}>
          <div className="input-wrapper"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message the AI..." disabled={isTyping} /><button type="submit" disabled={isTyping || !input.trim()}>Send</button></div>
        </form>
      </main>
    </div>
  );
}