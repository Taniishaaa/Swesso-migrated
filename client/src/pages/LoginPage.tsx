import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./css/AuthPages.css";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await login(email, password);
    setLoading(false);

    if (error) {
      setError(error);
      return;
    }

    navigate("/projects");
  };

  return (
    <>
      <Navbar />

      <div className="auth-page">
        <div className="auth-container">
          <h1 className="brand-title">Swesso</h1>
          <h2 className="login-heading">Login</h2>

          {error && <div className="auth-error">{error}</div>}

          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <p className="signup-text">
              Don&apos;t have an account? <Link to="/register">Sign Up</Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
