import SalaryAnalyticsScreen from "@/components/SalaryAnalyticsScreen";
import SelfEmployedAnalyticsScreen from "@/components/SelfEmployedAnalyticsScreen";
import { useAuth } from "@/context/AuthContext";

export default function AnalyticsScreen() {
  const { userData } = useAuth();

  if (userData?.type === "self-employed") {
    return <SelfEmployedAnalyticsScreen />;
  }

  return <SalaryAnalyticsScreen />;
}
