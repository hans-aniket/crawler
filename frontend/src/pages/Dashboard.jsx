import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

const Dashboard = () => {
  const { user, token } = useContext(AuthContext);
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(() => {
    const saved = localStorage.getItem('crawler_defaultDepth');
    return saved !== null ? Number(saved) : 1;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [crawlJob, setCrawlJob] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [expandedResults, setExpandedResults] = useState({});
  const [searchPage, setSearchPage] = useState(1);

  useEffect(() => {
    let interval;
    if (crawlJob && (crawlJob.status === 'pending' || crawlJob.status === 'running')) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`http://localhost:5000/api/crawl/${crawlJob.jobId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            console.log(data);
            setCrawlJob(prev => {
              // Only update if it's the same job
              if (!prev || prev.jobId != data.id) return prev;
              return {
                ...prev,
                status: data.status,
                title: data.title,
                linksCount: data.linksCount,
                preview: data.preview,
                pagesProcessed: data.pagesProcessed,
                maxPages: data.maxPages
              };
            });
            if (data.status === 'completed' || data.status === 'failed') {
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [crawlJob?.status, crawlJob?.jobId, token]);



  const handleCrawl = async (e) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError('');
    setCrawlJob(null);

    try {
      const response = await fetch('http://localhost:5000/api/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url, depth })
      });

      const data = await response.json();

      if (response.ok) {
        setCrawlJob({ jobId: data.jobId, status: 'pending' });
        setUrl('');
      } else {
        setError(data.error || 'Failed to crawl URL');
      }
    } catch (err) {
      setError('An error occurred while reaching the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e, page = 1) => {
    if (e) e.preventDefault();
    if (!searchQuery) return;

    setIsSearching(true);
    setSearchError('');
    if (e) setSearchResults(null);
    setSearchPage(page);

    try {
      const response = await fetch(`http://localhost:5000/api/search?q=${encodeURIComponent(searchQuery)}&page=${page}&limit=5`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSearchResults(data);
        const autoExp = localStorage.getItem('crawler_autoExpand') === 'true';
        if (autoExp) {
          const initialExpanded = {};
          data.results.forEach((_, idx) => {
            initialExpanded[idx] = true;
          });
          setExpandedResults(initialExpanded);
        } else {
          setExpandedResults({});
        }
      } else {
        setSearchError(data.error || 'Failed to search');
      }
    } catch (err) {
      setSearchError('An error occurred while searching.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Welcome, {user?.username}</h1>
        </div>
        
        <div className="card">
          <h2 style={{ fontSize: '1rem', marginBottom: '16px' }}>Crawl New URL</h2>
          <form onSubmit={handleCrawl} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              className="form-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="depth" style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>Depth:</label>
              <input
                id="depth"
                type="number"
                className="form-input"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                min="1"
                max="5"
                style={{ width: '60px' }}
                required
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: 'auto' }}
              disabled={isLoading || (crawlJob && (crawlJob.status === 'pending' || crawlJob.status === 'running'))}
            >
              {(isLoading || (crawlJob && (crawlJob.status === 'pending' || crawlJob.status === 'running'))) ? 'Crawling...' : 'Crawl'}
            </button>
          </form>
          {error && <div className="error-message" style={{ marginTop: '16px' }}>{error}</div>}
        </div>

        {crawlJob && (
          <div className="card">
            <h2 style={{ fontSize: '1rem', marginBottom: '16px' }}>Crawl Job Status</h2>
            <div style={{ marginBottom: '16px' }}>
              <strong>Job ID:</strong> {crawlJob.jobId} <br />
              <strong>Status:</strong> <span style={{ textTransform: 'capitalize' }}>{crawlJob.status}</span>
            </div>
            
            {(crawlJob.status === 'pending' || crawlJob.status === 'running') && (
              <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Current Status:</strong> {crawlJob.status === 'pending' ? 'Pending' : 'Processing'}
                </div>
                <div style={{ marginBottom: '8px', fontFamily: 'monospace', fontSize: '16px', letterSpacing: '2px', color: 'var(--accent-color, #60a5fa)' }}>
                  [{(() => {
                    const max = crawlJob.maxPages || 50;
                    const processed = crawlJob.pagesProcessed || 0;
                    const percent = Math.min(100, Math.round((processed / max) * 100));
                    const filled = Math.floor(percent / 10);
                    const empty = 10 - filled;
                    return '█'.repeat(filled) + '░'.repeat(empty);
                  })()}] {Math.min(100, Math.round(((crawlJob.pagesProcessed || 0) / (crawlJob.maxPages || 50)) * 100))}%
                </div>
                <div>
                  <strong>Pages processed:</strong> {crawlJob.pagesProcessed || 0} / {crawlJob.maxPages || 50} pages
                </div>
              </div>
            )}
            
            {crawlJob.status === 'completed' && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <strong>Title:</strong><br />
                  {crawlJob.title}
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <strong>Links Found:</strong><br />
                  {crawlJob.linksCount || 0}
                </div>
                <div>
                  <strong>Preview:</strong><br />
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', fontSize: '14px', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                    {crawlJob.preview}
                  </div>
                </div>
              </>
            )}
            
            {crawlJob.status === 'failed' && (
              <div style={{ color: 'var(--error-color, #ef4444)', marginTop: '8px' }}>
                Job failed to process.
              </div>
            )}
          </div>
        )}

        <div className="card">
          <h2 style={{ fontSize: '1rem', marginBottom: '16px' }}>Search Indexed Pages</h2>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keyword..."
              required
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: 'auto' }}
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
          {searchError && <div className="error-message" style={{ marginTop: '16px' }}>{searchError}</div>}
        </div>

        {searchResults && (
          <div className="card">
            <h2 style={{ fontSize: '1rem', marginBottom: '16px' }}>Search Results</h2>
            {searchResults.results.length === 0 ? (
              <div className="empty-state">No results found</div>
            ) : (
              searchResults.results.map((result, idx) => (
                <div key={idx} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: idx < searchResults.results.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Title:</strong><br />
                    {result.title}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>URL:</strong><br />
                    <a href={result.url} target="_blank" rel="noopener noreferrer">{result.url}</a>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Score:</strong><br />
                    {result.score}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Matched Section: {result.sectionTitle}</strong><br />
                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                      ...{result.preview}...
                    </div>
                  </div>
                  {result.fullContent && (
                    <div>
                      <button
                        onClick={() => setExpandedResults(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-color, #60a5fa)',
                          cursor: 'pointer',
                          padding: '4px 0',
                          fontSize: '14px'
                        }}
                      >
                        {expandedResults[idx] ? 'Show Less ▲' : 'Show More ▼'}
                      </button>
                      {expandedResults[idx] && (
                        <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', fontSize: '14px', whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto', marginTop: '8px' }}>
                          {result.fullContent}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            
            {searchResults.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                <button 
                  onClick={() => handleSearch(null, searchResults.currentPage - 1)}
                  disabled={searchResults.currentPage === 1}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: searchResults.currentPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                    cursor: searchResults.currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: searchResults.currentPage === 1 ? 0.5 : 1
                  }}
                >
                  Previous
                </button>
                {Array.from({ length: searchResults.totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handleSearch(null, page)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '20px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: searchResults.currentPage === page ? 'var(--accent-color, #60a5fa)' : 'var(--bg-secondary)',
                      color: searchResults.currentPage === page ? '#fff' : 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    {page}
                  </button>
                ))}
                <button 
                  onClick={() => handleSearch(null, searchResults.currentPage + 1)}
                  disabled={searchResults.currentPage === searchResults.totalPages}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: searchResults.currentPage === searchResults.totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                    cursor: searchResults.currentPage === searchResults.totalPages ? 'not-allowed' : 'pointer',
                    opacity: searchResults.currentPage === searchResults.totalPages ? 0.5 : 1
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}


      </main>
    </div>
  );
};

export default Dashboard;
