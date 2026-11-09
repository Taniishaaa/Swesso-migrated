// src/components/Navbar.tsx
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import swessoLogo from "../assets/swesso.jpeg";
import "./css/Navbar.css";
import { useAuth } from "../context/AuthContext";

const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const scrollToTopOnHome = () => {
    if (location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/");
    }
    setMobileOpen(false);
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    scrollToTopOnHome();
  };

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    e.preventDefault();

    if (location.pathname === "/") {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      navigate(`/#${id}`);
    }

    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setProfileOpen(false);
    setMobileOpen(false);
    navigate("/login");
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "U";

  return (
    <header className="navbar">
      {/* Logo */}
     {/* Logo */}
<a href="/" onClick={handleLogoClick} className="logo">
  <div className="logo-box">
    <img src={swessoLogo} alt="Swesso Logo" className="logo-img" />
  </div>
  <span className="logo-text">Swesso</span>
</a>


      {/* Center nav links */}
      <nav className={`nav-center ${mobileOpen ? "open" : ""}`}>
        <a
          href="#features"
          onClick={(e) => handleNavClick(e, "features")}
          className="nav-link"
        >
          Features
        </a>
        <a
          href="#about"
          onClick={(e) => handleNavClick(e, "about")}
          className="nav-link"
        >
          About
        </a>
        <a
          href="#contact"
          onClick={(e) => handleNavClick(e, "contact")}
          className="nav-link"
        >
          Contact
        </a>
      </nav>

      {/* Right side actions */}
      <div className="nav-actions">
        {/* If not logged in → Login / Register */}
        {!user && (
          <>
            <Link to="/login" className="btn btn-ghost">
              Login
            </Link>
            <Link to="/register" className="btn btn-solid">
              Register
            </Link>
          </>
        )}

        {/* If logged in → Navigator + profile */}
        {user && (
          <>
            <div className="profile-wrapper">
              <button
                type="button"
                className="profile-btn"
                onClick={() => setProfileOpen((prev) => !prev)}
                aria-label="User menu"
              >
                <span className="profile-initial">{userInitial}</span>
              </button>

              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-email">{user.email}</div>
                  <button
  type="button"
  className="profile-item"
  onClick={() => {
    setProfileOpen(false);
    navigate("/profile");
  }}
>
  Profile
</button>

 <button
                    type="button"
                    className="profile-item"
                     onClick={() => {navigate("/projects");}}>
                  Projects
                  </button>

                  <button
                    type="button"
                    className="profile-item profile-item-danger"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Mobile menu toggle */}
        <button
          className="mobile-toggle"
          aria-label="Toggle menu"
          onClick={() => {
            setMobileOpen((s) => !s);
            setProfileOpen(false);
          }}
        >
          <span className="hamburger" />
        </button>
      </div>
    </header>
  );
};

export default Navbar;
