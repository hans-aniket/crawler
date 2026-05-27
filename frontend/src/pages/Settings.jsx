import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

const Settings = () => {
  const [maxPages, setMaxPages] = useState(50);
  const [defaultDepth, setDefaultDepth] = useState(1);
  const [autoExpand, setAutoExpand] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const storedMaxPages = localStorage.getItem('crawler_maxPages');
    const storedDefaultDepth = localStorage.getItem('crawler_defaultDepth');
    const storedAutoExpand = localStorage.getItem('crawler_autoExpand');

    if (storedMaxPages !== null) setMaxPages(Number(storedMaxPages));
    if (storedDefaultDepth !== null) setDefaultDepth(Number(storedDefaultDepth));
    if (storedAutoExpand !== null) setAutoExpand(storedAutoExpand === 'true');
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('crawler_maxPages', maxPages);
    localStorage.setItem('crawler_defaultDepth', defaultDepth);
    localStorage.setItem('crawler_autoExpand', autoExpand);
    
    setSaveMessage('Settings saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Settings</h1>
        </div>
        
        <div className="card" style={{ maxWidth: '600px' }}>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div>
              <label htmlFor="maxPages" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Max Pages Per Crawl
              </label>
              <input
                id="maxPages"
                type="number"
                className="form-input"
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                min="1"
                max="500"
                required
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Maximum number of pages the crawler will visit in a single job.
              </div>
            </div>

            <div>
              <label htmlFor="defaultDepth" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Default Crawl Depth
              </label>
              <input
                id="defaultDepth"
                type="number"
                className="form-input"
                value={defaultDepth}
                onChange={(e) => setDefaultDepth(Number(e.target.value))}
                min="1"
                max="10"
                required
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Default recursive depth to populate in the Crawl New URL form.
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Auto-expand Search Results
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="autoExpand"
                  type="checkbox"
                  checked={autoExpand}
                  onChange={(e) => setAutoExpand(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="autoExpand" style={{ cursor: 'pointer' }}>
                  Automatically expand full content for search results
                </label>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '150px', marginTop: '10px' }}>
              Save Settings
            </button>
            {saveMessage && <div style={{ color: 'var(--success-color, #22c55e)', marginTop: '8px' }}>{saveMessage}</div>}
          </form>
        </div>
      </main>
    </div>
  );
};

export default Settings;
