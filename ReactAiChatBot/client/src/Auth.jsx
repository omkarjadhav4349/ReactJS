import { useState } from 'react';
import { auth, googleProvider } from './firebase';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendEmailVerification // NEW: Import the verification tool
} from 'firebase/auth';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // NEW: State to show the "Check your email" message
  const [verificationSent, setVerificationSent] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email.includes('@')) return setError("Please enter a valid email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters long.");
    if (!isLogin && password !== confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    try {
      if (isLogin) {
        // Logging in
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // NEW: Check if they actually clicked the link before letting them in!
        if (!userCredential.user.emailVerified) {
          setError("Please verify your email before logging in. Check your inbox!");
          // We sign them back out immediately so the app doesn't load
          await auth.signOut(); 
        }
      } else {
        // Signing up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // NEW: Send the secure verification email!
        await sendEmailVerification(userCredential.user);
        
        // Show success screen and sign them out so they must verify first
        setVerificationSent(true);
        await auth.signOut();
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  // NEW: The screen they see right after creating an account
  if (verificationSent) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h2>✉️ Check Your Inbox!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            We just sent a secure verification link to <strong>{email}</strong>. 
            Please click the link in that email to activate your account.
          </p>
          <button 
            className="submit-btn" 
            onClick={() => {
              setVerificationSent(false);
              setIsLogin(true); // Take them back to login screen
              setEmail('');
              setPassword('');
              setConfirmPassword('');
            }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>{isLogin ? 'Welcome Back' : 'Create an Account'}</h2>
        
        {error && <div className="auth-error">{error}</div>}

        <button className="google-btn" onClick={handleGoogleSignIn}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
          Sign {isLogin ? 'in' : 'up'} with Google
        </button>

        <div className="divider"><span>OR</span></div>

        <form onSubmit={handleSubmit} className="auth-form">
          <input 
            type="email" 
            placeholder="Email address" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
          
          {!isLogin && (
            <input 
              type="password" 
              placeholder="Confirm Password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
            />
          )}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <p className="auth-toggle">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setIsLogin(!isLogin); setError(''); }}>
            {isLogin ? 'Sign up' : 'Sign in'}
          </span>
        </p>
      </div>
    </div>
  );
}