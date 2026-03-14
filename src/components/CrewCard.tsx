import Link from "next/link";
import { Crew } from "@/types/crew";
import RoleBadge from "./RoleBadge";

export default function CrewCard({ crew }: { crew: Crew }) {
  const progress = (crew.members / crew.maxMembers) * 100;
  const isFull = crew.members >= crew.maxMembers;
  const isAlmostFull = !isFull && progress >= 80;

  const progressClassName = isFull
    ? "progress-fill-full"
    : isAlmostFull
    ? "progress-fill-almost"
    : "progress-fill";

  return (
    <Link href={`/crews/${crew.id}`} className="block group">
      <article className="card card-interactive relative h-full">
        {/* Scarcity badge — P0 conversion element */}
        {isFull && (
          <div className="absolute -right-2 -top-2 rounded-full bg-foreground-muted px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            마감
          </div>
        )}
        {isAlmostFull && (
          <div className="absolute -right-2 -top-2 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            마감 임박
          </div>
        )}

        {/* Header row: badges + member count */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Track badge */}
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              crew.track === 'revenue_share' 
                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                : 'bg-rose-100 text-rose-800 border border-rose-200'
            }`}>
              {crew.track === 'revenue_share' ? '💰 수익분배' : '🔥 미션달성'}
            </span>
            {/* Category pill */}
            <span className="inline-flex items-center rounded-full bg-secondary/20 px-3 py-1 text-xs font-medium text-secondary-text">
              {crew.category}
            </span>
            <RoleBadge roleType={crew.roleType} />
          </div>
          <span className="shrink-0 text-sm font-medium text-foreground-muted">
            {crew.members}/{crew.maxMembers}명
          </span>
        </div>

        {/* Title — line-clamp prevents grid height inconsistency */}
        <h4 className="mt-3 text-[17px] font-semibold leading-snug text-foreground group-hover:text-primary transition-colors duration-150">
          {crew.title}
        </h4>

        {/* Description — always line-clamp-2 for uniform card heights */}
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-foreground-muted">
          {crew.description}
        </p>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {crew.tags.map((tag) => (
            <span key={tag} className="tag-chip">
              #{tag}
            </span>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="progress-track">
            <div
              className={progressClassName}
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`모집 현황 ${crew.members}명/${crew.maxMembers}명`}
            />
          </div>
        </div>
      </article>
    </Link>
  );
}
