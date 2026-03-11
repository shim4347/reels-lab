import { useState, useEffect } from 'react'
import {
  Search, Bookmark, BookmarkCheck, Tag, RefreshCw,
  Eye, ExternalLink, Settings, X,
  TrendingUp, Play, Heart, MessageCircle, Share2, AlertCircle, Loader, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react'

// ── 포맷 기반 카테고리 ────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'ai_dubbing',
    label: 'AI더빙·보이스오버',
    emoji: '🎙',
    keywords: ['ai더빙', 'ai목소리', '더빙브이로그', 'ai보이스', 'tts브이로그', 'ai내레이션'],
  },
  {
    id: 'storytelling',
    label: '스토리텔링·반전',
    emoji: '🎬',
    keywords: ['반전있는이야기', '공감스토리', '스토리텔링영상', '실화영상', '사연영상', '반전영상'],
  },
  {
    id: 'empathy',
    label: '공감·감성',
    emoji: '🥹',
    keywords: ['공감영상', '감성영상', '눈물영상', '공감일상', '감동영상', '힐링영상'],
  },
  {
    id: 'info_tip',
    label: '정보나열·꿀팁폼',
    emoji: '💡',
    keywords: ['꿀팁영상', '알고리즘탄영상', '정보영상', '유용한정보', '생활꿀팁', '몰랐던사실'],
  },
  {
    id: 'before_after',
    label: '비포/애프터',
    emoji: '✨',
    keywords: ['비포애프터', '변신영상', '전후비교', '변화영상', '다이어트변신', '리뉴얼'],
  },
  {
    id: 'challenge',
    label: '챌린지·트렌드폼',
    emoji: '🔥',
    keywords: ['챌린지', '트렌드영상', '유행영상', '밈영상', '따라하기', '트렌드폼'],
  },
  {
    id: 'daily_vlog',
    label: '일상·브이로그',
    emoji: '📱',
    keywords: ['일상브이로그', '일상영상', '하루일과', '소소한일상', '국내브이로그', '엄마브이로그'],
  },
  {
    id: 'custom',
    label: '직접 입력',
    emoji: '🔍',
    keywords: [],
  },
]

// Claude API 포맷 자동분류
async function classifyVideos(videos) {
  if (!videos.length) return {}

  const items = videos.map(v => ({
    id: v.id,
    text: `${v.title} ${v.hashtags?.join(' ') || ''}`
  }))

  const prompt = `다음은 틱톡 영상들의 제목과 해시태그 목록이야. 각 영상의 포맷을 아래 분류 중 하나로 태깅해줘.

포맷 분류:
- AI더빙: AI목소리, TTS, 더빙, 보이스오버 형식
- 스토리텔링: 이야기 전개, 반전, 사연, 실화 형식
- 공감/감성: 감동, 힐링, 공감, 눈물 유발 형식
- 정보나열: 꿀팁, 정보 전달, 리스트업 형식
- 비포애프터: 변신, 전후비교, 변화 과정 형식
- 챌린지: 유행 챌린지, 밈, 트렌드 따라하기 형식
- 일상브이로그: 일상 기록, 브이로그, 하루 일과 형식
- 기타: 위 분류에 해당 없음

영상 목록:
${items.map(i => `[${i.id}] ${i.text}`).join('\n')}

아래 JSON 형식으로만 응답해. 다른 텍스트 없이:
{"영상id": "포맷분류", "영상id2": "포맷분류2"}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return {}
  }
}

// TikTok 단일 키워드 검색
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

// 전체 수집 + Claude 분류
async function fetchAndClassify(keywords, apiKey, minViews, maxDays, onStatus) {
  const cutoff = Date.now() / 1000 - maxDays * 24 * 60 * 60

  onStatus(`🔍 ${keywords.length}개 키워드 동시 검색 중...`)
  const results = await Promise.allSettled(keywords.map(kw => fetchByKeyword(kw, apiKey)))

  // 중복 제거 + 필터
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
          author: v.author?.nickname || '알 수 없음',
          authorHandle: v.author?.unique_id || '',
          thumbnail: v.cover,
          views: v.play_count,
          likes: v.digg_count,
          comments: v.comment_count,
          shares: v.share_count,
          date: v.create_time,
          url: `https://www.tiktok.com/@${v.author?.unique_id}/video/${v.video_id}`,
          hashtags: (v.title || v.desc || '').match(/#\S+/g) || [],
          music: v.music?.title || '',
          autoFormat: null,
        })
      }
    }
  }

  const sorted = all.sort((a, b) => b.views - a.views)
  if (!sorted.length) return sorted

  // Claude 자동 분류
  onStatus(`🤖 Claude가 ${sorted.length}개 영상 포맷 분석 중...`)
  try {
    const formats = await classifyVideos(sorted)
    return sorted.map(v => ({ ...v, autoFormat: formats[v.id] || '기타' }))
  } catch {
    return sorted.map(v => ({ ...v, autoFormat: '분류 실패' }))
  }
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

