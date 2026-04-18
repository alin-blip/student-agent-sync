import { DashboardLayout } from "@/components/DashboardLayout";
import CardSettingsSection from "@/components/CardSettingsSection";

export default function DigitalCardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Digital Card</h1>
        <CardSettingsSection />
      </div>
    </DashboardLayout>
  );
}
