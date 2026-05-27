import React, { useState, useEffect, useContext } from 'react';
import API_URL from '../config/api';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';

const Analytics = () => {
  const { token } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`${API_URL}/api/crawl/analytics`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch analytics');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (token) {
      fetchAnalytics();
    }
  }, [token]);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Crawl Analytics</h1>
        </div>

        {loading ? (
          <div>Loading analytics...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : data ? (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px',
              marginBottom: '24px'
            }}>
              <div className="card">
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Total Crawl Jobs</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-color)' }}>{data.totalJobs}</div>
              </div>
              <div className="card">
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Total Indexed Pages</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-color)' }}>{data.totalPagesIndexed}</div>
              </div>
              <div className="card">
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Average Pages / Job</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-color)' }}>{data.averagePagesPerJob}</div>
              </div>
              <div className="card">
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Completed Jobs</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--success-color, #22c55e)' }}>{data.completedJobs}</div>
              </div>
              <div className="card">
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Failed Jobs</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--error-color, #ef4444)' }}>{data.failedJobs}</div>
              </div>
              <div className="card">
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Average Crawl Depth</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-color)' }}>{data.averageDepth}</div>
              </div>
            </div>

            <div className="card">
              <h2 style={{ fontSize: '1rem', marginBottom: '16px' }}>Top Domains</h2>
              {data.topDomains && data.topDomains.length > 0 ? (
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>Domain</th>
                      <th style={{ textAlign: 'right', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>Crawl Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topDomains.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'left', padding: '12px 0', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>{item.domain}</td>
                        <td style={{ textAlign: 'right', padding: '12px 0', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold' }}>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: 'var(--text-secondary)' }}>No domains crawled yet.</div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
};

export default Analytics;
