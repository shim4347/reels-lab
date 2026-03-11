import { useState, useEffect } from 'react'
import {
  Search, Bookmark, BookmarkCheck, Tag, RefreshCw,
  Eye, ExternalLink, Settings, X,
  TrendingUp, Play, Heart, MessageCircle, Share2, AlertCircle, Loader
} from 'lucide-react'

const CATEGORIES = [
  { id: 'parenting', label: '육아·교육', keywords: ['육아', '엄마육아', '아이교육', '유아교육', 'parenting tips', 'mom life'] },
  { id: 'info', label: '정보·꿀팁', keywords: ['꿀팁', '생활꿀팁', '알아두면유용한', '유용한정보', 'life hacks', 'useful tips'] },
  { id: 'emotion', label: '감동·공감', keywords: ['감동', '공감', '눈물', '따뜻한이야기', 'heartwarming', 'emotional story'] },
  { id: 'food', label: '음식·요리', keywords: ['요리', '레시피', '간단요리', '집밥', 'easy recipe', 'cooking tips'] },
  { id: 'before_after', label: '비포/애프터', keywords: ['변신', '전후비교', '다이어트전후', 'before and after', 'transformation'] },
  { id: 'kids_art', label: '아이 미술·창의', keywords: ['어린이미술', '아이그림', '미술놀이', '창의교육', 'kids art', 'art for kids'] },
  { id: 'custom', label: '직접 입력', keywords: [] },
]

const HOOK_TAGS = ['충격/반전', '공감유도', '궁금증 유발', '숫자/통계', '비포/애프터', '질문형', '스토리텔링']
const FORMAT_TAGS = ['정보나열', '인터뷰', '보이스오버', '자막만', '반응형', '튜토리얼', '브이로그']

// 단일 키워드 API 호출
async function fetchByKeyword(keyword, apiKey) {
  const url = `https://tiktok-scraper7.p.rapidapi.com/feed/search?keywords=${encodeURIComponent(keyword)}&region=KR&count=20&cursor=0&publish_time=0&sort_type=1`
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com'
    }
  })
  if (!res.ok) return []
  const data = await res.json()
  return data?.data?.videos || []
}

// 모든 키워드 병렬 호출 후 합치기
async function fetchAll(keywords, apiKey, minViews, maxDaysAgo) {
  const cutoff = Date.now() / 1000 - maxDaysAgo * 24 * 60 * 60

  // 키워드별 병렬 요청
  const results = await Promise.allSettled(
    keywords.map(kw => fetchByKeyword(kw, apiKey))
  )

  // 합치고 중복 제거
  const seen = new Set()
  const all = []
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const v of r.value) {
      if (seen.has(v.video_id)) continue
      seen.add(v.video_id)
      if (v.play_count >= minViews && v.create_time >= cutoff) {
        all.push({
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
        })
      }
    }
  }

  // 뷰수 높은 순 정렬
  return all.sort((a, b) => b.views - a.views)
}

function fmt(n) {
  if (!n) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K'
  return n.toString()
}

