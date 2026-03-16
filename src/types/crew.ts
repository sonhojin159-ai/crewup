export type RoleType = "investor" | "operator" | "both";

export interface Crew {
  id: string;
  title: string;
  category: string;
  members: number;
  maxMembers: number;
  description: string;
  tags: string[];
  roleType: RoleType;
  track?: 'mission' | 'revenue_share';
  missions?: Mission[];
  entryPoints: number;
  deposit: number;
  leaderFeeDeposit: number;
  leaderMarginRate: number;
  missionRewardRate: number;
  status: string;
  createdBy: string;
}

export type CrewSummary = Pick<
  Crew,
  'id' | 'title' | 'category' | 'members' | 'maxMembers' | 'description' | 'tags' | 'roleType' | 'track' | 'status'
>;

export interface Mission {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface Category {
  name: string;
  emoji: string;
}
