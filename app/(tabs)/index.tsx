import SalaryDashboard from "@/components/SalaryDashboard";
import SelfEmployedDashboard from "@/components/SelfEmployedDashboard";
import { useAuth } from "@/context/AuthContext";

export default function HomeScreen() {
  const { userData } = useAuth();

  if (userData?.type === "self-employed") {
    return <SelfEmployedDashboard />;
  }

  return <SalaryDashboard />;
}
