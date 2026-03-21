import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import { CrewSummary, RoleType } from "@/types/crew";
import CrewsClient from "./CrewsClient";

export const revalidate = 30;

interface CrewRow {
  id: string;
  title: string;
  category: string;
  role_type: string;
  track: "mission" | "revenue_share";
  description: string;
  max_members: number;
  tags: string[];
  status: string;
  crew_members: { count: number }[];
}

async function getInitialCrews(): Promise<CrewSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("crews")
    .select("*, crew_members(count)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Crew list fetch error:", error);
    return [];
  }

  return (data as CrewRow[]).map((crew) => ({
    id: crew.id,
    title: crew.title,
    category: crew.category,
    roleType: crew.role_type as RoleType,
    track: crew.track,
    description: crew.description,
    maxMembers: crew.max_members,
    tags: crew.tags || [],
    members: crew.crew_members?.[0]?.count || 0,
    status: crew.status,
  }));
}

export default async function CrewsPage() {
  const initialCrews = await getInitialCrews();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CrewsClient initialCrews={initialCrews} />
      <Footer />
    </div>
  );
}
