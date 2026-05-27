import SalaryHistoryScreen from "@/components/SalaryHistoryScreen";
import SelfEmployedHistoryScreen from "@/components/SelfEmployedHistoryScreen";
import { useAuth } from "@/context/AuthContext";

export default function HistoryScreen() {
  const { userData } = useAuth();

  if (userData?.type === "self-employed") {
    return <SelfEmployedHistoryScreen />;
  }

  return <SalaryHistoryScreen />;
}
