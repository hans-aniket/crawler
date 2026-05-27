import React, { useState, useEffect, useContext } from 'react';
import API_URL from '../config/api';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

const CrawlJobs = () => {
  const { token } = useContext(AuthContext);
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [jobPage, setJobPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [jobDetails, setJobDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/api/crawl/jobs?page=${jobPage}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.jobs && Array.isArray(data.jobs)) {
          setJobs(data.jobs);
          setTotalPages(data.totalPages || 1);
        }
      })
      .catch(err => console.error('Failed to fetch jobs', err));
    }
  }, [token, jobPage]);

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  const handleExpand = async (jobId) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    
    setExpandedJobId(jobId);
    
    if (!jobDetails[jobId]) {
      setLoadingDetails(true);
      try {
        const response = await fetch(`${API_URL}/api/crawl/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setJobDetails(prev => ({ ...prev, [jobId]: data }));
        }
      } catch (err) {
        console.error("Failed to fetch job details", err);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Crawl Jobs</h1>
        </div>
        
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          {['all', 'completed', 'pending', 'failed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: filter === f ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                color: filter === f ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredJobs.length === 0 ? (
            <div className="empty-state">No jobs found</div>
          ) : (
            filteredJobs.map(job => (
              <div key={job.id} style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
              }}>
                <div 
                  onClick={() => handleExpand(job.id)}
                  style={{ 
                    padding: '16px', 
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Job #{job.id}</div>
                  <div style={{ fontSize: '14px' }}>
                    <strong>URL:</strong> <a href={job.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{job.url}</a>
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    <strong>Status:</strong>{' '}
                    <span style={{ 
                      color: job.status === 'completed' ? 'var(--success-color, #22c55e)' : 
                             job.status === 'failed' ? 'var(--error-color, #ef4444)' : 
                             'var(--warning-color, #f59e0b)',
                      textTransform: 'capitalize'
                    }}>
                      {job.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    <strong>Pages Crawled:</strong> {job.pages_crawled}
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    <strong>Depth:</strong> {job.depth || 1}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    <strong>Created:</strong> {new Date(job.created_at).toLocaleString(undefined, {
                      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
                    })}
                  </div>
                </div>

                {expandedJobId === job.id && (
                  <div style={{ 
                    padding: '16px', 
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)'
                  }}>
                    {loadingDetails && !jobDetails[job.id] ? (
                      <div>Loading details...</div>
                    ) : jobDetails[job.id] ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <strong>Title:</strong><br />
                          {jobDetails[job.id].title}
                        </div>
                        <div>
                          <strong>Links Found:</strong><br />
                          {jobDetails[job.id].linksCount || 0}
                        </div>
                        <div>
                          <strong>Preview:</strong><br />
                          <div style={{ 
                            padding: '12px', 
                            backgroundColor: 'var(--bg-primary)', 
                            borderRadius: '6px', 
                            fontSize: '14px', 
                            whiteSpace: 'pre-wrap', 
                            maxHeight: '300px', 
                            overflowY: 'auto',
                            marginTop: '4px'
                          }}>
                            {jobDetails[job.id].preview || 'No preview available'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>Details not available</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px', marginBottom: '20px' }}>
            <button 
              onClick={() => setJobPage(p => Math.max(1, p - 1))}
              disabled={jobPage === 1}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: jobPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                cursor: jobPage === 1 ? 'not-allowed' : 'pointer',
                opacity: jobPage === 1 ? 0.5 : 1
              }}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setJobPage(page)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: jobPage === page ? 'var(--accent-color, #60a5fa)' : 'var(--bg-secondary)',
                  color: jobPage === page ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                {page}
              </button>
            ))}
            <button 
              onClick={() => setJobPage(p => Math.min(totalPages, p + 1))}
              disabled={jobPage === totalPages}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: jobPage === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                cursor: jobPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: jobPage === totalPages ? 0.5 : 1
              }}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default CrawlJobs;
