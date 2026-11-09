import React, { useEffect, useState } from "react";
import { Link} from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./css/LandingPage.css";
import Navbar from "../components/Navbar"; // 

const LandingPage: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
  const checkSession = async () => {
    const { data } = await supabase.auth.getSession();
    setIsLoggedIn(!!data.session);
  };

  checkSession();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setIsLoggedIn(!!session);
  });

  return () => subscription.unsubscribe();
}, []);


  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="landing-root">
      {/* Navbar (reusable) */}
      <Navbar />

      {/* Hero */}
      <section className="hero" role="region" aria-label="Hero">
        <div className="hero-inner">
          <div className="hero-layout">
            <div className="hero-left">
              <span className="hero-badge">
                For UAE switchgear estimators
              </span>
              <h1 className="hero-title">
                Estimate switchgear panels in minutes, not weeks.
              </h1>
              <p className="hero-sub">
                Swesso automates cost estimation for MDBs, SMDBs, Capacitor
                Banks, DBs, and other panels, aligned with UAE market
                practices.
              </p>

              <div className="hero-actions">
               <Link
  to={isLoggedIn ? "/projects" : "/register"}
  className="btn btn-solid hero-cta"
>
  Get Started
</Link>

                <button
                  className="btn btn-ghost hero-secondary"
                  onClick={() => handleScrollTo("features")}
                >
                  View features
                </button>
              </div>

              <p className="hero-meta">
                No credit card required · Built for engineering teams
              </p>
            </div>

            <div className="hero-right">
              <div className="hero-card" aria-hidden="true">
                <div className="hero-card-header">
                  <span className="hero-card-title">Estimate preview</span>
                  <span className="hero-card-tag">Switchgear panel</span>
                </div>
                <div className="hero-card-body">
                  <div className="hero-card-row hero-card-row-header">
                    <span>Component</span>
                    <span>Qty</span>
                    <span>Unit price</span>
                    <span>Total</span>
                  </div>
                  <div className="hero-card-row">
                    <span>MDB Incomer</span>
                    <span>1</span>
                    <span>AED 4,250</span>
                    <span>AED 4,250</span>
                  </div>
                  <div className="hero-card-row">
                    <span>Outgoing feeders</span>
                    <span>12</span>
                    <span>AED 680</span>
                    <span>AED 8,160</span>
                  </div>
                  <div className="hero-card-row">
                    <span>Accessories</span>
                    <span>—</span>
                    <span>—</span>
                    <span>AED 1,120</span>
                  </div>
                  <div className="hero-card-footer">
                    <span>Estimated total</span>
                    <span>AED 13,530</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section id="features" className="section features-section">
        <div className="container">
          <h2 className="section-title">Key Features</h2>

          <div className="features-grid">
            <article className="feature-card">
              <h3 className="feature-title">Tailored to the UAE market</h3>
              <p className="feature-text">
                Designed around UAE standards, practices, and commonly used
                switchgear configurations.
              </p>
            </article>

            <article className="feature-card">
              <h3 className="feature-title">Supports all major panels</h3>
              <p className="feature-text">
                MDBs, SMDBs, Capacitor Banks, DBs, and other popular panel types
                in one place.
              </p>
            </article>

            <article className="feature-card">
              <h3 className="feature-title">Automated estimation</h3>
              <p className="feature-text">
                Eliminate repetitive manual work with automated calculations and
                BOM generation.
              </p>
            </article>

            <article className="feature-card">
              <h3 className="feature-title">Consistent, accurate pricing</h3>
              <p className="feature-text">
                Bring consistency across proposals and reduce human error in
                costing.
              </p>
            </article>

            <article className="feature-card">
              <h3 className="feature-title">Simple, familiar interface</h3>
              <p className="feature-text">
                Built to feel like a focused engineering tool, not a complex ERP
                system.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="section about-section">
        <div className="container about-layout">
          <div className="about-main">
            <h2 className="section-title section-title-left">About Swesso</h2>
            <p>
              Swesso is a dedicated switchgear cost estimation software tailored
              for the UAE market. It streamlines the preparation of cost
              estimates for widely used panels such as Main Distribution Boards
              (MDBs), Sub-Main Distribution Boards (SMDBs), Capacitor Banks,
              Distribution Boards (DBs), and others.
            </p>

            <p>
              In the electrical industry, cost estimation is often a repetitive
              and time-intensive task, especially within the iterative
              design-and-estimate cycles of larger projects. Swesso automates
              this process, delivering consistent and reliable estimates while
              significantly reducing the time and effort required.
            </p>

            <p>
              By aligning with regional standards and industry practices, Swesso
              provides engineers, consultants, and contractors with a dependable
              tool that supports accuracy, efficiency, and competitiveness in
              every project.
            </p>
          </div>

          <aside className="about-side">
            <div className="stat-card">
              <div className="stat-number">70%</div>
              <div className="stat-label">less time spent per estimate</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">4+</div>
              <div className="stat-label">panel types supported</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">100%</div>
              <div className="stat-label">focus on UAE practices</div>
            </div>
          </aside>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="section contact-section">
        <div className="container contact-layout">
          <div className="contact-text">
            <h2 className="section-title section-title-left">Contact Us</h2>
            <p className="contact-lead">
              Get in touch with us for more information, demos, or support.
            </p>
            <p className="contact-note">
              We’re happy to walk through your current estimation workflow and
              show how Swesso can fit into it.
            </p>
          </div>

          <div className="contact-card">
            <p>
              <strong>Phone:</strong>{" "}
              <a href="tel:+971551234567">+971-55-123-4567</a>
            </p>
            <p>
              <strong>Email:</strong>{" "}
              <a href="mailto:info@swesso.com">info@swesso.com</a>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-inner">
          <p>© {new Date().getFullYear()} Swesso. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
