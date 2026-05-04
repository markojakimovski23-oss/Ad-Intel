'use client';
import { useState, useRef, useEffect } from 'react';

const GOLD = '#F5B900';
const DARK = '#0a0a0a';
const CARD = '#111';
const BORDER = '#222';
const severityColor = { high: '#ef4444', medium: '#F5B900', low: '#22c55e' };
const severityBg = { high: '#ef444411', medium: '#F5B90011', low: '#22c55e11' };
const priorityColor = { high: '#ef4444', medium: '#F5B900', low: '#22c55e' };
const platformIcons = { meta: '📘', google: '🔍', linkedin: '💼', tiktok: '🎵', youtube: '▶️' };

export default function Home() {
  const [mode, setMode] = useState('scanner'); // 'scanner' or 'finder'

  // Scanner state
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [painTab, setPainTab] = useState('ads');
  const [copied, setCopied] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Finder state
  const [finderPrompt, setFinderPrompt] = useState('');
  const [finderLoading, setFinderLoading] = useState(false);
  const [finderResult, setFinderResult] = useState(null);
  const [finderError, setFinderError] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  const loadingMsgs = [
    'Scraping Meta Ad Library...',
    'Checking LinkedIn ads...',
    'Running AI analysis...',
    'Identifying pain points...',
    'Building outreach strategy...',
    'Almost done...',
  ];

  const finderLoadingMsgs = [
    'Parsing your search criteria...',
    'Searching Meta Ad Library...',
    'Searching Google for companies...',
    'Checking LinkedIn...',
    'Qualifying leads with AI...',
    'Finding contact emails...',
    'Almost done...',
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (chatOpen && result && chatMessages.length === 0) {
      setChatMessages([{
        role: 'assistant',
        content: `I've fully analysed **${result.company_name}**.\n\n• **Signal Score:** ${result.signal_score}/100 ${result.hot_lead ? '🔥 Hot Lead' : ''}\n• **Industry:** ${result.industry}\n• **Active Platforms:** ${result.total_platforms_active}/5\n• **Meta Data:** ${result.platforms?.meta?.real_data ? '✓ Real data' : '~ AI estimate'}\n• **Pain Points:** ${countPainPoints(result.pain_points)} detected\n• **Biggest Opportunity:** ${result.biggest_opportunity || 'See solutions tab'}\n\nWhat do you want to do with this company?`
      }]);
    }
    if (chatOpen) setTimeout(() => chatInputRef.current?.focus(), 100);
  }, [chatOpen]);

  async function analyze() {
    const d = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!d) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setTab('overview');
    setChatMessages([]);
    setChatOpen(false);
    let msgIdx = 0;
    setLoadingMsg(loadingMsgs[0]);
    const msgTimer = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, loadingMsgs.length - 1);
      setLoadingMsg(loadingMsgs[msgIdx]);
    }, 10000);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      clearInterval(msgTimer);
      setLoading(false);
    }
  }

  async function findLeads() {
    if (!finderPrompt.trim()) return;
    setFinderLoading(true);
    setFinderResult(null);
    setFinderError(null);
    setSelectedLead(null);
    let msgIdx = 0;
    setLoadingMsg(finderLoadingMsgs[0]);
    const msgTimer = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, finderLoadingMsgs.length - 1);
      setLoadingMsg(finderLoadingMsgs[msgIdx]);
    }, 10000);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finderPrompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFinderResult(data);
    } catch (e) {
      setFinderError(e.message);
    } finally {
      clearInterval(msgTimer);
      setFinderLoading(false);
    }
  }

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user', content: msg }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, companyContext: result }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChatMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setChatMessages([...newMessages, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  function copyText(text, key) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  function countPainPoints(pp) {
    if (!pp) return 0;
    return Object.values(pp).reduce((a, arr) => a + (Array.isArray(arr) ? arr.length : 0), 0);
  }

  function md(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#F5B900">$1</strong>').replace(/\n/g, '<br/>');
  }

  const scannerTabs = ['overview', 'pain points', 'solutions', 'outreach', 'contacts', 'competitors'];
  const painCats = ['ads', 'website', 'seo', 'social_media', 'email_marketing', 'lead_generation', 'reputation', 'content', 'competitive', 'operations'];
  const quickPrompts = ['Write me a full proposal', 'Write a cold call script', 'Who should I contact first?', 'Write a WhatsApp message', 'Write a LinkedIn DM', 'What are their biggest weaknesses?', 'Compare to competitors', 'What services should I pitch?'];
  const finderExamples = [
    'Gyms in Dubai running Meta ads',
    'Ecommerce stores in UK spending on Google ads',
    'Restaurants in Skopje with no retargeting',
    'Real estate agencies in UAE active on LinkedIn',
    'Beauty salons in London running Instagram ads',
    'B2B SaaS companies in Germany on LinkedIn',
    'Car dealerships in Serbia running Facebook ads',
    'Hotels in Greece with no email marketing',
  ];

  return (
    <div style={{ minHeight: '100vh', background: DARK, color: '#e8e8e8', fontFamily: 'system-ui, sans-serif', display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, marginBottom: 8 }}>DIGITAL MA</div>
            <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>Agency Prospecting OS</h1>
            <p style={{ color: '#555', marginTop: 6, fontSize: 13 }}>Full marketing intelligence + AI lead finder</p>
          </div>

          {/* Mode switcher */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 32, background: CARD, padding: 6, borderRadius: 12, border: `1px solid ${BORDER}`, width: 'fit-content' }}>
            <button onClick={() => setMode('scanner')} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: mode === 'scanner' ? GOLD : 'transparent', color: mode === 'scanner' ? '#000' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🔍 Company Scanner
            </button>
            <button onClick={() => setMode('finder')} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: mode === 'finder' ? GOLD : 'transparent', color: mode === 'finder' ? '#000' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🎯 Lead Finder
            </button>
          </div>

          {/* ══════════ COMPANY SCANNER MODE ══════════ */}
          {mode === 'scanner' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                <input
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && analyze()}
                  placeholder="Enter company domain e.g. nike.com"
                  style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px', color: '#e8e8e8', fontSize: 15, outline: 'none' }}
                />
                <button onClick={analyze} disabled={loading} style={{ background: loading ? '#222' : GOLD, color: loading ? '#555' : '#000', border: 'none', borderRadius: 10, padding: '14px 28px', fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', minWidth: 130 }}>
                  {loading ? 'Scanning...' : 'Scan →'}
                </button>
              </div>

              {loading && (
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
                  <div style={{ fontSize: 14, color: GOLD, fontWeight: 700, marginBottom: 6 }}>{loadingMsg}</div>
                  <div style={{ fontSize: 12, color: '#444' }}>Pulling real ad data — takes 30-60 seconds</div>
                  <div style={{ marginTop: 16, height: 3, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: GOLD, borderRadius: 3, animation: 'progress 60s linear forwards' }} />
                  </div>
                </div>
              )}

              {error && <div style={{ background: '#1a0000', border: '1px solid #ef444444', borderRadius: 10, padding: 16, color: '#ef4444', marginBottom: 24 }}>⚠ {error}</div>}

              {result && (
                <div>
                  {/* Company header */}
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                      <div style={{ textAlign: 'center', minWidth: 80 }}>
                        <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: result.signal_score >= 70 ? '#22c55e' : result.signal_score >= 40 ? GOLD : '#ef4444' }}>{result.signal_score}</div>
                        <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginTop: 4 }}>SIGNAL</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                          <div style={{ fontSize: 22, fontWeight: 800 }}>{result.company_name}</div>
                          {result.hot_lead && <span style={{ background: '#ef444422', border: '1px solid #ef444466', borderRadius: 20, padding: '3px 12px', fontSize: 11, color: '#ef4444', fontWeight: 700 }}>🔥 HOT LEAD</span>}
                          <button onClick={() => setChatOpen(!chatOpen)} style={{ marginLeft: 'auto', background: chatOpen ? `${GOLD}22` : '#1a1a1a', border: `1px solid ${chatOpen ? GOLD : '#333'}`, color: chatOpen ? GOLD : '#888', borderRadius: 10, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                            🤖 {chatOpen ? 'Close AI' : 'Ask AI Analyst'}
                          </button>
                        </div>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>{result.domain} · {result.industry} · {result.company_size} · {result.business_type} · {result.growth_stage}</div>
                        <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, marginBottom: 14 }}>{result.signal_summary}</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {[
                            { label: 'EST. REVENUE', value: result.estimated_revenue },
                            { label: 'IN BUSINESS', value: result.years_in_business },
                            { label: 'PLATFORMS ACTIVE', value: `${result.total_platforms_active || 0} / 5` },
                          ].map(({ label, value }) => (
                            <div key={label} style={{ background: '#ffffff08', borderRadius: 8, padding: '8px 14px' }}>
                              <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>{label}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{value || 'Unknown'}</div>
                            </div>
                          ))}
                          <div style={{ background: '#ef444411', borderRadius: 8, padding: '8px 14px', border: '1px solid #ef444433' }}>
                            <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>PAIN POINTS</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{countPainPoints(result.pain_points)} detected</div>
                          </div>
                          <div style={{ background: result.platforms?.meta?.real_data ? '#22c55e11' : '#ffffff08', borderRadius: 8, padding: '8px 14px', border: result.platforms?.meta?.real_data ? '1px solid #22c55e33' : `1px solid ${BORDER}` }}>
                            <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>META DATA</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: result.platforms?.meta?.real_data ? '#22c55e' : '#555' }}>{result.platforms?.meta?.real_data ? '✓ Real' : '~ Estimated'}</div>
                          </div>
                        </div>
                        {result.biggest_opportunity && (
                          <div style={{ marginTop: 12, background: `${GOLD}11`, border: `1px solid ${GOLD}33`, borderRadius: 8, padding: '10px 14px' }}>
                            <span style={{ fontSize: 10, color: GOLD, letterSpacing: 1, fontWeight: 700 }}>BIGGEST OPPORTUNITY: </span>
                            <span style={{ fontSize: 13, color: '#ccc' }}>{result.biggest_opportunity}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Scanner tabs */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    {scannerTabs.map(t => (
                      <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? `${GOLD}22` : 'transparent', border: `1px solid ${tab === t ? `${GOLD}66` : BORDER}`, color: tab === t ? GOLD : '#555', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: tab === t ? 700 : 400, textTransform: 'uppercase' }}>
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* OVERVIEW */}
                  {tab === 'overview' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
                        {['meta', 'google', 'linkedin', 'tiktok', 'youtube'].map(p => (
                          <div key={p} style={{ background: CARD, border: `1px solid ${result.platforms?.[p]?.active_last_30_days ? '#22c55e33' : BORDER}`, borderRadius: 12, padding: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <div style={{ fontWeight: 700, textTransform: 'capitalize', fontSize: 13 }}>{platformIcons[p]} {p}</div>
                              <div style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: result.platforms?.[p]?.active_last_30_days ? '#22c55e22' : '#ef444422', color: result.platforms?.[p]?.active_last_30_days ? '#22c55e' : '#ef4444' }}>
                                {result.platforms?.[p]?.active_last_30_days ? '🔥 ACTIVE' : 'INACTIVE'}
                              </div>
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: result.platforms?.[p]?.active_last_30_days ? GOLD : '#333' }}>{result.platforms?.[p]?.ad_count || '0'}</div>
                            <div style={{ fontSize: 9, color: '#555', marginBottom: 6 }}>ADS (30 DAYS)</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#ccc' }}>{result.platforms?.[p]?.spend_estimate || '—'}</div>
                            <div style={{ fontSize: 9, color: '#555', marginBottom: 6 }}>EST. SPEND/MO</div>
                            {result.platforms?.[p]?.last_ad_date && <div style={{ fontSize: 10, color: result.platforms?.[p]?.active_last_30_days ? '#22c55e' : '#ef4444', marginBottom: 4 }}>Last: {result.platforms[p].last_ad_date}</div>}
                            {p === 'meta' && (
                              <div style={{ marginTop: 6, fontSize: 9, padding: '2px 8px', borderRadius: 20, display: 'inline-block', background: result.platforms?.meta?.real_data ? '#22c55e22' : '#ffffff08', color: result.platforms?.meta?.real_data ? '#22c55e' : '#555', border: `1px solid ${result.platforms?.meta?.real_data ? '#22c55e44' : '#333'}` }}>
                                {result.platforms?.meta?.real_data ? '✓ REAL DATA' : '~ AI ESTIMATE'}
                              </div>
                            )}
                            {p === 'linkedin' && result.platforms?.linkedin?.real_data && (
                              <div style={{ marginTop: 6, fontSize: 9, padding: '2px 8px', borderRadius: 20, display: 'inline-block', background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44' }}>✓ REAL DATA</div>
                            )}
                          </div>
                        ))}
                      </div>

                      {result.meta_ads_raw?.length > 0 && (
                        <div style={{ background: CARD, border: '1px solid #22c55e33', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                          <div style={{ fontSize: 11, color: '#22c55e', letterSpacing: 1, marginBottom: 14 }}>✓ REAL META ADS ({result.meta_ads_raw.length})</div>
                          {result.meta_ads_raw.map((ad, i) => (
                            <div key={i} style={{ padding: '10px 14px', background: '#ffffff05', borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{ad.page || 'Unknown'}</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  {ad.started && <span style={{ fontSize: 10, color: '#555' }}>Since: {ad.started}</span>}
                                  {ad.snapshot && <a href={ad.snapshot} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: GOLD, textDecoration: 'none', padding: '2px 8px', border: `1px solid ${GOLD}44`, borderRadius: 4 }}>View →</a>}
                                </div>
                              </div>
                              {ad.body && <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>"{ad.body.slice(0, 120)}{ad.body.length > 120 ? '...' : ''}"</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {result.services_to_pitch?.length > 0 && (
                        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: '#555', letterSpacing: 1, marginBottom: 14 }}>SERVICES TO PITCH</div>
                          {result.services_to_pitch.map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#ffffff05', borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 8 }}>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${priorityColor[s.priority] || GOLD}22`, color: priorityColor[s.priority] || GOLD, fontWeight: 700, minWidth: 50, textAlign: 'center' }}>{s.priority?.toUpperCase()}</span>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{s.service}</div>
                                <div style={{ fontSize: 11, color: '#666' }}>{s.reason}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {result.intent_signals?.length > 0 && (
                        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                          <div style={{ fontSize: 11, color: '#555', letterSpacing: 1, marginBottom: 14 }}>INTENT SIGNALS</div>
                          {result.intent_signals.map((s, i) => (
                            <div key={i} style={{ padding: '10px 14px', background: '#22c55e08', border: '1px solid #22c55e22', borderRadius: 8, marginBottom: 8 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: '#22c55e' }}>{s.signal || s}</div>
                              {s.meaning && <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>{s.meaning}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PAIN POINTS */}
                  {tab === 'pain points' && (
                    <div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                        {painCats.map(c => (
                          <button key={c} onClick={() => setPainTab(c)} style={{ background: painTab === c ? '#ef444422' : 'transparent', border: `1px solid ${painTab === c ? '#ef444466' : BORDER}`, color: painTab === c ? '#ef4444' : '#555', borderRadius: 8, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
                            {c.replace(/_/g, ' ').toUpperCase()} {result.pain_points?.[c]?.length > 0 && `(${result.pain_points[c].length})`}
                          </button>
                        ))}
                      </div>
                      {result.pain_points?.[painTab]?.length > 0 ? result.pain_points[painTab].map((p, i) => (
                        <div key={i} style={{ background: CARD, border: `1px solid ${severityColor[p.severity] || BORDER}33`, borderRadius: 10, padding: '14px 18px', marginBottom: 8 }}>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: severityBg[p.severity] || '#ffffff08', color: severityColor[p.severity] || '#888', fontWeight: 700, minWidth: 50, textAlign: 'center', flexShrink: 0 }}>{p.severity?.toUpperCase()}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{p.issue}</div>
                              {p.fix && <div style={{ fontSize: 12, color: '#22c55e' }}>✓ Fix: {p.fix}</div>}
                            </div>
                          </div>
                        </div>
                      )) : <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>No issues in this category</div>}
                    </div>
                  )}

                  {/* SOLUTIONS */}
                  {tab === 'solutions' && result.solutions && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ background: '#ef444411', border: '1px solid #ef444433', borderRadius: 12, padding: 20 }}>
                        <div style={{ fontSize: 11, color: '#ef4444', letterSpacing: 1, marginBottom: 8 }}>🎯 TOP PRIORITY</div>
                        <p style={{ fontSize: 14, color: '#e8e8e8', lineHeight: 1.7, margin: 0 }}>{result.solutions.priority_action}</p>
                      </div>
                      {result.solutions.roi_projection && (
                        <div style={{ background: '#22c55e11', border: '1px solid #22c55e33', borderRadius: 12, padding: 20 }}>
                          <div style={{ fontSize: 11, color: '#22c55e', letterSpacing: 1, marginBottom: 8 }}>📈 ROI PROJECTION</div>
                          <p style={{ fontSize: 14, color: '#e8e8e8', lineHeight: 1.7, margin: 0 }}>{result.solutions.roi_projection}</p>
                        </div>
                      )}
                      {['quick_wins', 'short_term', 'long_term'].map(section => result.solutions[section]?.length > 0 && (
                        <div key={section} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                          <div style={{ fontSize: 11, color: GOLD, letterSpacing: 1, marginBottom: 14 }}>
                            {section === 'quick_wins' ? '⚡ QUICK WINS' : section === 'short_term' ? '📅 SHORT TERM' : '🚀 LONG TERM'}
                          </div>
                          {result.solutions[section].map((s, i) => (
                            <div key={i} style={{ padding: '14px 16px', background: '#ffffff05', borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{s.action}</div>
                                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#ffffff08', color: '#aaa', flexShrink: 0 }}>{s.timeframe}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: severityBg[s.impact], color: severityColor[s.impact] }}>Impact: {s.impact}</span>
                                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#ffffff08', color: '#888' }}>Effort: {s.effort}</span>
                              </div>
                              <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6, margin: 0 }}>{s.description}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                      {result.solutions.agency_pitch && (
                        <div style={{ background: `${GOLD}11`, border: `1px solid ${GOLD}33`, borderRadius: 12, padding: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: GOLD, letterSpacing: 1 }}>💼 AGENCY PITCH</div>
                            <button onClick={() => copyText(result.solutions.agency_pitch, 'pitch')} style={{ background: copied === 'pitch' ? '#22c55e22' : '#ffffff08', border: `1px solid ${copied === 'pitch' ? '#22c55e44' : BORDER}`, color: copied === 'pitch' ? '#22c55e' : '#555', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
                              {copied === 'pitch' ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                          <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.8, margin: 0 }}>{result.solutions.agency_pitch}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* OUTREACH */}
                  {tab === 'outreach' && result.outreach && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: 12, padding: 20 }}>
                        <div style={{ fontSize: 11, color: GOLD, letterSpacing: 1, marginBottom: 8 }}>BEST CHANNEL</div>
                        <div style={{ fontWeight: 700, fontSize: 16, textTransform: 'uppercase', marginBottom: 6 }}>{result.outreach.best_channel?.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: 13, color: '#aaa' }}>{result.outreach.best_angle}</div>
                      </div>
                      {[
                        { key: 'dm_opener', label: '💬 DM OPENER' },
                        { key: 'whatsapp_message', label: '📱 WHATSAPP' },
                        { key: 'call_script', label: '📞 CALL SCRIPT' },
                      ].map(({ key, label }) => result.outreach[key] && (
                        <div key={key} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: '#555', letterSpacing: 1 }}>{label}</div>
                            <button onClick={() => copyText(result.outreach[key], key)} style={{ background: copied === key ? '#22c55e22' : '#ffffff08', border: `1px solid ${copied === key ? '#22c55e44' : BORDER}`, color: copied === key ? '#22c55e' : '#555', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
                              {copied === key ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                          <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.7, margin: 0 }}>{result.outreach[key]}</p>
                        </div>
                      ))}
                      {result.outreach.email_subject && (
                        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: '#555', letterSpacing: 1 }}>📧 EMAIL</div>
                            <button onClick={() => copyText(`Subject: ${result.outreach.email_subject}\n\n${result.outreach.email_body}`, 'email')} style={{ background: copied === 'email' ? '#22c55e22' : '#ffffff08', border: `1px solid ${copied === 'email' ? '#22c55e44' : BORDER}`, color: copied === 'email' ? '#22c55e' : '#555', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
                              {copied === 'email' ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                          <div style={{ fontSize: 12, color: GOLD, marginBottom: 10, fontWeight: 700 }}>Subject: {result.outreach.email_subject}</div>
                          <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.7, margin: 0 }}>{result.outreach.email_body}</p>
                        </div>
                      )}
                      {result.outreach.objections?.length > 0 && (
                        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                          <div style={{ fontSize: 11, color: '#555', letterSpacing: 1, marginBottom: 14 }}>🛡 OBJECTION HANDLER</div>
                          {result.outreach.objections.map((o, i) => (
                            <div key={i} style={{ padding: '12px 14px', background: '#ffffff05', borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 8 }}>
                              <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, marginBottom: 6 }}>"{o.objection}"</div>
                              <div style={{ fontSize: 12, color: '#22c55e' }}>→ {o.response}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CONTACTS */}
                  {tab === 'contacts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {result.contacts?.length > 0 ? result.contacts.map((c, i) => (
                        <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{c.name}</div>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>{c.title}</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {c.best_channel && <span style={{ fontSize: 10, padding: '2px 8px', background: `${GOLD}11`, border: `1px solid ${GOLD}33`, borderRadius: 20, color: GOLD }}>Best: {c.best_channel}</span>}
                              {c.decision_maker_score && <span style={{ fontSize: 10, padding: '2px 8px', background: '#ffffff08', border: `1px solid ${BORDER}`, borderRadius: 20, color: c.decision_maker_score >= 8 ? '#22c55e' : '#888' }}>Score: {c.decision_maker_score}/10</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {c.email && <div style={{ fontSize: 13, color: GOLD, marginBottom: 6 }}>{c.email}</div>}
                            {c.email && <button onClick={() => copyText(c.email, `e${i}`)} style={{ background: copied === `e${i}` ? '#22c55e22' : '#ffffff08', border: `1px solid ${copied === `e${i}` ? '#22c55e44' : BORDER}`, color: copied === `e${i}` ? '#22c55e' : '#555', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>{copied === `e${i}` ? '✓' : 'Copy'}</button>}
                          </div>
                        </div>
                      )) : (
                        <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>
                          <div style={{ fontSize: 24, marginBottom: 8 }}>👤</div>
                          No contacts found — add Hunter.io API key for real emails
                        </div>
                      )}
                    </div>
                  )}

                  {/* COMPETITORS */}
                  {tab === 'competitors' && result.competitor_intel && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {result.competitor_intel.main_competitors?.length > 0 && (
                        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                          <div style={{ fontSize: 11, color: '#555', letterSpacing: 1, marginBottom: 12 }}>MAIN COMPETITORS</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {result.competitor_intel.main_competitors.map((c, i) => (
                              <span key={i} style={{ fontSize: 13, padding: '6px 14px', background: '#ffffff08', border: `1px solid ${BORDER}`, borderRadius: 8 }}>{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.competitor_intel.competitor_advantages?.length > 0 && (
                        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                          <div style={{ fontSize: 11, color: '#ef4444', letterSpacing: 1, marginBottom: 12 }}>WHERE COMPETITORS BEAT THEM</div>
                          {result.competitor_intel.competitor_advantages.map((a, i) => <div key={i} style={{ fontSize: 13, color: '#aaa', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>⚠ {a}</div>)}
                        </div>
                      )}
                      {result.competitor_intel.gaps_you_can_exploit?.length > 0 && (
                        <div style={{ background: CARD, border: '1px solid #22c55e33', borderRadius: 12, padding: 20 }}>
                          <div style={{ fontSize: 11, color: '#22c55e', letterSpacing: 1, marginBottom: 12 }}>GAPS YOU CAN EXPLOIT</div>
                          {result.competitor_intel.gaps_you_can_exploit.map((g, i) => <div key={i} style={{ fontSize: 13, color: '#aaa', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>✓ {g}</div>)}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: 32, paddingBottom: 40 }}>
                    <button onClick={() => { setResult(null); setDomain(''); setChatOpen(false); setChatMessages([]); }} style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: '#555', borderRadius: 8, padding: '8px 20px', fontSize: 12, cursor: 'pointer' }}>← Scan Another Domain</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ LEAD FINDER MODE ══════════ */}
          {mode === 'finder' && (
            <div>
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>Describe the leads you want in plain language:</div>
                <textarea
                  value={finderPrompt}
                  onChange={e => setFinderPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.ctrlKey && findLeads()}
                  placeholder="e.g. Gyms in Dubai running Meta ads&#10;Ecommerce stores in UK spending on Google&#10;Restaurants in Skopje with no retargeting"
                  rows={3}
                  style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 14px', color: '#e8e8e8', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: '#444' }}>Ctrl+Enter to search</div>
                  <button onClick={findLeads} disabled={finderLoading || !finderPrompt.trim()} style={{ background: finderLoading ? '#222' : GOLD, color: finderLoading ? '#555' : '#000', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 800, fontSize: 13, cursor: finderLoading ? 'not-allowed' : 'pointer' }}>
                    {finderLoading ? 'Finding...' : '🎯 Find Leads'}
                  </button>
                </div>
              </div>

              {/* Example prompts */}
              {!finderResult && !finderLoading && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: '#444', letterSpacing: 1, marginBottom: 10 }}>EXAMPLE SEARCHES</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {finderExamples.map((ex, i) => (
                      <button key={i} onClick={() => setFinderPrompt(ex)} style={{ fontSize: 12, padding: '6px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, color: '#777', cursor: 'pointer' }}>
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {finderLoading && (
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
                  <div style={{ fontSize: 14, color: GOLD, fontWeight: 700, marginBottom: 6 }}>{loadingMsg}</div>
                  <div style={{ fontSize: 12, color: '#444' }}>Searching Meta, Google, LinkedIn — takes 30-90 seconds</div>
                  <div style={{ marginTop: 16, height: 3, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: GOLD, borderRadius: 3, animation: 'progress 90s linear forwards' }} />
                  </div>
                </div>
              )}

              {finderError && <div style={{ background: '#1a0000', border: '1px solid #ef444444', borderRadius: 10, padding: 16, color: '#ef4444', marginBottom: 24 }}>⚠ {finderError}</div>}

              {finderResult && !finderLoading && (
                <div>
                  {/* Results header */}
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18 }}>{finderResult.total_found || finderResult.leads?.length || 0} Leads Found</div>
                        <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{finderResult.search_summary}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {finderResult.data_sources && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            {finderResult.data_sources.meta_ads_found > 0 && <span style={{ fontSize: 10, padding: '3px 8px', background: '#22c55e22', border: '1px solid #22c55e33', borderRadius: 20, color: '#22c55e' }}>📘 Meta: {finderResult.data_sources.meta_ads_found}</span>}
                            {finderResult.data_sources.google_results_found > 0 && <span style={{ fontSize: 10, padding: '3px 8px', background: '#22c55e22', border: '1px solid #22c55e33', borderRadius: 20, color: '#22c55e' }}>🔍 Google: {finderResult.data_sources.google_results_found}</span>}
                            {finderResult.data_sources.linkedin_found > 0 && <span style={{ fontSize: 10, padding: '3px 8px', background: '#22c55e22', border: '1px solid #22c55e33', borderRadius: 20, color: '#22c55e' }}>💼 LinkedIn: {finderResult.data_sources.linkedin_found}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Leads list + detail */}
                  <div style={{ display: 'grid', gridTemplateColumns: selectedLead !== null ? '1fr 1fr' : '1fr', gap: 12 }}>
                    {/* Lead cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {finderResult.leads?.map((lead, i) => (
                        <div key={i} onClick={() => setSelectedLead(selectedLead === i ? null : i)} style={{ background: CARD, border: `1px solid ${selectedLead === i ? GOLD : BORDER}`, borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'border-color 0.2s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{lead.company_name}</div>
                              <div style={{ fontSize: 11, color: '#555' }}>{lead.domain} · {lead.location}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {lead.hot_lead && <span style={{ fontSize: 10, padding: '2px 8px', background: '#ef444422', border: '1px solid #ef444433', borderRadius: 20, color: '#ef4444', fontWeight: 700 }}>🔥 HOT</span>}
                              <div style={{ fontSize: 20, fontWeight: 800, color: lead.signal_score >= 70 ? '#22c55e' : lead.signal_score >= 40 ? GOLD : '#ef4444' }}>{lead.signal_score}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 10 }}>{lead.why_qualified}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {lead.ad_activity?.meta?.active && <span style={{ fontSize: 10, padding: '2px 8px', background: '#1877F222', border: '1px solid #1877F233', borderRadius: 20, color: '#5890ff' }}>📘 Meta: {lead.ad_activity.meta.spend_estimate}</span>}
                            {lead.ad_activity?.google?.active && <span style={{ fontSize: 10, padding: '2px 8px', background: '#EA433522', border: '1px solid #EA433533', borderRadius: 20, color: '#ff6b5b' }}>🔍 Google</span>}
                            {lead.ad_activity?.linkedin?.active && <span style={{ fontSize: 10, padding: '2px 8px', background: '#0A66C222', border: '1px solid #0A66C233', borderRadius: 20, color: '#4a9fe0' }}>💼 LinkedIn</span>}
                            {lead.contacts?.length > 0 && <span style={{ fontSize: 10, padding: '2px 8px', background: '#22c55e22', border: '1px solid #22c55e33', borderRadius: 20, color: '#22c55e' }}>✉ {lead.contacts.length} contacts</span>}
                          </div>
                          {lead.domain && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setMode('scanner'); setDomain(lead.domain); }}
                              style={{ marginTop: 10, background: `${GOLD}22`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                            >
                              Full Scan →
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Lead detail panel */}
                    {selectedLead !== null && finderResult.leads?.[selectedLead] && (
                      <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: 12, padding: 20, height: 'fit-content', position: 'sticky', top: 20 }}>
                        {(() => {
                          const lead = finderResult.leads[selectedLead];
                          return (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div style={{ fontWeight: 800, fontSize: 16 }}>{lead.company_name}</div>
                                <button onClick={() => setSelectedLead(null)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 20 }}>×</button>
                              </div>

                              {lead.pain_points?.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 8 }}>PAIN POINTS</div>
                                  {lead.pain_points.map((p, i) => (
                                    <div key={i} style={{ fontSize: 12, color: '#ef4444', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>⚠ {p}</div>
                                  ))}
                                </div>
                              )}

                              {lead.best_angle && (
                                <div style={{ marginBottom: 16, background: `${GOLD}11`, border: `1px solid ${GOLD}33`, borderRadius: 8, padding: 12 }}>
                                  <div style={{ fontSize: 10, color: GOLD, letterSpacing: 1, marginBottom: 6 }}>BEST ANGLE</div>
                                  <div style={{ fontSize: 13, color: '#ccc' }}>{lead.best_angle}</div>
                                </div>
                              )}

                              {lead.dm_opener && (
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div style={{ fontSize: 10, color: '#555', letterSpacing: 1 }}>DM OPENER</div>
                                    <button onClick={() => copyText(lead.dm_opener, `dm${selectedLead}`)} style={{ background: copied === `dm${selectedLead}` ? '#22c55e22' : '#ffffff08', border: `1px solid ${copied === `dm${selectedLead}` ? '#22c55e44' : BORDER}`, color: copied === `dm${selectedLead}` ? '#22c55e' : '#555', borderRadius: 6, padding: '3px 10px', fontSize: 10, cursor: 'pointer' }}>
                                      {copied === `dm${selectedLead}` ? '✓' : 'Copy'}
                                    </button>
                                  </div>
                                  <div style={{ fontSize: 12, color: '#ccc', background: '#0d0d0d', borderRadius: 8, padding: 12, lineHeight: 1.6 }}>{lead.dm_opener}</div>
                                </div>
                              )}

                              {lead.contacts?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 8 }}>CONTACTS</div>
                                  {lead.contacts.map((c, i) => (
                                    <div key={i} style={{ padding: '8px 12px', background: '#0d0d0d', borderRadius: 8, marginBottom: 6 }}>
                                      <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                                      <div style={{ fontSize: 11, color: '#555' }}>{c.title}</div>
                                      {c.email && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                          <div style={{ fontSize: 12, color: GOLD }}>{c.email}</div>
                                          <button onClick={() => copyText(c.email, `ce${i}`)} style={{ background: 'transparent', border: 'none', color: copied === `ce${i}` ? '#22c55e' : '#555', cursor: 'pointer', fontSize: 11 }}>{copied === `ce${i}` ? '✓' : 'copy'}</button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'center', marginTop: 24, paddingBottom: 40 }}>
                    <button onClick={() => { setFinderResult(null); setFinderPrompt(''); setSelectedLead(null); }} style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: '#555', borderRadius: 8, padding: '8px 20px', fontSize: 12, cursor: 'pointer' }}>← New Search</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI CHAT PANEL */}
      {chatOpen && result && (
        <div style={{ width: 400, minWidth: 400, background: '#0d0d0d', borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
          <div style={{ padding: '18px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${GOLD}22`, border: `1px solid ${GOLD}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>AI Analyst</div>
              <div style={{ fontSize: 11, color: '#555' }}>Analysing {result.company_name}</div>
            </div>
            <button onClick={() => setChatOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: 22 }}>×</button>
          </div>
          {chatMessages.length <= 1 && (
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: '#333', letterSpacing: 1, marginBottom: 8 }}>QUICK ACTIONS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {quickPrompts.map((p, i) => (
                  <button key={i} onClick={() => { setChatInput(p); setTimeout(() => chatInputRef.current?.focus(), 50); }} style={{ fontSize: 11, padding: '5px 10px', background: '#ffffff08', border: `1px solid ${BORDER}`, borderRadius: 6, color: '#777', cursor: 'pointer' }}>{p}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '88%', padding: '10px 14px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '2px 12px 12px 12px', background: m.role === 'user' ? `${GOLD}22` : '#1a1a1a', border: `1px solid ${m.role === 'user' ? `${GOLD}33` : BORDER}`, fontSize: 13, lineHeight: 1.6, color: '#ddd' }}>
                  <span dangerouslySetInnerHTML={{ __html: md(m.content) }} />
                </div>
                {m.role === 'assistant' && (
                  <button onClick={() => copyText(m.content, `msg${i}`)} style={{ marginTop: 3, background: 'transparent', border: 'none', color: '#333', cursor: 'pointer', fontSize: 10 }}>
                    {copied === `msg${i}` ? '✓ copied' : 'copy'}
                  </button>
                )}
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex', gap: 5, padding: '10px 14px', background: '#1a1a1a', borderRadius: '2px 12px 12px 12px', width: 'fit-content', border: `1px solid ${BORDER}` }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, animation: `bounce 1s infinite ${i * 0.2}s` }} />)}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={chatInputRef}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                placeholder="Ask anything about this company..."
                style={{ flex: 1, background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', color: '#e8e8e8', fontSize: 13, outline: 'none' }}
              />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{ background: chatLoading ? '#222' : GOLD, color: '#000', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 800, fontSize: 14, cursor: chatLoading ? 'not-allowed' : 'pointer' }}>→</button>
            </div>
            <div style={{ fontSize: 10, color: '#2a2a2a', marginTop: 6, textAlign: 'center' }}>Enter to send · Full company context loaded</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes progress { from{width:0%} to{width:95%} }
      `}</style>
    </div>
  );
}