const FORMAT_COLORS = {
  'AI더빙': { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
  '스토리텔링': { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  '공감/감성': { bg: 'rgba(236,72,153,0.15)', color: '#f472b6', border: 'rgba(236,72,153,0.3)' },
  '정보나열': { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
  '비포애프터': { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  '챌린지': { bg: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'rgba(239,68,68,0.3)' },
  '일상브이로그': { bg: 'rgba(232,255,71,0.12)', color: '#e8ff47', border: 'rgba(232,255,71,0.25)' },
  '기타': { bg: 'rgba(100,100,100,0.15)', color: '#888', border: 'rgba(100,100,100,0.3)' },
}

const HOOK_TAGS = ['충격/반전', '공감유도', '궁금증 유발', '숫자/통계', '비포/애프터', '질문형', '스토리텔링']
const APPLICATION_TAGS = ['아트앤하트 소식', '전시 홍보', '원장님 인터뷰', '아이 작품', '행사 안내', '브랜드 스토리']

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rl_apikey') || '')
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('rl_apikey'))
  const [apiKeyInput, setApiKeyInput] = useState('')

  const [tab, setTab] = useState('search')
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0])
  const [customKeyword, setCustomKeyword] = useState('')
  const [minViews, setMinViews] = useState(300000)
  const [maxDays, setMaxDays] = useState(21)
  const [formatFilter, setFormatFilter] = useState('전체')

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
  const [expandedCard, setExpandedCard] = useState(null)

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
    let keywords = selectedCategory.id === 'custom'
      ? [customKeyword.trim()].filter(Boolean)
      : selectedCategory.keywords
    if (!keywords.length) { setError('키워드를 입력해주세요'); return }

    setLoading(true); setError(''); setVideos([]); setSearched(true); setFormatFilter('전체')
    try {
      const results = await fetchAndClassify(keywords, apiKey, minViews, maxDays, setLoadingStatus)
      setVideos(results)
      if (!results.length) setError('조건에 맞는 영상이 없어요. 뷰수 기준을 낮추거나 기간을 늘려보세요.')
    } catch (e) {
      setError(`오류: ${e.message}`)
    } finally {
      setLoading(false); setLoadingStatus('')
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

  // 포맷 필터 옵션 (결과에서 실제 나온 포맷만)
  const formatOptions = ['전체', ...new Set(videos.map(v => v.autoFormat).filter(Boolean))]

  const baseVideos = tab === 'saved' ? saved : videos
  const displayVideos = formatFilter === '전체'
    ? baseVideos
    : baseVideos.filter(v => v.autoFormat === formatFilter)

  const taggedVideo = tagModal ? baseVideos.find(v => v.id === tagModal) : null

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
          <button style={s.settingsBtn} onClick={() => setShowSettings(true)}><Settings size={15} /></button>
        </div>
      </header>

      {/* API 키 설정 */}
      {showSettings && (
        <div style={s.overlay} onClick={() => apiKey && setShowSettings(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>API 키 설정</span>
              {apiKey && <button style={s.closeBtn} onClick={() => setShowSettings(false)}><X size={16} /></button>}
            </div>
            <div style={s.modalBody}>
              <div style={s.apiSection}>
                <p style={s.apiLabel}>① TikTok (RapidAPI)</p>
                <p style={s.modalDesc}>
                  <a href="https://rapidapi.com/tikwm-tikwm-default/api/tiktok-scraper7" target="_blank" rel="noreferrer"
                    style={{ color: 'var(--accent)', borderBottom: '1px solid var(--accent)' }}>
                    → 무료 키 발급받기
                  </a>
                </p>
                <div style={s.inputRow}>
                  <input style={s.input} type="password" placeholder="RapidAPI 키..."
                    value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveApiKey()} />
                  <button style={s.accentBtn} onClick={saveApiKey}>저장</button>
                </div>
                {apiKey && <p style={{ color: 'var(--green)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>✓ 저장됨</p>}
              </div>
              <div style={{ ...s.apiSection, background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                <p style={s.apiLabel}>② Claude API (포맷 자동 분류용)</p>
                <p style={s.modalDesc}>
                  Claude API는 이 앱 자체에 내장되어 있어서 별도 키 입력 불필요해요. 자동으로 작동해요 ✓
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 태그 모달 */}
      {tagModal && taggedVideo && (
        <div style={s.overlay} onClick={() => setTagModal(null)}>
          <div style={{ ...s.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>레퍼런스 태깅</span>
              <button style={s.closeBtn} onClick={() => setTagModal(null)}><X size={16} /></button>
            </div>
            <div style={s.modalBody}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {taggedVideo.autoFormat && (
                  <span style={{ ...s.formatBadge, ...(FORMAT_COLORS[taggedVideo.autoFormat] || FORMAT_COLORS['기타']) }}>
                    <Sparkles size={9} /> {taggedVideo.autoFormat}
                  </span>
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                  {fmt(taggedVideo.views)} views · {daysAgo(taggedVideo.date)}일 전
                </span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)', marginBottom: 4 }}>
                {taggedVideo.title?.slice(0, 80)}{taggedVideo.title?.length > 80 ? '...' : ''}
              </p>

              <div style={s.tagSection}>
                <p style={s.tagLabel}>훅 유형</p>
                <div style={s.tagGrid}>
                  {HOOK_TAGS.map(t => (
                    <button key={t} style={{ ...s.tagChip, ...(tags[tagModal]?.hook === t ? s.tagChipHook : {}) }}
                      onClick={() => setVideoTag(tagModal, 'hook', t)}>{t}</button>
                  ))}
                </div>
              </div>

              <div style={s.tagSection}>
                <p style={s.tagLabel}>Art&Heart 활용 방향</p>
                <div style={s.tagGrid}>
                  {APPLICATION_TAGS.map(t => (
                    <button key={t} style={{ ...s.tagChip, ...(tags[tagModal]?.application === t ? s.tagChipApp : {}) }}
                      onClick={() => setVideoTag(tagModal, 'application', t)}>{t}</button>
                  ))}
                </div>
              </div>

              <div style={s.tagSection}>
                <p style={s.tagLabel}>분석 메모</p>
                <textarea style={s.textarea} placeholder="이 포맷을 Art&Heart에 어떻게 적용할 수 있을지..."
                  value={tags[tagModal]?.memo || ''}
                  onChange={e => setVideoTag(tagModal, 'memo', e.target.value)} rows={3} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={s.body}>
        {/* 사이드바 */}
        {tab === 'search' && (
          <aside style={s.sidebar}>
            <p style={s.sidebarTitle}>포맷 카테고리</p>
            <div style={s.categoryList}>
              {CATEGORIES.map(cat => (
                <button key={cat.id}
                  style={{ ...s.catBtn, ...(selectedCategory.id === cat.id ? s.catBtnActive : {}) }}
                  onClick={() => setSelectedCategory(cat)}>
                  <span>{cat.emoji} {cat.label}</span>
                </button>
              ))}
            </div>

            {selectedCategory.id === 'custom' && (
              <input style={{ ...s.input, marginTop: 8 }} placeholder="키워드 직접 입력..."
                value={customKeyword} onChange={e => setCustomKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
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
            <div style={s.errorBanner}><AlertCircle size={14} /><span>{error}</span></div>
          )}

          {/* 결과 헤더 + 포맷 필터 */}
          {displayVideos.length > 0 || (tab === 'search' && videos.length > 0) ? (
            <div style={s.resultArea}>
              <div style={s.resultHeader}>
                <span style={s.resultCount}>{displayVideos.length}개</span>
                <span style={s.resultMeta}>
                  {tab === 'search'
                    ? `· ${selectedCategory.emoji} ${selectedCategory.label} · ${fmt(minViews)}뷰+ · ${maxDays}일 이내`
                    : '· 저장된 레퍼런스'}
                </span>
              </div>

              {/* 포맷 필터 탭 */}
              {tab === 'search' && formatOptions.length > 1 && (
                <div style={s.formatFilterRow}>
                  {formatOptions.map(f => {
                    const colors = FORMAT_COLORS[f] || FORMAT_COLORS['기타']
                    const isActive = formatFilter === f
                    return (
                      <button key={f}
                        style={{
                          ...s.formatFilterBtn,
                          ...(isActive ? { background: colors.bg, color: colors.color, borderColor: colors.border } : {})
                        }}
                        onClick={() => setFormatFilter(f)}>
                        {f !== '전체' && <Sparkles size={9} />}
                        {f}
                        {f !== '전체' && (
                          <span style={s.formatCount}>{videos.filter(v => v.autoFormat === f).length}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {!loading && displayVideos.length === 0 && !error && (
            <div style={s.empty}>
              {tab === 'search' ? (
                <>
                  <TrendingUp size={40} style={{ color: 'var(--border2)', marginBottom: 16 }} />
                  <p style={s.emptyTitle}>{searched ? '결과 없음' : '포맷 선택 후 수집 시작'}</p>
                  <p style={s.emptyDesc}>
                    {searched
                      ? '뷰수 기준을 낮추거나 기간을 늘려보세요'
                      : '왼쪽에서 포맷 카테고리와 필터를 설정하고\n영상 수집하기를 눌러주세요\n\n수집 후 Claude가 자동으로 포맷을 분류해드려요 ✨'}
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
              const fmtColor = FORMAT_COLORS[video.autoFormat] || FORMAT_COLORS['기타']
              const isExpanded = expandedCard === video.id
              return (
                <article key={video.id} style={s.card}
                  onMouseEnter={e => { const o = e.currentTarget.querySelector('.overlay'); if(o) o.style.opacity='1' }}
                  onMouseLeave={e => { const o = e.currentTarget.querySelector('.overlay'); if(o) o.style.opacity='0' }}
                >
                  <div style={s.thumbWrap}>
                    {video.thumbnail
                      ? <img src={video.thumbnail} alt="" style={s.thumb} loading="lazy"
                          onError={e => { e.target.style.display='none' }} />
                      : <div style={s.thumbPlaceholder}><Play size={24} style={{ color: 'var(--border2)' }} /></div>
                    }
                    <div className="overlay" style={s.thumbOverlay}>
                      <a href={video.url} target="_blank" rel="noreferrer" style={s.openBtn}>
                        <ExternalLink size={11} /> 틱톡 열기
                      </a>
                    </div>
                    <div style={s.viewsBadge}><Eye size={9} /> {fmt(video.views)}</div>
                    <div style={s.dateBadge}>{daysAgo(video.date)}일 전</div>

                    {/* Claude 자동분류 뱃지 */}
                    {video.autoFormat && (
                      <div style={{ ...s.autoFormatBadge, background: fmtColor.bg, color: fmtColor.color, border: `1px solid ${fmtColor.border}` }}>
                        <Sparkles size={8} /> {video.autoFormat}
                      </div>
                    )}
                  </div>

                  <div style={s.cardBody}>
                    <p style={s.cardTitle}>{video.title?.slice(0, 60)}{video.title?.length > 60 ? '...' : ''}</p>
                    <p style={s.cardAuthor}>@{video.authorHandle}</p>

                    <div style={s.stats}>
                      <span style={s.stat}><Heart size={9} />{fmt(video.likes)}</span>
                      <span style={s.stat}><MessageCircle size={9} />{fmt(video.comments)}</span>
                      <span style={s.stat}><Share2 size={9} />{fmt(video.shares)}</span>
                    </div>

                    {/* 사용자 태그 */}
                    {(videoTags.hook || videoTags.application) && (
                      <div style={s.tagRow}>
                        {videoTags.hook && <span style={s.hookBadge}>{videoTags.hook}</span>}
                        {videoTags.application && <span style={s.appBadge}>{videoTags.application}</span>}
                      </div>
                    )}

                    {/* 메모 (확장시) */}
                    {isExpanded && videoTags.memo && (
                      <p style={s.memo}>{videoTags.memo}</p>
                    )}
                    {videoTags.memo && (
                      <button style={s.expandBtn} onClick={() => setExpandedCard(isExpanded ? null : video.id)}>
                        {isExpanded ? <><ChevronUp size={10} />메모 접기</> : <><ChevronDown size={10} />메모 보기</>}
                      </button>
                    )}

                    <div style={s.cardActions}>
                      <button style={s.actionBtn} onClick={() => setTagModal(video.id)}>
                        <Tag size={11} /> 태그
                      </button>
                      <button style={{ ...s.actionBtn, ...(_saved ? s.actionBtnSaved : {}) }}
                        onClick={() => toggleSave(video)}>
                        {_saved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
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
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg)' },
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
  catBtn: { padding: '8px 10px', borderRadius: 6, fontSize: 12, color: 'var(--text2)', textAlign: 'left' },
  catBtnActive: { background: 'var(--surface2)', color: 'var(--accent)', fontWeight: 700 },
  divider: { borderTop: '1px solid var(--border)', margin: '6px 0' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 },
  filterLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' },
  select: { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', padding: '6px 8px', fontSize: 12, width: '100%' },
  searchBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 12, padding: '10px 0', borderRadius: 8, marginTop: 10, fontFamily: 'var(--font-body)' },
  loadingStatus: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6, marginTop: 4 },
  main: { flex: 1, padding: '20px 24px', overflowY: 'auto' },
  resultArea: { marginBottom: 16 },
  resultHeader: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  resultCount: { fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--accent)' },
  resultMeta: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' },
  formatFilterRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  formatFilterBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', fontFamily: 'var(--font-body)', cursor: 'pointer' },
  formatCount: { fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.7 },
  errorBanner: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,64,64,0.08)', border: '1px solid rgba(255,64,64,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6060', fontSize: 12, marginBottom: 16, fontFamily: 'var(--font-mono)' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' },
  emptyTitle: { fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text2)', marginBottom: 8 },
  emptyDesc: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)', lineHeight: 1.8, whiteSpace: 'pre-line' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  thumbWrap: { position: 'relative', height: 180, background: 'var(--surface2)', overflow: 'hidden', flexShrink: 0 },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  thumbOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' },
  openBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 11, padding: '7px 14px', borderRadius: 20, fontFamily: 'var(--font-body)' },
  viewsBadge: { position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.8)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 6px', borderRadius: 4 },
  dateBadge: { position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.8)', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 6px', borderRadius: 4 },
  autoFormatBadge: { position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 7px', borderRadius: 4, fontWeight: 600 },
  cardBody: { padding: '11px 12px 10px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 },
  cardTitle: { fontSize: 12, lineHeight: 1.5, color: 'var(--text)', fontWeight: 500 },
  cardAuthor: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' },
  stats: { display: 'flex', gap: 8 },
  stat: { display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  hookBadge: { fontFamily: 'var(--font-mono)', fontSize: 9, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', borderRadius: 4, padding: '2px 6px', border: '1px solid rgba(96,165,250,0.25)' },
  appBadge: { fontFamily: 'var(--font-mono)', fontSize: 9, background: 'rgba(52,211,153,0.12)', color: '#34d399', borderRadius: 4, padding: '2px 6px', border: '1px solid rgba(52,211,153,0.25)' },
  formatBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 8px', borderRadius: 4, fontWeight: 600 },
  memo: { fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, fontStyle: 'italic', background: 'var(--surface2)', borderRadius: 6, padding: '6px 8px' },
  expandBtn: { display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 },
  cardActions: { display: 'flex', gap: 6, marginTop: 4 },
  actionBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 500, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', fontFamily: 'var(--font-body)' },
  actionBtnSaved: { color: 'var(--accent)', borderColor: 'rgba(232,255,71,0.3)', background: 'rgba(232,255,71,0.06)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' },
  modal: { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12, width: '100%', maxWidth: 480 },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: 0.5 },
  closeBtn: { color: 'var(--text3)', padding: 4, display: 'flex', alignItems: 'center' },
  modalBody: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  apiSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  apiLabel: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', fontWeight: 600 },
  modalDesc: { fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 },
  inputRow: { display: 'flex', gap: 8 },
  input: { flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--text)', padding: '8px 12px', fontSize: 12, outline: 'none' },
  accentBtn: { background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 12, padding: '8px 16px', borderRadius: 7, fontFamily: 'var(--font-body)' },
  tagSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  tagLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 },
  tagGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tagChip: { padding: '5px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', fontFamily: 'var(--font-body)', cursor: 'pointer' },
  tagChipHook: { background: 'rgba(96,165,250,0.12)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)' },
  tagChipApp: { background: 'rgba(52,211,153,0.12)', color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' },
  textarea: { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--text)', padding: '8px 12px', fontSize: 12, resize: 'vertical', outline: 'none', width: '100%', lineHeight: 1.6 },
}
