import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from "./pages/ProfilePage";
import ProjectsPage from './pages/ProjectsPage';
import ProjectWorkspacePage from "./pages/ProjectWorkspacePage";
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Existing routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

<Route path="/profile" element={<ProfilePage />} />
<Route path="/projects" element={<ProjectsPage />} />

<Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
