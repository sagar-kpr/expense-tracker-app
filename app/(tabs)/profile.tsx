import SalaryProfileScreen from "@/components/SalaryProfileScreen";
import SelfEmployedProfileScreen from "@/components/SelfEmployedProfileScreen";
import { useAuth } from "@/context/AuthContext";

export default function ProfileScreen() {
  const { userData } = useAuth();

  if (userData?.type === "self-employed") {
    return <SelfEmployedProfileScreen />;
  }

  return <SalaryProfileScreen />;
}
