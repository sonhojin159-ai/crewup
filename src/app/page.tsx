const SAMPLE_CREWS = [
  {
    id: 1,
    title: "스마트스토어 같이 시작해요",
    category: "온라인 판매",
    members: 4,
    maxMembers: 6,
    description: "네이버 스마트스토어를 함께 공부하고 운영할 크루를 모집합니다.",
    tags: ["초보환영", "주말활동"],
  },
  {
    id: 2,
    title: "배달 라이더 크루 - 강남권",
    category: "배달",
    members: 8,
    maxMembers: 10,
    description: "강남/서초 지역 배달 라이더 크루입니다. 정보 공유와 함께 달려요!",
    tags: ["저녁시간", "경력무관"],
  },
  {
    id: 3,
    title: "프리랜서 개발자 모임",
    category: "프리랜서",
    members: 5,
    maxMembers: 8,
    description: "프리랜서 개발 프로젝트를 함께 수주하고 진행하는 크루입니다.",
    tags: ["개발자", "원격가능"],
  },
  {
    id: 4,
    title: "블로그 수익화 크루",
    category: "콘텐츠",
    members: 3,
    maxMembers: 5,
    description: "블로그, 유튜브 등 콘텐츠 수익화를 함께 도전하는 크루입니다.",
    tags: ["초보환영", "온라인"],
  },
];

const CATEGORIES = [
  { name: "전체", emoji: "🔥" },
  { name: "온라인 판매", emoji: "🛒" },
  { name: "배달", emoji: "🛵" },
  { name: "프리랜서", emoji: "💻" },
  { name: "콘텐츠", emoji: "📝" },
  { name: "투자", emoji: "📈" },
  { name: "과외/교육", emoji: "📚" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-black/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <h1 className="text-xl font-bold text-primary">크루업</h1>
          <nav className="hidden gap-6 text-sm font-medium md:flex">
            <a href="#" className="text-foreground hover:text-primary">
              크루 찾기
            </a>
            <a href="#" className="text-gray-500 hover:text-primary">
              크루 만들기
            </a>
            <a href="#" className="text-gray-500 hover:text-primary">
              커뮤니티
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900">
              로그인
            </button>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light">
              회원가입
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-white px-4 py-20 text-center dark:from-gray-900 dark:to-black">
        <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          함께하면 더 쉬운 부업,
          <br />
          <span className="text-primary">크루</span>에서 시작하세요
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-gray-600 dark:text-gray-400">
          혼자 시작하기 막막한 부업, 같은 목표를 가진 크루와 함께라면 다릅니다.
          지금 바로 크루를 찾아보세요.
        </p>
        <div className="mx-auto mt-8 flex max-w-md gap-2">
          <input
            type="text"
            placeholder="어떤 부업에 관심 있으세요?"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900"
          />
          <button className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary-light">
            검색
          </button>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary dark:border-gray-700"
            >
              <span>{cat.emoji}</span>
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* Crew List */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h3 className="mb-6 text-2xl font-bold">인기 크루</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {SAMPLE_CREWS.map((crew) => (
            <article
              key={crew.id}
              className="group cursor-pointer rounded-xl border border-gray-200 p-6 transition-shadow hover:shadow-lg dark:border-gray-800"
            >
              <div className="flex items-start justify-between">
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-primary dark:bg-indigo-900/30">
                  {crew.category}
                </span>
                <span className="text-sm text-gray-500">
                  {crew.members}/{crew.maxMembers}명
                </span>
              </div>
              <h4 className="mt-3 text-lg font-semibold group-hover:text-primary">
                {crew.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {crew.description}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-2">
                  {crew.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <button className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-light">
                  참여하기
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-4 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-1.5 rounded-full bg-primary"
                  style={{
                    width: `${(crew.members / crew.maxMembers) * 100}%`,
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-10 dark:border-gray-800">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-gray-500">
          <p className="font-semibold text-foreground">크루업</p>
          <p className="mt-2">함께하는 부업 플랫폼</p>
          <p className="mt-4">&copy; 2026 CrewUp. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
