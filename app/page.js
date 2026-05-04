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
  const [mode, setMode] = useState('scanner');

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
  const [finderMsg, setFinderMsg] = useState('');

  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  const scannerLoadingMsgs = ['Scraping Meta Ad Library...', 'Checking LinkedIn ads...', 'Running AI analysis...', 'Identifying pain points...', 'Building outreach...', 'Almost done...'];
  const finderLoadingMsgs = ['Parsing your search criteria...', 'Searching Apollo database (275M companies)...', 'Finding decision makers...', 'Checking Meta ad activity...', 'Qualifying leads with AI...', 'Building outreach messages...', 'Almost done...'];

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  useEffect(() => {
    if (chatOpen && result && chatMessages.length === 0) {
      setChatMessages([{ role: 'assistant', content: `I've fully analysed **${result.company_name}**.\n\n• **Signal Score:** ${result.signal_score}/100 ${result.hot_lead ? '🔥 Hot Lead' : ''}\n• **Industry:** ${result.industry}\n• **Active Platforms:** ${result.total_platforms_active}/5\n• **Pain Points:** ${countPainPoints(result.pain_points)} detected\n• **Biggest Opportunity:** ${result.biggest_opportunity || 'See solutions tab'}\n\nWhat do you want to do with this company?` }]);
    }
    if (chatOpen) setTimeout(() => chatInputRef.current?.focus(), 100);
  }, [chatOpen]);

  async function analyze() {
    const d = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!d) return;
    setLoading(true); setResult(null); setError(null); setTab('overview'); setChatMessages([]); setChatOpen(false);
    let idx = 0; setLoadingMsg(scannerLoadingMsgs[0]);
    const t = setInterval(() => { idx = Math.min(idx + 1, scannerLoadingMsgs.length - 1); setLoadingMsg(scannerLoadingMsgs[idx]); }, 10000);
    try {
      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: d }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) { setError(e.message); } finally { clearInterval(t); setLoading(false); }
  }

  async function findLeads() {
    if (!finderPrompt.trim()) return;
    setFinderLoading(true); setFinderResult(null); setFinderError(null); setSelectedLead(null);
    let idx = 0; setFinderMsg(finderLoadingMsgs[0]);
    const t = setInterval(() => { idx = Math.min(idx + 1, finderLoadingMsgs.length - 1); setFinderMsg(finderLoadingMsgs[idx]); }, 8000);
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: finderPrompt }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFinderResult(data);
    } catch (e) { setFinderError(e.message); } finally { clearInterval(t); setFinderLoading(false); }
  }

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    const msgs = [...chatMessages, { role: 'user', content: msg }];
    setChatMessages(msgs); setChatLoading(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs, companyContext: result }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChatMessages([...msgs, { role: 'assistant', content: data.reply }]);
    } catch (e) { setChatMessages([...msgs, { role: 'assistant', content: `Error: ${e.message}` }]); }
    finally { setChatLoading(false); }
  }

  function copyText(text, key) { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000); }
  function countPainPoints(pp) { if (!pp) return 0; return Object.values(pp).reduce((a, arr) => a + (Array.isArray(arr) ? arr.length : 0), 0); }
  function md(text) { return text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#F5B900">$1</strong>').replace(/\n/g, '<br/>'); }

  const scanTabs = ['overview', 'pain points', 'solutions', 'outreach', 'contacts', 'competitors'];
  const painCats = ['ads', 'website', 'seo', 'social_media', 'email_marketing', 'lead_generation', 'reputation', 'content', 'competitive', 'operations'];
  const quickPrompts = ['Write me a full proposal', 'Write a cold call script', 'Who should I contact first?', 'Write a WhatsApp message', 'Write a LinkedIn DM', 'What are their biggest weaknesses?', 'Compare to competitors', 'What services should I pitch?'];
  const examples = ['Gyms in Dubai running Meta ads', 'Ecommerce stores in UK', 'Restaurants in Skopje', 'Real estate agencies in UAE', 'Beauty salons in London', 'B2B companies in Germany', 'Car dealerships in Serbia', 'Hotels in Greece'];

  const S = { // shared styles
    card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 12 },
    btn: (active, col = GOLD) => ({ background: active ? `${col}22` : '#ffffff08', border: `1px solid ${active ? `${col}44` : BORDER}`, color: active ? col : '#555', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }),
  };

  return (
    <div style={{ minHeight: '100vh', background: DARK, color: '#e8e8e8', fontFamily: 'system-ui, sans-serif', display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, marginBottom: 6 }}>DIGITAL MA</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Agency Prospecting OS</h1>
            <p style={{ color: '#555', marginTop: 4, fontSize: 13 }}>Real company intelligence + Apollo-powered lead finder</p>
          </div>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 28, background: CARD, padding: 5, borderRadius: 12, border: `1px solid ${BORDER}`, width: 'fit-content' }}>
            {[['scanner', '🔍 Company Scanner'], ['finder', '🎯 Lead Finder']].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: mode === m ? GOLD : 'transparent', color: mode === m ? '#000' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>

          {/* ══ COMPANY SCANNER ══ */}
          {mode === 'scanner' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
                <input value={domain} onChange={e => setDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && analyze()} placeholder="Enter company domain e.g. nike.com" style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '13px 16px', color: '#e8e8e8', fontSize: 14, outline: 'none' }} />
                <button onClick={analyze} disabled={loading} style={{ background: loading ? '#222' : GOLD, color: loading ? '#555' : '#000', border: 'none', borderRadius: 10, padding: '13px 26px', fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', minWidth: 120 }}>
                  {loading ? 'Scanning...' : 'Scan →'}
                </button>
              </div>

              {loading && (
                <div style={{ ...S.card, textAlign: 'center', padding: 28 }}>
                  <div style={{ fontSize: 26, marginBottom: 10 }}>🔍</div>
                  <div style={{ fontSize: 14, color: GOLD, fontWeight: 700, marginBottom: 4 }}>{loadingMsg}</div>
                  <div style={{ fontSize: 12, color: '#444' }}>Pulling real data — 30-60 seconds</div>
                  <div style={{ marginTop: 14, height: 3, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: GOLD, borderRadius: 3, animation: 'progress 60s linear forwards' }} />
                  </div>
                </div>
              )}

              {error && <div style={{ background: '#1a0000', border: '1px solid #ef444444', borderRadius: 10, padding: 14, color: '#ef4444', marginBottom: 20 }}>⚠ {error}</div>}

              {result && (
                <div>
                  {/* Company header */}
                  <div style={{ ...S.card, marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                      <div style={{ textAlign: 'center', minWidth: 72 }}>
                        <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, color: result.signal_score >= 70 ? '#22c55e' : result.signal_score >= 40 ? GOLD : '#ef4444' }}>{result.signal_score}</div>
                        <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginTop: 3 }}>SIGNAL</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
                          <div style={{ fontSize: 20, fontWeight: 800 }}>{result.company_name}</div>
                          {result.hot_lead && <span style={{ background: '#ef444422', border: '1px solid #ef444466', borderRadius: 20, padding: '3px 10px', fontSize: 10, color: '#ef4444', fontWeight: 700 }}>🔥 HOT LEAD</span>}
                          <button onClick={() => setChatOpen(!chatOpen)} style={{ marginLeft: 'auto', background: chatOpen ? `${GOLD}22` : '#1a1a1a', border: `1px solid ${chatOpen ? GOLD : '#333'}`, color: chatOpen ? GOLD : '#888', borderRadius: 8, padding: '7px 14px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                            🤖 {chatOpen ? 'Close AI' : 'Ask AI'}
                          </button>
                        </div>
                        <div style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>{result.domain} · {result.industry} · {result.company_size} · {result.business_type} · {result.growth_stage}</div>
                        <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, marginBottom: 12 }}>{result.signal_summary}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {[['EST. REVENUE', result.estimated_revenue], ['IN BUSINESS', result.years_in_business], ['PLATFORMS', `${result.total_platforms_active || 0}/5`]].map(([l, v]) => (
                            <div key={l} style={{ background: '#ffffff08', borderRadius: 8, padding: '7px 12px' }}>
                              <div style={{ fontSize: 9, color: '#555', marginBottom: 1 }}>{l}</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{v || 'Unknown'}</div>
                            </div>
                          ))}
                          <div style={{ background: '#ef444411', borderRadius: 8, padding: '7px 12px', border: '1px solid #ef444433' }}>
                            <div style={{ fontSize: 9, color: '#555', marginBottom: 1 }}>PAIN POINTS</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{countPainPoints(result.pain_points)}</div>
                          </div>
                          <div style={{ background: result.platforms?.meta?.real_data ? '#22c55e11' : '#ffffff08', borderRadius: 8, padding: '7px 12px', border: result.platforms?.meta?.real_data ? '1px solid #22c55e33' : `1px solid ${BORDER}` }}>
                            <div style={{ fontSize: 9, color: '#555', marginBottom: 1 }}>META</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: result.platforms?.meta?.real_data ? '#22c55e' : '#555' }}>{result.platforms?.meta?.real_data ? '✓ Real' : '~ Est.'}</div>
                          </div>
                        </div>
                        {result.biggest_opportunity && (
                          <div style={{ marginTop: 10, background: `${GOLD}11`, border: `1px solid ${GOLD}33`, borderRadius: 8, padding: '9px 12px' }}>
                            <span style={{ fontSize: 9, color: GOLD, letterSpacing: 1, fontWeight: 700 }}>BIGGEST OPPORTUNITY: </span>
                            <span style={{ fontSize: 12, color: '#ccc' }}>{result.biggest_opportunity}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
                    {scanTabs.map(t => (
                      <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? `${GOLD}22` : 'transparent', border: `1px solid ${tab === t ? `${GOLD}66` : BORDER}`, color: tab === t ? GOLD : '#555', borderRadius: 8, padding: '7px 14px', fontSize: 11, cursor: 'pointer', fontWeight: tab === t ? 700 : 400, textTransform: 'uppercase' }}>{t}</button>
                    ))}
                  </div>

                  {/* OVERVIEW */}
                  {tab === 'overview' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10, marginBottom: 14 }}>
                        {['meta', 'google', 'linkedin', 'tiktok', 'youtube'].map(p => (
                          <div key={p} style={{ background: CARD, border: `1px solid ${result.platforms?.[p]?.active_last_30_days ? '#22c55e33' : BORDER}`, borderRadius: 12, padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <div style={{ fontWeight: 700, textTransform: 'capitalize', fontSize: 12 }}>{platformIcons[p]} {p}</div>
                              <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, background: result.platforms?.[p]?.active_last_30_days ? '#22c55e22' : '#ef444422', color: result.platforms?.[p]?.active_last_30_days ? '#22c55e' : '#ef4444' }}>
                                {result.platforms?.[p]?.active_last_30_days ? '🔥 ACTIVE' : 'INACTIVE'}
                              </div>
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: result.platforms?.[p]?.active_last_30_days ? GOLD : '#333' }}>{result.platforms?.[p]?.ad_count || '0'}</div>
                            <div style={{ fontSize: 9, color: '#555', marginBottom: 5 }}>ADS (30 DAYS)</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#ccc' }}>{result.platforms?.[p]?.spend_estimate || '—'}</div>
                            <div style={{ fontSize: 9, color: '#555', marginBottom: 5 }}>EST. SPEND/MO</div>
                            {result.platforms?.[p]?.last_ad_date && <div style={{ fontSize: 9, color: result.platforms?.[p]?.active_last_30_days ? '#22c55e' : '#ef4444', marginBottom: 3 }}>Last: {result.platforms[p].last_ad_date}</div>}
                            {p === 'meta' && <div style={{ marginTop: 5, fontSize: 9, padding: '2px 6px', borderRadius: 20, display: 'inline-block', background: result.platforms?.meta?.real_data ? '#22c55e22' : '#ffffff08', color: result.platforms?.meta?.real_data ? '#22c55e' : '#555', border: `1px solid ${result.platforms?.meta?.real_data ? '#22c55e44' : '#333'}` }}>{result.platforms?.meta?.real_data ? '✓ REAL' : '~ EST.'}</div>}
                          </div>
                        ))}
                      </div>

                      {result.meta_ads_raw?.length > 0 && (
                        <div style={{ ...S.card, border: '1px solid #22c55e33' }}>
                          <div style={{ fontSize: 10, color: '#22c55e', letterSpacing: 1, marginBottom: 12 }}>✓ REAL META ADS ({result.meta_ads_raw.length})</div>
                          {result.meta_ads_raw.map((ad, i) => (
                            <div key={i} style={{ padding: '10px 12px', background: '#ffffff05', borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{ad.page || 'Unknown'}</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  {ad.started && <span style={{ fontSize: 10, color: '#555' }}>Since: {ad.started}</span>}
                                  {ad.snapshot && <a href={ad.snapshot} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: GOLD, textDecoration: 'none', padding: '2px 7px', border: `1px solid ${GOLD}44`, borderRadius: 4 }}>View →</a>}
                                </div>
                              </div>
                              {ad.body && <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>"{ad.body.slice(0, 120)}{ad.body.length > 120 ? '...' : ''}"</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {result.services_to_pitch?.length > 0 && (
                        <div style={S.card}>
                          <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 12 }}>SERVICES TO PITCH</div>
                          {result.services_to_pitch.map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#ffffff05', borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 6 }}>
                              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: `${priorityColor[s.priority] || GOLD}22`, color: priorityColor[s.priority] || GOLD, fontWeight: 700, minWidth: 45, textAlign: 'center' }}>{s.priority?.toUpperCase()}</span>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 12 }}>{s.service}</div>
                                <div style={{ fontSize: 11, color: '#666' }}>{s.reason}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {result.intent_signals?.length > 0 && (
                        <div style={S.card}>
                          <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 12 }}>INTENT SIGNALS</div>
                          {result.intent_signals.map((s, i) => (
                            <div key={i} style={{ padding: '9px 12px', background: '#22c55e08', border: '1px solid #22c55e22', borderRadius: 8, marginBottom: 6 }}>
                              <div style={{ fontWeight: 700, fontSize: 12, color: '#22c55e' }}>{s.signal || s}</div>
                              {s.meaning && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{s.meaning}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PAIN POINTS */}
                  {tab === 'pain points' && (
                    <div>
                      <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
                        {painCats.map(c => (
                          <button key={c} onClick={() => setPainTab(c)} style={{ background: painTab === c ? '#ef444422' : 'transparent', border: `1px solid ${painTab === c ? '#ef444466' : BORDER}`, color: painTab === c ? '#ef4444' : '#555', borderRadius: 8, padding: '5px 10px', fontSize: 10, cursor: 'pointer' }}>
                            {c.replace(/_/g, ' ').toUpperCase()} {result.pain_points?.[c]?.length > 0 && `(${result.pain_points[c].length})`}
                          </button>
                        ))}
                      </div>
                      {result.pain_points?.[painTab]?.length > 0 ? result.pain_points[painTab].map((p, i) => (
                        <div key={i} style={{ background: CARD, border: `1px solid ${severityColor[p.severity] || BORDER}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 7 }}>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <span style={{ fontSize: 9, padding: '3px 7px', borderRadius: 20, background: severityBg[p.severity] || '#ffffff08', color: severityColor[p.severity] || '#888', fontWeight: 700, minWidth: 45, textAlign: 'center', flexShrink: 0 }}>{p.severity?.toUpperCase()}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{p.issue}</div>
                              {p.fix && <div style={{ fontSize: 11, color: '#22c55e' }}>✓ {p.fix}</div>}
                            </div>
                          </div>
                        </div>
                      )) : <div style={{ color: '#555', textAlign: 'center', padding: 32 }}>No issues in this category</div>}
                    </div>
                  )}

                  {/* SOLUTIONS */}
                  {tab === 'solutions' && result.solutions && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ background: '#ef444411', border: '1px solid #ef444433', borderRadius: 12, padding: 18 }}>
                        <div style={{ fontSize: 10, color: '#ef4444', letterSpacing: 1, marginBottom: 7 }}>🎯 TOP PRIORITY</div>
                        <p style={{ fontSize: 13, color: '#e8e8e8', lineHeight: 1.7, margin: 0 }}>{result.solutions.priority_action}</p>
                      </div>
                      {result.solutions.roi_projection && (
                        <div style={{ background: '#22c55e11', border: '1px solid #22c55e33', borderRadius: 12, padding: 18 }}>
                          <div style={{ fontSize: 10, color: '#22c55e', letterSpacing: 1, marginBottom: 7 }}>📈 ROI PROJECTION</div>
                          <p style={{ fontSize: 13, color: '#e8e8e8', lineHeight: 1.7, margin: 0 }}>{result.solutions.roi_projection}</p>
                        </div>
                      )}
                      {['quick_wins', 'short_term', 'long_term'].map(section => result.solutions[section]?.length > 0 && (
                        <div key={section} style={S.card}>
                          <div style={{ fontSize: 10, color: GOLD, letterSpacing: 1, marginBottom: 12 }}>{section === 'quick_wins' ? '⚡ QUICK WINS' : section === 'short_term' ? '📅 SHORT TERM' : '🚀 LONG TERM'}</div>
                          {result.solutions[section].map((s, i) => (
                            <div key={i} style={{ padding: '12px 14px', background: '#ffffff05', borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 7 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{s.action}</div>
                                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: '#ffffff08', color: '#aaa', flexShrink: 0 }}>{s.timeframe}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
                                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: severityBg[s.impact], color: severityColor[s.impact] }}>Impact: {s.impact}</span>
                                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: '#ffffff08', color: '#888' }}>Effort: {s.effort}</span>
                              </div>
                              <p style={{ fontSize: 11, color: '#888', lineHeight: 1.6, margin: 0 }}>{s.description}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                      {result.solutions.agency_pitch && (
                        <div style={{ background: `${GOLD}11`, border: `1px solid ${GOLD}33`, borderRadius: 12, padding: 18 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ fontSize: 10, color: GOLD, letterSpacing: 1 }}>💼 AGENCY PITCH</div>
                            <button onClick={() => copyText(result.solutions.agency_pitch, 'pitch')} style={S.btn(copied === 'pitch', '#22c55e')}>{copied === 'pitch' ? '✓ Copied' : 'Copy'}</button>
                          </div>
                          <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.8, margin: 0 }}>{result.solutions.agency_pitch}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* OUTREACH */}
                  {tab === 'outreach' && result.outreach && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ ...S.card, border: `1px solid ${GOLD}33` }}>
                        <div style={{ fontSize: 10, color: GOLD, letterSpacing: 1, marginBottom: 7 }}>BEST CHANNEL</div>
                        <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'uppercase', marginBottom: 5 }}>{result.outreach.best_channel?.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: 12, color: '#aaa' }}>{result.outreach.best_angle}</div>
                      </div>
                      {[['dm_opener', '💬 DM'], ['whatsapp_message', '📱 WHATSAPP'], ['call_script', '📞 CALL SCRIPT']].map(([key, label]) => result.outreach[key] && (
                        <div key={key} style={S.card}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ fontSize: 10, color: '#555', letterSpacing: 1 }}>{label}</div>
                            <button onClick={() => copyText(result.outreach[key], key)} style={S.btn(copied === key, '#22c55e')}>{copied === key ? '✓ Copied' : 'Copy'}</button>
                          </div>
                          <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.7, margin: 0 }}>{result.outreach[key]}</p>
                        </div>
                      ))}
                      {result.outreach.email_subject && (
                        <div style={S.card}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ fontSize: 10, color: '#555', letterSpacing: 1 }}>📧 EMAIL</div>
                            <button onClick={() => copyText(`Subject: ${result.outreach.email_subject}\n\n${result.outreach.email_body}`, 'email')} style={S.btn(copied === 'email', '#22c55e')}>{copied === 'email' ? '✓ Copied' : 'Copy'}</button>
                          </div>
                          <div style={{ fontSize: 11, color: GOLD, marginBottom: 8, fontWeight: 700 }}>Subject: {result.outreach.email_subject}</div>
                          <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.7, margin: 0 }}>{result.outreach.email_body}</p>
                        </div>
                      )}
                      {result.outreach.objections?.length > 0 && (
                        <div style={S.card}>
                          <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 12 }}>🛡 OBJECTION HANDLER</div>
                          {result.outreach.objections.map((o, i) => (
                            <div key={i} style={{ padding: '10px 12px', background: '#ffffff05', borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 7 }}>
                              <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, marginBottom: 5 }}>"{o.objection}"</div>
                              <div style={{ fontSize: 11, color: '#22c55e' }}>→ {o.response}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CONTACTS */}
                  {tab === 'contacts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {result.contacts?.length > 0 ? result.contacts.map((c, i) => (
                        <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: '#555', marginBottom: 5 }}>{c.title}</div>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {c.best_channel && <span style={{ fontSize: 9, padding: '2px 7px', background: `${GOLD}11`, border: `1px solid ${GOLD}33`, borderRadius: 20, color: GOLD }}>Best: {c.best_channel}</span>}
                              {c.decision_maker_score && <span style={{ fontSize: 9, padding: '2px 7px', background: '#ffffff08', border: `1px solid ${BORDER}`, borderRadius: 20, color: c.decision_maker_score >= 8 ? '#22c55e' : '#888' }}>Score: {c.decision_maker_score}/10</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {c.email && <div style={{ fontSize: 12, color: GOLD, marginBottom: 5 }}>{c.email}</div>}
                            {c.email && <button onClick={() => copyText(c.email, `e${i}`)} style={S.btn(copied === `e${i}`, '#22c55e')}>{copied === `e${i}` ? '✓' : 'Copy'}</button>}
                          </div>
                        </div>
                      )) : <div style={{ color: '#555', textAlign: 'center', padding: 32 }}>No contacts found — check Hunter.io API key</div>}
                    </div>
                  )}

                  {/* COMPETITORS */}
                  {tab === 'competitors' && result.competitor_intel && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {result.competitor_intel.main_competitors?.length > 0 && (
                        <div style={S.card}>
                          <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 10 }}>MAIN COMPETITORS</div>
                          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            {result.competitor_intel.main_competitors.map((c, i) => <span key={i} style={{ fontSize: 12, padding: '5px 12px', background: '#ffffff08', border: `1px solid ${BORDER}`, borderRadius: 8 }}>{c}</span>)}
                          </div>
                        </div>
                      )}
                      {result.competitor_intel.competitor_advantages?.length > 0 && (
                        <div style={S.card}>
                          <div style={{ fontSize: 10, color: '#ef4444', letterSpacing: 1, marginBottom: 10 }}>WHERE COMPETITORS BEAT THEM</div>
                          {result.competitor_intel.competitor_advantages.map((a, i) => <div key={i} style={{ fontSize: 12, color: '#aaa', padding: '7px 0', borderBottom: `1px solid ${BORDER}` }}>⚠ {a}</div>)}
                        </div>
                      )}
                      {result.competitor_intel.gaps_you_can_exploit?.length > 0 && (
                        <div style={{ ...S.card, border: '1px solid #22c55e33' }}>
                          <div style={{ fontSize: 10, color: '#22c55e', letterSpacing: 1, marginBottom: 10 }}>GAPS YOU CAN EXPLOIT</div>
                          {result.competitor_intel.gaps_you_can_exploit.map((g, i) => <div key={i} style={{ fontSize: 12, color: '#aaa', padding: '7px 0', borderBottom: `1px solid ${BORDER}` }}>✓ {g}</div>)}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: 28, paddingBottom: 40 }}>
                    <button onClick={() => { setResult(null); setDomain(''); setChatOpen(false); setChatMessages([]); }} style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: '#555', borderRadius: 8, padding: '7px 18px', fontSize: 11, cursor: 'pointer' }}>← Scan Another Domain</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ LEAD FINDER ══ */}
          {mode === 'finder' && (
            <div>
              <div style={{ ...S.card, marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>Describe the leads you want — industry, location, platform, any criteria:</div>
                <textarea
                  value={finderPrompt}
                  onChange={e => setFinderPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.ctrlKey && findLeads()}
                  placeholder={'e.g. Gyms in Dubai running Meta ads\nRestaurants in London with no email marketing\nB2B companies in Germany on LinkedIn'}
                  rows={3}
                  style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '11px 13px', color: '#e8e8e8', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: '#333' }}>Ctrl+Enter to search · Powered by Apollo.io (275M companies)</div>
                  <button onClick={findLeads} disabled={finderLoading || !finderPrompt.trim()} style={{ background: finderLoading ? '#222' : GOLD, color: finderLoading ? '#555' : '#000', border: 'none', borderRadius: 8, padding: '9px 22px', fontWeight: 800, fontSize: 13, cursor: finderLoading ? 'not-allowed' : 'pointer' }}>
                    {finderLoading ? 'Searching...' : '🎯 Find Leads'}
                  </button>
                </div>
              </div>

              {!finderResult && !finderLoading && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: '#333', letterSpacing: 1, marginBottom: 8 }}>EXAMPLE SEARCHES</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {examples.map((ex, i) => (
                      <button key={i} onClick={() => setFinderPrompt(ex)} style={{ fontSize: 11, padding: '5px 12px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, color: '#666', cursor: 'pointer' }}>{ex}</button>
                    ))}
                  </div>
                </div>
              )}

              {finderLoading && (
                <div style={{ ...S.card, textAlign: 'center', padding: 32 }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>🎯</div>
                  <div style={{ fontSize: 14, color: GOLD, fontWeight: 700, marginBottom: 4 }}>{finderMsg}</div>
                  <div style={{ fontSize: 11, color: '#444' }}>Searching Apollo database + Meta Ad Library — 30-90 seconds</div>
                  <div style={{ marginTop: 14, height: 3, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: GOLD, borderRadius: 3, animation: 'progress 90s linear forwards' }} />
                  </div>
                </div>
              )}

              {finderError && <div style={{ background: '#1a0000', border: '1px solid #ef444444', borderRadius: 10, padding: 14, color: '#ef4444', marginBottom: 16 }}>⚠ {finderError}</div>}

              {finderResult && !finderLoading && (
                <div>
                  {/* Results header */}
                  <div style={{ ...S.card, marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18 }}>{finderResult.total_found || finderResult.leads?.length || 0} Leads Found</div>
                        <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{finderResult.search_summary}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {finderResult.apollo_results && (
                          <>
                            {finderResult.apollo_results.people_found > 0 && <span style={{ fontSize: 10, padding: '3px 8px', background: '#22c55e22', border: '1px solid #22c55e33', borderRadius: 20, color: '#22c55e' }}>👤 {finderResult.apollo_results.people_found} contacts</span>}
                            {finderResult.apollo_results.orgs_found > 0 && <span style={{ fontSize: 10, padding: '3px 8px', background: '#22c55e22', border: '1px solid #22c55e33', borderRadius: 20, color: '#22c55e' }}>🏢 {finderResult.apollo_results.orgs_found} companies</span>}
                          </>
                        )}
                        <span style={{ fontSize: 10, padding: '3px 8px', background: '#ffffff08', border: `1px solid ${BORDER}`, borderRadius: 20, color: '#555' }}>Apollo.io ✓</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: selectedLead !== null ? '1fr 1fr' : '1fr', gap: 12 }}>
                    {/* Lead cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {finderResult.leads?.map((lead, i) => (
                        <div key={i} onClick={() => setSelectedLead(selectedLead === i ? null : i)} style={{ background: CARD, border: `1px solid ${selectedLead === i ? GOLD : BORDER}`, borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'border-color 0.2s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{lead.company_name}</div>
                              <div style={{ fontSize: 11, color: '#555' }}>{lead.domain} · {lead.location}</div>
                              {lead.company_size && <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>{lead.company_size} employees{lead.estimated_revenue ? ` · ${lead.estimated_revenue}` : ''}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                              {lead.hot_lead && <span style={{ fontSize: 9, padding: '2px 7px', background: '#ef444422', border: '1px solid #ef444433', borderRadius: 20, color: '#ef4444', fontWeight: 700 }}>🔥</span>}
                              <div style={{ fontSize: 20, fontWeight: 800, color: lead.signal_score >= 70 ? '#22c55e' : lead.signal_score >= 40 ? GOLD : '#ef4444' }}>{lead.signal_score}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: '#888', marginBottom: 10, lineHeight: 1.5 }}>{lead.why_qualified}</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {lead.ad_activity?.meta?.active && <span style={{ fontSize: 9, padding: '2px 7px', background: '#1877F222', border: '1px solid #1877F233', borderRadius: 20, color: '#5890ff' }}>📘 Meta{lead.ad_activity.meta.real_data ? ' ✓' : ''}</span>}
                            {lead.ad_activity?.google?.active && <span style={{ fontSize: 9, padding: '2px 7px', background: '#EA433522', border: '1px solid #EA433533', borderRadius: 20, color: '#ff6b5b' }}>🔍 Google</span>}
                            {lead.ad_activity?.linkedin?.active && <span style={{ fontSize: 9, padding: '2px 7px', background: '#0A66C222', border: '1px solid #0A66C233', borderRadius: 20, color: '#4a9fe0' }}>💼 LinkedIn</span>}
                            {lead.contacts?.length > 0 && <span style={{ fontSize: 9, padding: '2px 7px', background: '#22c55e22', border: '1px solid #22c55e33', borderRadius: 20, color: '#22c55e' }}>✉ {lead.contacts.length} contacts</span>}
                            {lead.technologies_detected?.slice(0, 2).map((t, ti) => <span key={ti} style={{ fontSize: 9, padding: '2px 7px', background: '#ffffff08', border: `1px solid ${BORDER}`, borderRadius: 20, color: '#666' }}>{t}</span>)}
                          </div>
                          {lead.domain && (
                            <button onClick={(e) => { e.stopPropagation(); setMode('scanner'); setDomain(lead.domain); }} style={{ marginTop: 10, background: `${GOLD}22`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: 6, padding: '4px 10px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>
                              Full Scan →
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Detail panel */}
                    {selectedLead !== null && finderResult.leads?.[selectedLead] && (() => {
                      const lead = finderResult.leads[selectedLead];
                      return (
                        <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: 12, padding: 20, height: 'fit-content', position: 'sticky', top: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div style={{ fontWeight: 800, fontSize: 15 }}>{lead.company_name}</div>
                            <button onClick={() => setSelectedLead(null)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 20 }}>×</button>
                          </div>

                          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                            {lead.linkedin_url && <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, padding: '3px 9px', background: '#0A66C222', border: '1px solid #0A66C244', borderRadius: 20, color: '#4a9fe0', textDecoration: 'none' }}>LinkedIn →</a>}
                            {lead.domain && <a href={`https://${lead.domain}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, padding: '3px 9px', background: '#ffffff08', border: `1px solid ${BORDER}`, borderRadius: 20, color: '#888', textDecoration: 'none' }}>Website →</a>}
                          </div>

                          {lead.pain_points?.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 7 }}>PAIN POINTS</div>
                              {lead.pain_points.map((p, i) => <div key={i} style={{ fontSize: 11, color: '#ef4444', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>⚠ {p}</div>)}
                            </div>
                          )}

                          {lead.best_angle && (
                            <div style={{ marginBottom: 14, background: `${GOLD}11`, border: `1px solid ${GOLD}33`, borderRadius: 8, padding: 11 }}>
                              <div style={{ fontSize: 9, color: GOLD, letterSpacing: 1, marginBottom: 5 }}>BEST ANGLE</div>
                              <div style={{ fontSize: 12, color: '#ccc' }}>{lead.best_angle}</div>
                            </div>
                          )}

                          {lead.dm_opener && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                                <div style={{ fontSize: 9, color: '#555', letterSpacing: 1 }}>💬 DM OPENER</div>
                                <button onClick={() => copyText(lead.dm_opener, `dm${selectedLead}`)} style={S.btn(copied === `dm${selectedLead}`, '#22c55e')}>{copied === `dm${selectedLead}` ? '✓' : 'Copy'}</button>
                              </div>
                              <div style={{ fontSize: 11, color: '#ccc', background: '#0d0d0d', borderRadius: 8, padding: 11, lineHeight: 1.6 }}>{lead.dm_opener}</div>
                            </div>
                          )}

                          {lead.whatsapp_message && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                                <div style={{ fontSize: 9, color: '#555', letterSpacing: 1 }}>📱 WHATSAPP</div>
                                <button onClick={() => copyText(lead.whatsapp_message, `wa${selectedLead}`)} style={S.btn(copied === `wa${selectedLead}`, '#22c55e')}>{copied === `wa${selectedLead}` ? '✓' : 'Copy'}</button>
                              </div>
                              <div style={{ fontSize: 11, color: '#ccc', background: '#0d0d0d', borderRadius: 8, padding: 11, lineHeight: 1.6 }}>{lead.whatsapp_message}</div>
                            </div>
                          )}

                          {lead.meta_ads_preview?.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 9, color: '#22c55e', letterSpacing: 1, marginBottom: 7 }}>✓ REAL META ADS</div>
                              {lead.meta_ads_preview.map((ad, i) => (
                                <div key={i} style={{ fontSize: 11, color: '#888', background: '#0d0d0d', borderRadius: 6, padding: '7px 10px', marginBottom: 5 }}>
                                  <div style={{ fontWeight: 700, color: '#ccc', marginBottom: 2 }}>{ad.page}</div>
                                  {ad.body && <div style={{ fontStyle: 'italic' }}>"{ad.body}"</div>}
                                  {ad.snapshot && <a href={ad.snapshot} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: GOLD, textDecoration: 'none' }}>View ad →</a>}
                                </div>
                              ))}
                            </div>
                          )}

                          {lead.contacts?.length > 0 && (
                            <div>
                              <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 7 }}>CONTACTS</div>
                              {lead.contacts.map((c, i) => (
                                <div key={i} style={{ padding: '8px 11px', background: '#0d0d0d', borderRadius: 8, marginBottom: 5 }}>
                                  <div style={{ fontWeight: 700, fontSize: 12 }}>{c.name}</div>
                                  <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>{c.title}</div>
                                  {c.email && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ fontSize: 11, color: GOLD }}>{c.email}</div>
                                      <button onClick={() => copyText(c.email, `ce${i}`)} style={{ background: 'transparent', border: 'none', color: copied === `ce${i}` ? '#22c55e' : '#555', cursor: 'pointer', fontSize: 10 }}>{copied === `ce${i}` ? '✓' : 'copy'}</button>
                                    </div>
                                  )}
                                  {c.phone && <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>📞 {c.phone}</div>}
                                  {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: '#4a9fe0', textDecoration: 'none', display: 'block', marginTop: 2 }}>LinkedIn →</a>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ textAlign: 'center', marginTop: 20, paddingBottom: 40 }}>
                    <button onClick={() => { setFinderResult(null); setFinderPrompt(''); setSelectedLead(null); }} style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: '#555', borderRadius: 8, padding: '7px 18px', fontSize: 11, cursor: 'pointer' }}>← New Search</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI CHAT */}
      {chatOpen && result && (
        <div style={{ width: 390, minWidth: 390, background: '#0d0d0d', borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${GOLD}22`, border: `1px solid ${GOLD}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>AI Analyst</div>
              <div style={{ fontSize: 10, color: '#555' }}>{result.company_name}</div>
            </div>
            <button onClick={() => setChatOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: 20 }}>×</button>
          </div>
          {chatMessages.length <= 1 && (
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {quickPrompts.map((p, i) => <button key={i} onClick={() => { setChatInput(p); setTimeout(() => chatInputRef.current?.focus(), 50); }} style={{ fontSize: 10, padding: '4px 9px', background: '#ffffff08', border: `1px solid ${BORDER}`, borderRadius: 6, color: '#666', cursor: 'pointer' }}>{p}</button>)}
              </div>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '88%', padding: '9px 13px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '2px 12px 12px 12px', background: m.role === 'user' ? `${GOLD}22` : '#1a1a1a', border: `1px solid ${m.role === 'user' ? `${GOLD}33` : BORDER}`, fontSize: 12, lineHeight: 1.6, color: '#ddd' }}>
                  <span dangerouslySetInnerHTML={{ __html: md(m.content) }} />
                </div>
                {m.role === 'assistant' && <button onClick={() => copyText(m.content, `msg${i}`)} style={{ marginTop: 2, background: 'transparent', border: 'none', color: '#333', cursor: 'pointer', fontSize: 10 }}>{copied === `msg${i}` ? '✓' : 'copy'}</button>}
              </div>
            ))}
            {chatLoading && <div style={{ display: 'flex', gap: 4, padding: '9px 13px', background: '#1a1a1a', borderRadius: '2px 12px 12px 12px', width: 'fit-content', border: `1px solid ${BORDER}` }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD, animation: `bounce 1s infinite ${i * 0.2}s` }} />)}</div>}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 7 }}>
              <input ref={chatInputRef} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()} placeholder="Ask anything..." style={{ flex: 1, background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 11px', color: '#e8e8e8', fontSize: 12, outline: 'none' }} />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{ background: chatLoading ? '#222' : GOLD, color: '#000', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 800, fontSize: 13, cursor: chatLoading ? 'not-allowed' : 'pointer' }}>→</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes progress{from{width:0%}to{width:95%}}`}</style>
    </div>
  );
}