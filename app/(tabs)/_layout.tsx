import { Tabs } from "expo-router";

import { useRef } from "react";
import { useExpense } from "../../context/ExpenseContext";

import BottomSheet from "@gorhom/bottom-sheet";

import BottomNavbar from "../../components/BottomNavbar";

import ExpenseModal from "../../components/ExpenseModal";

export default function TabLayout() {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const { addExpense } = useExpense();

  const openModal = () => {
    bottomSheetRef.current?.expand();
  };

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

      <ExpenseModal ref={bottomSheetRef} handleAddExpense={addExpense} />
    </>
  );
}
