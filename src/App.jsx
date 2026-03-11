import { useState, useEffect, useCallback } from 'react'
import {
  Search, Bookmark, BookmarkCheck, Tag, Filter, RefreshCw,
  Eye, Calendar, ExternalLink, Settings, X, ChevronDown,
  TrendingUp, Zap, Play, Heart, MessageCircle, Share2, AlertCircle
} from 'lucide-react'

// ── 카테고리 프리셋 ──────────────────────────────────────────────
const CATEGORIES = [
  { id: 'parenting', label: '육아·교육', keywords: ['parenting tips', 'kids education', 'children learning', 'mom life'] },
  { id: 'info', label: '정보·꿀팁', keywords: ['life hacks', 'tips and tricks', 'useful tips', 'how to'] },
  { id: 'emotion', label: '감동·공감', keywords: ['heartwarming', 'emotional story', 'inspiring', 'relatable'] },
  { id: 'food', label: '음식·요리', keywords: ['recipe', 'cooking tips', 'food hack', 'easy recipe'] },
  { id: 'before_after', label: '비포/애프터', keywords: ['before and after', 'transformation', 'glow up'] },
  { id: 'kids_art', label: '아이 미술·창의', keywords: ['kids art', 'children drawing', 'art for kids', 'creative kids'] },
  { id: 'custom', label: '직접 입력', keywords: [] },
]

// ── 훅 태그 옵션 ─────────────────────────────────────────────────
const HOOK_TAGS = ['충격/반전', '공감유도', '궁금증 유발', '숫자/통계', '비포/애프터', '질문형', '스토리텔링']
const FORMAT_TAGS = ['정보나열', '인터뷰', '보이스오버', '자막만', '반응형', '튜토리얼', '브이로그']

// ── API 호출 (RapidAPI TikTok Scraper7) ─────────────────────────
async function fetchTikTokVideos(keyword, apiKey, minViews = 500000) {
  const url = `https://tiktok-scraper7.p.rapidapi.com/feed/search?keywords=${encodeURIComponent(keyword)}&region=KR&count=20&cursor=0&publish_time=0&sort_type=1`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com'
    }
  })
  if (!res.ok) throw new Error(`API 오류: ${res.status}`)
  const data = await res.json()

  const threeWeeksAgo = Date.now() / 1000 - 21 * 24 * 60 * 60
  const videos = (data?.data?.videos || [])
    .filter(v => v.play_count >= minViews && v.create_time >= threeWeeksAgo)
    .map(v => ({
      id: v.video_id,
      title: v.title || v.desc || '(제목 없음)',
      author: v.author?.nickname || v.author?.unique_id || '알 수 없음',
      authorHandle: v.author?.unique_id || '',
      thumbnail: v.cover,
      views: v.play_count,
      likes: v.digg_count,
      comments: v.comment_count,
      shares: v.share_count,
      date: v.create_time,
      url: `https://www.tiktok.com/@${v.author?.unique_id}/video/${v.video_id}`,
      duration: v.duration,
      music: v.music?.title || '',
    }))

  return videos
}

// ── 숫자 포맷 ────────────────────────────────────────────────────
function fmt(n) {
  if (!n) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K'
  return n.toString()
}

