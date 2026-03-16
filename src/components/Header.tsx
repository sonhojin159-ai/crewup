"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/app/auth/actions";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const navLinks = [
    { href: "/crews", label: "크루 찾기" },
    { href: "/crews/new", label: "크루 만들기" },
    { href: "/crews/joined", label: "내가 참여한 크루" },
    { href: "/rewards", label: "리워드 스토어" },
    { href: "/wallet", label: "마이 월렛" },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-neutral/60 bg-white/80 backdrop-blur-md shadow-sm shadow-neutral/10">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-primary">
          크루업
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden gap-6 md:flex" aria-label="주 내비게이션">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActive(link.href) ? "nav-link-active" : "nav-link"}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Auth */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/profile"
                className="hidden sm:block text-sm font-medium text-foreground-muted hover:text-primary mr-1 transition-colors"
              >
                {user.user_metadata?.nickname || user.email?.split('@')[0]}님
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="hidden rounded-xl border border-neutral px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-secondary hover:bg-neutral/20 sm:block"
                >
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-xl border border-neutral px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-secondary hover:bg-neutral/20 sm:block"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="hidden sm:block btn-primary !py-2 !px-4 !rounded-xl !text-sm"
              >
                회원가입
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-neutral/30 md:hidden"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
          >
            <svg
              className="h-5 w-5 text-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu — CSS max-height transition (no JS animation lib needed) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${menuOpen ? "max-h-80" : "max-h-0"
          }`}
        aria-hidden={!menuOpen}
      >
        <nav className="border-t border-neutral bg-surface px-4 pb-4 pt-2">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-neutral/20 ${isActive(link.href) ? "text-primary font-semibold" : "text-foreground"
                  }`}
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-2 border-neutral" />
            {user ? (
              <>
                <div className="px-3 py-2 text-sm font-medium text-foreground">
                  {user.user_metadata?.nickname || user.email?.split('@')[0]}님
                </div>
                <form action={logout} className="w-full">
                  <button
                    type="submit"
                    className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-neutral/20"
                    onClick={() => setMenuOpen(false)}
                  >
                    로그아웃
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-neutral/20"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="btn-primary mt-1 w-full !rounded-xl text-center"
                >
                  회원가입
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
