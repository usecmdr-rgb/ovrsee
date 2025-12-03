import DashboardLayout from "@/components/app/DashboardLayout";

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <DashboardLayout activeAgent={null}>{children}</DashboardLayout>;
}





