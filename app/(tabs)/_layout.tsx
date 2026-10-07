import { Tabs } from "expo-router";

import { useRef } from "react";
import { SalaryProvider } from "@/context/SalaryContext";
import {
  ExpenseProvider,
  useExpense,
} from "../../context/ExpenseContext";
import { usePendingTransactions } from "@/context/PendingTransactionContext";

import BottomSheet from "@gorhom/bottom-sheet";

import BottomNavbar from "../../components/BottomNavbar";

import ExpenseModal from "../../components/ExpenseModal";
import ScreenSkeleton from "@/components/ScreenSkeleton";
function TabShell() {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const {
    addExpense,
    addExpenseWithFunds,
    loading: expensesLoading,
  } = useExpense();
  const { loading: pendingLoading } = usePendingTransactions();

  const openModal = () => {
    bottomSheetRef.current?.expand();
  };

  if (expensesLoading || pendingLoading) {
    return <ScreenSkeleton variant="dashboard" />;
  }

  return (
    <>
      <Tabs
        tabBar={(props) => <BottomNavbar {...props} openModal={openModal} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
          }}
        />

        <Tabs.Screen
          name="history"
          options={{
            title: "History",
          }}
        />

        <Tabs.Screen
          name="add"
          options={{
            title: "Add",
          }}
        />

        <Tabs.Screen
          name="analytics"
          options={{
            title: "Analytics",
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
          }}
        />
      </Tabs>

      <ExpenseModal
        ref={bottomSheetRef}
        handleAddExpense={addExpense}
        handleAddExpenseWithFunds={addExpenseWithFunds}
      />
    </>
  );
}

export default function TabLayout() {
  return (
    <ExpenseProvider>
      <SalaryProvider>
        <TabShell />
      </SalaryProvider>
    </ExpenseProvider>
  );
}
