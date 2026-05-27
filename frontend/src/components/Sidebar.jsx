import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Globe, LayoutDashboard, Settings, LogOut, BarChart2 } from 'lucide-react';

const Sidebar = () => {
  const { logout } = useContext(AuthContext);
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <Globe size={24} />
          WebCrawler
        </div>
      </div>
      <nav className="sidebar-nav">
        <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>
          <LayoutDashboard size={18} />
          Dashboard
        </Link>
        <Link to="/jobs" className={`nav-link ${isActive('/jobs')}`}>
          <Globe size={18} />
          Crawl Jobs
        </Link>
        <Link to="/analytics" className={`nav-link ${isActive('/analytics')}`}>
          <BarChart2 size={18} />
          Analytics
        </Link>
        <Link to="/settings" className={`nav-link ${isActive('/settings')}`}>
          <Settings size={18} />
          Settings
        </Link>
      </nav>
      <div className="sidebar-footer">
        <button className="nav-link" style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left' }} onClick={logout}>
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
