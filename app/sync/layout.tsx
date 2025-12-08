import DashboardLayout from "@/components/app/DashboardLayout";

export default function SyncLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout activeAgent="sync">{children}</DashboardLayout>;
}

