function daysAgo(ts) {
  return Math.floor((Date.now() / 1000 - ts) / 86400)
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rl_apikey') || '')
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('rl_apikey'))
  const [apiKeyInput, setApiKeyInput] = useState('')

  const [tab, setTab] = useState('search')
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0])
  const [customKeyword, setCustomKeyword] = useState('')
  const [minViews, setMinViews] = useState(300000)
  const [maxDays, setMaxDays] = useState(21)

  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rl_saved') || '[]') } catch { return [] }
  })
  const [tags, setTags] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rl_tags') || '{}') } catch { return {} }
  })
  const [tagModal, setTagModal] = useState(null)

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

    let keywords
    if (selectedCategory.id === 'custom') {
      if (!customKeyword.trim()) { setError('키워드를 입력해주세요'); return }
      keywords = [customKeyword.trim()]
    } else {
      keywords = selectedCategory.keywords
    }

    setLoading(true); setError(''); setVideos([]); setSearched(true)
    setLoadingStatus(`${keywords.length}개 키워드 동시 검색 중...`)

    try {
      const results = await fetchAll(keywords, apiKey, minViews, maxDays)
      setVideos(results)
      if (results.length === 0) {
        setError('조건에 맞는 영상이 없어요. 뷰수 기준을 낮추거나 기간을 늘려보세요.')
      }
    } catch (e) {
      setError(`오류: ${e.message}`)
    } finally {
      setLoading(false)
      setLoadingStatus('')
    }
  }

  const toggleSave = (video) => {
    setSaved(prev => prev.find(v => v.id === video.id)
      ? prev.filter(v => v.id !== video.id)
      : [...prev, video])
  }

  const isSaved = (id) => saved.some(v => v.id === id)

  const setVideoTag = (videoId, type, value) => {
    setTags(prev => ({
      ...prev,
      [videoId]: { ...prev[videoId], [type]: prev[videoId]?.[type] === value ? null : value }
    }))
  }

  const displayVideos = tab === 'saved' ? saved : videos
  const taggedVideo = tagModal ? displayVideos.find(v => v.id === tagModal) : null

  return (
    <div style={s.root}>
      {/* 헤더 */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.logo}>REELS<span style={{ color: 'var(--accent)' }}>LAB</span></span>
          <span style={s.logoSub}>틱톡 트렌드 레퍼런스 수집기</span>
        </div>
        <div style={s.headerRight}>
          <div style={s.tabs}>
            {[['search', '탐색'], ['saved', `저장 ${saved.length}`]].map(([id, label]) => (
              <button key={id} style={{ ...s.tabBtn, ...(tab === id ? s.tabBtnActive : {}) }} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <button style={s.settingsBtn} onClick={() => setShowSettings(true)} title="API 키 설정">
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* API 키 설정 모달 */}
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
                <a href="https://rapidapi.com/tikwm-tikwm-default/api/tiktok-scraper7" target="_blank" rel="noreferrer"
                  style={{ color: 'var(--accent)', borderBottom: '1px solid var(--accent)' }}>
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

      {/* 태그 모달 */}
      {tagModal && taggedVideo && (
        <div style={s.overlay} onClick={() => setTagModal(null)}>
          <div style={{ ...s.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>태그 달기</span>
              <button style={s.closeBtn} onClick={() => setTagModal(null)}><X size={16} /></button>
            </div>
            <div style={s.modalBody}>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
                @{taggedVideo.authorHandle} · {fmt(taggedVideo.views)} views
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
                {taggedVideo.title?.slice(0, 80)}{taggedVideo.title?.length > 80 ? '...' : ''}
              </p>
              <div style={s.tagSection}>
                <p style={s.tagLabel}>훅 유형</p>
                <div style={s.tagGrid}>
                  {HOOK_TAGS.map(t => (
                    <button key={t}
                      style={{ ...s.tagChip, ...(tags[tagModal]?.hook === t ? s.tagChipActive : {}) }}
                      onClick={() => setVideoTag(tagModal, 'hook', t)}>{t}
                    </button>
                  ))}
                </div>
              </div>
              <div style={s.tagSection}>
                <p style={s.tagLabel}>포맷 유형</p>
                <div style={s.tagGrid}>
                  {FORMAT_TAGS.map(t => (
                    <button key={t}
                      style={{ ...s.tagChip, ...(tags[tagModal]?.format === t ? s.tagChipActiveFmt : {}) }}
                      onClick={() => setVideoTag(tagModal, 'format', t)}>{t}
                    </button>
                  ))}
                </div>
              </div>
              <div style={s.tagSection}>
                <p style={s.tagLabel}>메모</p>
                <textarea
                  style={s.textarea}
                  placeholder="분석 메모..."
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
        {/* 사이드바 */}
        {tab === 'search' && (
          <aside style={s.sidebar}>
            <p style={s.sidebarTitle}>카테고리</p>
            <div style={s.categoryList}>
              {CATEGORIES.map(cat => (
                <button key={cat.id}
                  style={{ ...s.catBtn, ...(selectedCategory.id === cat.id ? s.catBtnActive : {}) }}
                  onClick={() => setSelectedCategory(cat)}>
                  <span>{cat.label}</span>
                  {cat.id !== 'custom' && <span style={s.catCount}>{cat.keywords.length}</span>}
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
                <option value={50000}>5만+</option>
                <option value={100000}>10만+</option>
                <option value={300000}>30만+</option>
                <option value={500000}>50만+</option>
                <option value={1000000}>100만+</option>
              </select>
            </div>
            <div style={s.filterGroup}>
              <label style={s.filterLabel}>기간</label>
              <select style={s.select} value={maxDays} onChange={e => setMaxDays(Number(e.target.value))}>
                <option value={7}>1주 이내</option>
                <option value={14}>2주 이내</option>
                <option value={21}>3주 이내</option>
                <option value={30}>1개월 이내</option>
                <option value={60}>2개월 이내</option>
              </select>
            </div>

            {selectedCategory.id !== 'custom' && (
              <div style={s.keywordPreview}>
                <p style={s.filterLabel}>검색 키워드 ({selectedCategory.keywords.length}개)</p>
                <div style={s.kwList}>
                  {selectedCategory.keywords.map(k => (
                    <span key={k} style={s.kwChip}>{k}</span>
                  ))}
                </div>
              </div>
            )}

            <button style={{ ...s.searchBtn, opacity: loading ? 0.7 : 1 }} onClick={handleSearch} disabled={loading}>
              {loading
                ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />수집 중...</>
                : <><Search size={14} />영상 수집하기</>
              }
            </button>

            {loading && loadingStatus && (
              <p style={s.loadingStatus}>{loadingStatus}</p>
            )}
          </aside>
        )}

        {/* 메인 */}
        <main style={s.main}>
          {error && (
            <div style={s.errorBanner}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {displayVideos.length > 0 && (
            <div style={s.resultHeader}>
              <span style={s.resultCount}>{displayVideos.length}개</span>
              <span style={s.resultMeta}>
                {tab === 'search'
                  ? `· ${selectedCategory.label} · ${fmt(minViews)}뷰+ · ${maxDays}일 이내`
                  : '· 저장된 레퍼런스'
                }
              </span>
            </div>
          )}

          {!loading && displayVideos.length === 0 && !error && (
            <div style={s.empty}>
              {tab === 'search' ? (
                <>
                  <TrendingUp size={40} style={{ color: 'var(--border2)', marginBottom: 16 }} />
                  <p style={s.emptyTitle}>{searched ? '결과 없음' : '카테고리 선택 후 수집 시작'}</p>
                  <p style={s.emptyDesc}>
                    {searched
                      ? '뷰수 기준을 낮추거나 기간을 늘려보세요'
                      : '왼쪽에서 카테고리와 필터를 설정하고\n영상 수집하기를 눌러주세요'}
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

          <div style={s.grid}>
            {displayVideos.map(video => {
              const videoTags = tags[video.id] || {}
              const _saved = isSaved(video.id)
              return (
                <article key={video.id} style={s.card}
                  onMouseEnter={e => e.currentTarget.querySelector('.overlay').style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.querySelector('.overlay').style.opacity = '0'}
                >
                  <div style={s.thumbWrap}>
                    {video.thumbnail
                      ? <img src={video.thumbnail} alt="" style={s.thumb} loading="lazy"
                          onError={e => { e.target.style.display = 'none' }} />
                      : <div style={s.thumbPlaceholder}><Play size={24} style={{ color: 'var(--border2)' }} /></div>
                    }
                    <div className="overlay" style={s.thumbOverlay}>
                      <a href={video.url} target="_blank" rel="noreferrer" style={s.openBtn}>
                        <ExternalLink size={12} /> TikTok 열기
                      </a>
                    </div>
                    <div style={s.viewsBadge}><Eye size={10} /> {fmt(video.views)}</div>
                    <div style={s.dateBadge}>{daysAgo(video.date)}일 전</div>
                  </div>

                  <div style={s.cardBody}>
                    <p style={s.cardTitle}>{video.title?.slice(0, 65)}{video.title?.length > 65 ? '...' : ''}</p>
                    <p style={s.cardAuthor}>@{video.authorHandle}</p>

                    <div style={s.stats}>
                      <span style={s.stat}><Heart size={10} />{fmt(video.likes)}</span>
                      <span style={s.stat}><MessageCircle size={10} />{fmt(video.comments)}</span>
                      <span style={s.stat}><Share2 size={10} />{fmt(video.shares)}</span>
                    </div>

                    {(videoTags.hook || videoTags.format) && (
                      <div style={s.tagRow}>
                        {videoTags.hook && <span style={s.hookBadge}>{videoTags.hook}</span>}
                        {videoTags.format && <span style={s.fmtBadge}>{videoTags.format}</span>}
                      </div>
                    )}
                    {videoTags.memo && <p style={s.memo}>{videoTags.memo}</p>}

                    <div style={s.cardActions}>
                      <button style={s.actionBtn} onClick={() => setTagModal(video.id)}>
                        <Tag size={12} /> 태그
                      </button>
                      <button style={{ ...s.actionBtn, ...(_saved ? s.actionBtnSaved : {}) }}
                        onClick={() => toggleSave(video)}>
                        {_saved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                        {_saved ? '저장됨' : '저장'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </main>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const s = {
  root: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 56, borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg)',
  },
  headerLeft: { display: 'flex', alignItems: 'baseline', gap: 12 },
  logo: { fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: 1 },
  logoSub: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  tabs: { display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 8, padding: 3 },
  tabBtn: { padding: '5px 14px', borderRadius: 6, fontSize: 12, color: 'var(--text3)', fontWeight: 500 },
  tabBtnActive: { background: 'var(--surface2)', color: 'var(--text)' },
  settingsBtn: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', background: 'var(--surface)' },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: { width: 210, padding: '20px 14px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flexShrink: 0 },
  sidebarTitle: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 6 },
  categoryList: { display: 'flex', flexDirection: 'column', gap: 2 },
  catBtn: { padding: '7px 10px', borderRadius: 6, fontSize: 12, color: 'var(--text2)', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  catBtnActive: { background: 'var(--surface2)', color: 'var(--accent)', fontWeight: 700 },
  catCount: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', background: 'var(--border)', borderRadius: 4, padding: '1px 5px' },
  divider: { borderTop: '1px solid var(--border)', margin: '6px 0' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 },
  filterLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' },
  select: { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', padding: '6px 8px', fontSize: 12, width: '100%' },
  keywordPreview: { marginTop: 4 },
  kwList: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  kwChip: { fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--surface2)', color: 'var(--text3)', borderRadius: 4, padding: '2px 6px', border: '1px solid var(--border)' },
  searchBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 12, padding: '10px 0', borderRadius: 8, marginTop: 10, fontFamily: 'var(--font-body)' },
  loadingStatus: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.5 },
  main: { flex: 1, padding: '20px 24px', overflowY: 'auto' },
  resultHeader: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 },
  resultCount: { fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--accent)' },
  resultMeta: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' },
  errorBanner: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,64,64,0.08)', border: '1px solid rgba(255,64,64,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6060', fontSize: 12, marginBottom: 16, fontFamily: 'var(--font-mono)' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' },
  emptyTitle: { fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text2)', marginBottom: 8 },
  emptyDesc: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)', lineHeight: 1.8, whiteSpace: 'pre-line' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s' },
  thumbWrap: { position: 'relative', height: 180, background: 'var(--surface2)', overflow: 'hidden', flexShrink: 0 },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  thumbOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' },
  openBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 11, padding: '7px 14px', borderRadius: 20, fontFamily: 'var(--font-body)' },
  viewsBadge: { position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.8)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 6px', borderRadius: 4 },
  dateBadge: { position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.8)', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 6px', borderRadius: 4 },
  cardBody: { padding: '11px 12px 10px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 },
  cardTitle: { fontSize: 12, lineHeight: 1.5, color: 'var(--text)', fontWeight: 500 },
  cardAuthor: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' },
  stats: { display: 'flex', gap: 8 },
  stat: { display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  hookBadge: { fontFamily: 'var(--font-mono)', fontSize: 9, background: 'rgba(232,255,71,0.12)', color: 'var(--accent)', borderRadius: 4, padding: '2px 6px', border: '1px solid rgba(232,255,71,0.25)' },
  fmtBadge: { fontFamily: 'var(--font-mono)', fontSize: 9, background: 'rgba(255,107,53,0.12)', color: '#ff6b35', borderRadius: 4, padding: '2px 6px', border: '1px solid rgba(255,107,53,0.25)' },
  memo: { fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, fontStyle: 'italic' },
  cardActions: { display: 'flex', gap: 6, marginTop: 4 },
  actionBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 500, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', fontFamily: 'var(--font-body)' },
  actionBtnSaved: { color: 'var(--accent)', borderColor: 'rgba(232,255,71,0.3)', background: 'rgba(232,255,71,0.06)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' },
  modal: { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12, width: '100%', maxWidth: 480 },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: 0.5 },
  closeBtn: { color: 'var(--text3)', padding: 4, display: 'flex', alignItems: 'center' },
  modalBody: { padding: 20, display: 'flex', flexDirection: 'column', gap: 12 },
  modalDesc: { fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 },
  inputRow: { display: 'flex', gap: 8 },
  input: { flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--text)', padding: '8px 12px', fontSize: 12, outline: 'none' },
  accentBtn: { background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 12, padding: '8px 16px', borderRadius: 7, fontFamily: 'var(--font-body)' },
  tagSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  tagLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 },
  tagGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tagChip: { padding: '5px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', fontFamily: 'var(--font-body)' },
  tagChipActive: { background: 'rgba(232,255,71,0.12)', color: 'var(--accent)', borderColor: 'rgba(232,255,71,0.3)' },
  tagChipActiveFmt: { background: 'rgba(255,107,53,0.12)', color: '#ff6b35', borderColor: 'rgba(255,107,53,0.3)' },
  textarea: { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--text)', padding: '8px 12px', fontSize: 12, resize: 'vertical', outline: 'none', width: '100%', lineHeight: 1.6 },
}
