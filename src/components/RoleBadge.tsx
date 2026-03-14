import { RoleType } from "@/types/crew";

const ROLE_CONFIG: Record<RoleType, { label: string; className: string }> = {
  investor: {
    label: "A형 · 투자자",
    className: "badge-role-investor",
  },
  operator: {
    label: "B형 · 실행자",
    className: "badge-role-operator",
  },
  both: {
    label: "A+B · 모두 가능",
    className: "badge-role-both",
  },
};

export default function RoleBadge({ roleType }: { roleType: RoleType }) {
  const config = ROLE_CONFIG[roleType];
  return (
    <span className={config.className}>
      {config.label}
    </span>
  );
}