function fmtDate(ts) {
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function daysAgo(ts) {
  return Math.floor((Date.now() / 1000 - ts) / 86400)
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rl_apikey') || '')
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('rl_apikey'))
  const [apiKeyInput, setApiKeyInput] = useState('')

  const [tab, setTab] = useState('search') // 'search' | 'saved'
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0])
  const [customKeyword, setCustomKeyword] = useState('')
  const [minViews, setMinViews] = useState(500000)

  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rl_saved') || '[]') } catch { return [] }
  })
  const [tags, setTags] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rl_tags') || '{}') } catch { return {} }
  })
  const [tagModal, setTagModal] = useState(null) // video id

  // persist
  useEffect(() => { localStorage.setItem('rl_saved', JSON.stringify(saved)) }, [saved])
  useEffect(() => { localStorage.setItem('rl_tags', JSON.stringify(tags)) }, [tags])

  const saveApiKey = () => {
    if (!apiKeyInput.trim()) return
    localStorage.setItem('rl_apikey', apiKeyInput.trim())
    setApiKey(apiKeyInput.trim())
    setShowSettings(false)
  }

  const handleSearch = async () => {
    if (!apiKey) { setShowSettings(true); return }
    const keyword = selectedCategory.id === 'custom'
      ? customKeyword
      : selectedCategory.keywords[Math.floor(Math.random() * selectedCategory.keywords.length)]
    if (!keyword) { setError('키워드를 입력해주세요'); return }

    setLoading(true); setError(''); setVideos([]); setSearched(true)
    try {
      const results = await fetchTikTokVideos(keyword, apiKey, minViews)
      setVideos(results)
      if (results.length === 0) setError('조건에 맞는 영상이 없어요. 필터를 낮춰보세요.')
    } catch (e) {
      setError(`오류: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleSave = (video) => {
    setSaved(prev => {
      const exists = prev.find(v => v.id === video.id)
      return exists ? prev.filter(v => v.id !== video.id) : [...prev, video]
    })
  }

  const isSaved = (id) => saved.some(v => v.id === id)

  const setVideoTag = (videoId, type, value) => {
    setTags(prev => ({
      ...prev,
      [videoId]: {
        ...prev[videoId],
        [type]: prev[videoId]?.[type] === value ? null : value
      }
    }))
  }

  const displayVideos = tab === 'saved' ? saved : videos
  const taggedVideo = tagModal ? (displayVideos.find(v => v.id === tagModal) || saved.find(v => v.id === tagModal)) : null

  return (
    <div style={s.root}>
      {/* ── 헤더 ── */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.logo}>REELS<span style={{ color: 'var(--accent)' }}>LAB</span></span>
          <span style={s.logoSub}>틱톡 트렌드 레퍼런스 수집기</span>
        </div>
        <div style={s.headerRight}>
          <div style={s.tabs}>
            {[['search', <TrendingUp size={13} />, '탐색'], ['saved', <Bookmark size={13} />, `저장 ${saved.length}`]].map(([id, icon, label]) => (
              <button key={id} style={{ ...s.tabBtn, ...(tab === id ? s.tabBtnActive : {}) }} onClick={() => setTab(id)}>
                {icon}{label}
              </button>
            ))}
          </div>
          <button style={s.settingsBtn} onClick={() => setShowSettings(true)}>
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* ── 설정 모달 (API 키) ── */}
      {showSettings && (
        <div style={s.overlay} onClick={() => apiKey && setShowSettings(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>RapidAPI 키 설정</span>
              {apiKey && <button style={s.closeBtn} onClick={() => setShowSettings(false)}><X size={16} /></button>}
            </div>
            <div style={s.modalBody}>
              <p style={s.modalDesc}>
                TikTok 데이터를 가져오려면 RapidAPI 키가 필요해요.<br />
                <a href="https://rapidapi.com/tikwm-tikwm-default/api/tiktok-scraper7" target="_blank" style={{ color: 'var(--accent)', borderBottom: '1px solid var(--accent)' }}>
                  → RapidAPI에서 무료 키 발급받기
                </a>
              </p>
              <div style={s.inputRow}>
                <input
                  style={s.input}
                  type="password"
                  placeholder="여기에 API 키 붙여넣기..."
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveApiKey()}
                />
                <button style={s.accentBtn} onClick={saveApiKey}>저장</button>
              </div>
              {apiKey && <p style={{ color: 'var(--green)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>✓ 키 저장됨</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── 태그 모달 ── */}
      {tagModal && taggedVideo && (
        <div style={s.overlay} onClick={() => setTagModal(null)}>
          <div style={{ ...s.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>태그 달기</span>
              <button style={s.closeBtn} onClick={() => setTagModal(null)}><X size={16} /></button>
            </div>
            <div style={s.modalBody}>
              <p style={{ ...s.modalDesc, marginBottom: 0, color: 'var(--text2)', fontSize: 12 }}>
                {taggedVideo.author} · {fmt(taggedVideo.views)} views
              </p>
              <p style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5, color: 'var(--text)' }}>
                {taggedVideo.title?.slice(0, 80)}{taggedVideo.title?.length > 80 ? '...' : ''}
              </p>
              <div style={s.tagSection}>
                <p style={s.tagLabel}>훅 유형</p>
                <div style={s.tagGrid}>
                  {HOOK_TAGS.map(t => (
                    <button key={t} style={{ ...s.tagChip, ...(tags[tagModal]?.hook === t ? s.tagChipActive : {}) }}
                      onClick={() => setVideoTag(tagModal, 'hook', t)}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={s.tagSection}>
                <p style={s.tagLabel}>포맷 유형</p>
                <div style={s.tagGrid}>
                  {FORMAT_TAGS.map(t => (
                    <button key={t} style={{ ...s.tagChip, ...(tags[tagModal]?.format === t ? s.tagChipActiveFmt : {}) }}
                      onClick={() => setVideoTag(tagModal, 'format', t)}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={s.tagSection}>
                <p style={s.tagLabel}>메모</p>
                <textarea
                  style={s.textarea}
                  placeholder="분석 메모 (선택사항)..."
                  value={tags[tagModal]?.memo || ''}
                  onChange={e => setVideoTag(tagModal, 'memo', e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={s.body}>
        {/* ── 사이드바 (탐색 탭에서만) ── */}
        {tab === 'search' && (
          <aside style={s.sidebar}>
            <p style={s.sidebarTitle}>카테고리</p>
            <div style={s.categoryList}>
              {CATEGORIES.map(cat => (
                <button key={cat.id}
                  style={{ ...s.catBtn, ...(selectedCategory.id === cat.id ? s.catBtnActive : {}) }}
                  onClick={() => setSelectedCategory(cat)}>
                  {cat.label}
                </button>
              ))}
            </div>

            {selectedCategory.id === 'custom' && (
              <input
                style={{ ...s.input, marginTop: 8 }}
                placeholder="키워드 직접 입력..."
                value={customKeyword}
                onChange={e => setCustomKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            )}

            <div style={s.divider} />

            <p style={s.sidebarTitle}>필터</p>
            <div style={s.filterGroup}>
              <label style={s.filterLabel}>최소 뷰수</label>
              <select style={s.select} value={minViews} onChange={e => setMinViews(Number(e.target.value))}>
                <option value={100000}>10만+</option>
                <option value={300000}>30만+</option>
                <option value={500000}>50만+</option>
                <option value={1000000}>100만+</option>
                <option value={5000000}>500만+</option>
              </select>
            </div>
            <p style={s.filterHint}>기간: 최근 3주 이내 자동 적용</p>

            <button style={s.searchBtn} onClick={handleSearch} disabled={loading}>
              {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
              {loading ? '수집 중...' : '영상 수집하기'}
            </button>
          </aside>
        )}

        {/* ── 메인 콘텐츠 ── */}
        <main style={s.main}>
          {/* 상태 메시지 */}
          {error && (
            <div style={s.errorBanner}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* 결과 헤더 */}
          {displayVideos.length > 0 && (
            <div style={s.resultHeader}>
              <span style={s.resultCount}>
                {tab === 'search' ? `${displayVideos.length}개 수집됨` : `${displayVideos.length}개 저장됨`}
              </span>
              {tab === 'search' && (
                <span style={s.resultMeta}>
                  키워드: {selectedCategory.id === 'custom' ? customKeyword : selectedCategory.label} · {minViews >= 1000000 ? fmt(minViews) : (minViews / 10000) + '만'}뷰 이상
                </span>
              )}
            </div>
          )}

          {/* 빈 상태 */}
          {!loading && displayVideos.length === 0 && !error && (
            <div style={s.empty}>
              {tab === 'search' ? (
                <>
                  <TrendingUp size={40} style={{ color: 'var(--border2)', marginBottom: 16 }} />
                  <p style={s.emptyTitle}>{searched ? '결과 없음' : '카테고리 선택 후 수집 시작'}</p>
                  <p style={s.emptyDesc}>
                    {searched
                      ? '필터를 낮추거나 다른 카테고리를 시도해보세요'
                      : '왼쪽에서 카테고리와 뷰수 기준을 설정하고\n영상 수집하기를 눌러주세요'}
                  </p>
                </>
              ) : (
                <>
                  <Bookmark size={40} style={{ color: 'var(--border2)', marginBottom: 16 }} />
                  <p style={s.emptyTitle}>저장된 영상 없음</p>
                  <p style={s.emptyDesc}>탐색 탭에서 영상을 저장해보세요</p>
                </>
              )}
            </div>
          )}

          {/* 영상 그리드 */}
          <div style={s.grid}>
            {displayVideos.map(video => {
              const videoTags = tags[video.id] || {}
              const _saved = isSaved(video.id)
              return (
                <article key={video.id} style={s.card}>
                  {/* 썸네일 */}
                  <div style={s.thumbWrap}>
                    {video.thumbnail
                      ? <img src={video.thumbnail} alt="" style={s.thumb} loading="lazy" onError={e => { e.target.style.display = 'none' }} />
                      : <div style={s.thumbPlaceholder}><Play size={24} style={{ color: 'var(--border2)' }} /></div>
                    }
                    {/* 오버레이 */}
                    <div style={s.thumbOverlay}>
                      <a href={video.url} target="_blank" rel="noreferrer" style={s.openBtn}>
                        <ExternalLink size={13} /> TikTok 열기
                      </a>
                    </div>
                    {/* 뷰수 뱃지 */}
                    <div style={s.viewsBadge}>
                      <Eye size={10} /> {fmt(video.views)}
                    </div>
                    {/* D-day */}
                    <div style={s.dateBadge}>{daysAgo(video.date)}일 전</div>
                  </div>

                  {/* 카드 바디 */}
                  <div style={s.cardBody}>
                    <p style={s.cardTitle}>{video.title?.slice(0, 70)}{video.title?.length > 70 ? '...' : ''}</p>
                    <p style={s.cardAuthor}>@{video.authorHandle}</p>

                    {/* 스탯 */}
                    <div style={s.stats}>
                      <span style={s.stat}><Heart size={10} />{fmt(video.likes)}</span>
                      <span style={s.stat}><MessageCircle size={10} />{fmt(video.comments)}</span>
                      <span style={s.stat}><Share2 size={10} />{fmt(video.shares)}</span>
                    </div>

                    {/* 태그 표시 */}
                    {(videoTags.hook || videoTags.format) && (
                      <div style={s.tagRow}>
                        {videoTags.hook && <span style={s.hookBadge}>{videoTags.hook}</span>}
                        {videoTags.format && <span style={s.fmtBadge}>{videoTags.format}</span>}
                      </div>
                    )}
                    {videoTags.memo && <p style={s.memo}>{videoTags.memo}</p>}

                    {/* 액션 버튼 */}
                    <div style={s.cardActions}>
                      <button style={s.actionBtn} onClick={() => setTagModal(video.id)} title="태그 달기">
                        <Tag size={13} /><span>태그</span>
                      </button>
                      <button
                        style={{ ...s.actionBtn, ...(_saved ? s.actionBtnSaved : {}) }}
                        onClick={() => toggleSave(video)}
                        title={_saved ? '저장 해제' : '저장'}
                      >
                        {_saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                        <span>{_saved ? '저장됨' : '저장'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── 스타일 ────────────────────────────────────────────────────────
const s = {
  root: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' },

  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 56, borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg)',
    backdropFilter: 'blur(8px)',
  },
  headerLeft: { display: 'flex', alignItems: 'baseline', gap: 12 },
  logo: { fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: 1 },
  logoSub: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  tabs: { display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 8, padding: 3 },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
    borderRadius: 6, fontSize: 12, color: 'var(--text3)', fontWeight: 500,
    transition: 'all 0.15s',
  },
  tabBtnActive: { background: 'var(--surface2)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  settingsBtn: {
    width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: 'var(--text3)', background: 'var(--surface)',
    transition: 'color 0.15s',
  },

  body: { display: 'flex', flex: 1, overflow: 'hidden' },

  sidebar: {
    width: 200, padding: '20px 16px', borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 6,
    overflowY: 'auto', flexShrink: 0,
  },
  sidebarTitle: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 4 },
  categoryList: { display: 'flex', flexDirection: 'column', gap: 2 },
  catBtn: {
    padding: '7px 10px', borderRadius: 6, fontSize: 12, color: 'var(--text2)',
    textAlign: 'left', transition: 'all 0.15s', fontFamily: 'var(--font-body)',
  },
  catBtnActive: { background: 'var(--surface2)', color: 'var(--accent)', fontWeight: 700 },
  divider: { borderTop: '1px solid var(--border)', margin: '8px 0' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' },
  filterHint: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 },
  select: {
    background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6,
    color: 'var(--text)', padding: '6px 8px', fontSize: 12, width: '100%',
  },
  searchBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 12,
    padding: '10px 0', borderRadius: 8, marginTop: 12, transition: 'opacity 0.15s',
    fontFamily: 'var(--font-body)',
  },

  main: { flex: 1, padding: '20px 24px', overflowY: 'auto' },
  resultHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  resultCount: { fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--accent)' },
  resultMeta: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' },
  errorBanner: {
    display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,64,64,0.08)',
    border: '1px solid rgba(255,64,64,0.2)', borderRadius: 8, padding: '10px 14px',
    color: 'var(--red)', fontSize: 12, marginBottom: 16, fontFamily: 'var(--font-mono)',
  },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' },
  emptyTitle: { fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text2)', marginBottom: 8 },
  emptyDesc: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)', lineHeight: 1.8, whiteSpace: 'pre-line' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 },

  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column' },
  thumbWrap: { position: 'relative', aspectRatio: '9/16', background: 'var(--surface2)', overflow: 'hidden', maxHeight: 200 },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  thumbOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: 0, transition: 'opacity 0.2s',
  },
  openBtn: {
    display: 'flex', alignItems: 'center', gap: 5, background: 'var(--accent)', color: '#000',
    fontWeight: 700, fontSize: 11, padding: '7px 12px', borderRadius: 20,
    fontFamily: 'var(--font-body)',
  },
  viewsBadge: {
    position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 3,
    background: 'rgba(0,0,0,0.75)', color: 'var(--accent)', fontFamily: 'var(--font-mono)',
    fontSize: 10, padding: '3px 6px', borderRadius: 4, fontWeight: 500,
  },
  dateBadge: {
    position: 'absolute', top: 8, right: 8,
    background: 'rgba(0,0,0,0.75)', color: 'var(--text2)', fontFamily: 'var(--font-mono)',
    fontSize: 10, padding: '3px 6px', borderRadius: 4,
  },

  cardBody: { padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 },
  cardTitle: { fontSize: 12, lineHeight: 1.5, color: 'var(--text)', fontWeight: 500 },
  cardAuthor: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' },
  stats: { display: 'flex', gap: 8, marginTop: 2 },
  stat: { display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' },

  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  hookBadge: { fontFamily: 'var(--font-mono)', fontSize: 9, background: 'rgba(232,255,71,0.12)', color: 'var(--accent)', borderRadius: 4, padding: '2px 6px', border: '1px solid rgba(232,255,71,0.25)' },
  fmtBadge: { fontFamily: 'var(--font-mono)', fontSize: 9, background: 'rgba(255,107,53,0.12)', color: 'var(--accent2)', borderRadius: 4, padding: '2px 6px', border: '1px solid rgba(255,107,53,0.25)' },
  memo: { fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, fontStyle: 'italic', marginTop: 2 },

  cardActions: { display: 'flex', gap: 6, marginTop: 6 },
  actionBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 500, color: 'var(--text3)',
    background: 'var(--surface2)', border: '1px solid var(--border)', transition: 'all 0.15s',
    fontFamily: 'var(--font-body)',
  },
  actionBtnSaved: { color: 'var(--accent)', borderColor: 'rgba(232,255,71,0.3)', background: 'rgba(232,255,71,0.06)' },

  // 모달
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' },
  modal: { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12, width: '100%', maxWidth: 480, overflow: 'hidden' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: 0.5 },
  closeBtn: { color: 'var(--text3)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 },
  modalDesc: { fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 },
  inputRow: { display: 'flex', gap: 8 },
  input: {
    flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 7,
    color: 'var(--text)', padding: '8px 12px', fontSize: 12,
    outline: 'none',
  },
  accentBtn: { background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 12, padding: '8px 16px', borderRadius: 7, fontFamily: 'var(--font-body)' },

  tagSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  tagLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 },
  tagGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    padding: '5px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text3)',
    background: 'var(--surface2)', border: '1px solid var(--border)', transition: 'all 0.15s',
    fontFamily: 'var(--font-body)',
  },
  tagChipActive: { background: 'rgba(232,255,71,0.12)', color: 'var(--accent)', borderColor: 'rgba(232,255,71,0.3)' },
  tagChipActiveFmt: { background: 'rgba(255,107,53,0.12)', color: 'var(--accent2)', borderColor: 'rgba(255,107,53,0.3)' },
  textarea: {
    background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 7,
    color: 'var(--text)', padding: '8px 12px', fontSize: 12, resize: 'vertical',
    outline: 'none', width: '100%', lineHeight: 1.6,
  },
}
