// import { Pressable, ScrollView, Text, View } from "react-native";

// import { useMemo, useRef } from "react";

// import { useAuth } from "@/context/AuthContext";
// import BottomSheet from "@gorhom/bottom-sheet";

// import ExpenseModal from "@/components/ExpenseModal";

// import { useExpense } from "@/context/ExpenseContext";

// import { useOnboardingStore } from "@/store/useOnboardingStore";

// export default function HomeScreen() {
//   const bottomSheetRef = useRef<BottomSheet>(null);
//   const { userData } = useAuth();
//   const { expenses, addExpense } = useExpense();

//   const { salary } = useOnboardingStore();

//   const totalSpent = useMemo(
//     () => expenses.reduce((sum, item) => sum + Number(item.amount), 0),
//     [expenses],
//   );

//   const remainingSalary = Number(salary || 0) - totalSpent;

//   const handleAddExpense = async (amount: string, description: string) => {
//     await addExpense(amount, description);
//   };

//   // const totalSpent = expenses.reduce(
//   //   (sum, item) => sum + Number(item.amount),
//   //   0,
//   // );

//   // const remainingSalary = Number(salary || 0) - totalSpent;

//   const daysLeft = 13;

//   const dailyAverage =
//     daysLeft > 0 ? remainingSalary / daysLeft : remainingSalary;

//   // const grouped = expenses.reduce((acc: Record<string, number>, item) => {
//   //   acc[item.category] = (acc[item.category] || 0) + Number(item.amount);

//   //   return acc;
//   // }, {});
//   const grouped = {
//     "0 - 100": 0,
//     "101 - 500": 0,
//     "501 - 1000": 0,
//     "1000+": 0,
//   };

//   expenses.forEach((item) => {
//     const amount = Number(item.amount);

//     if (amount <= 100) {
//       grouped["0 - 100"] += amount;
//     } else if (amount <= 500) {
//       grouped["101 - 500"] += amount;
//     } else if (amount <= 1000) {
//       grouped["501 - 1000"] += amount;
//     } else {
//       grouped["1000+"] += amount;
//     }
//   });

//   const categoryColors: Record<string, string> = {
//     Food: "#22C55E",

//     Travel: "#3B82F6",

//     Shopping: "#F59E0B",

//     Bills: "#EF4444",

//     Other: "#8B5CF6",
//   };

//   return (
//     <>
//       <ScrollView
//         style={{
//           flex: 1,
//           backgroundColor: "#F7F7F7",
//         }}
//         contentContainerStyle={{
//           padding: 20,
//           paddingTop: 70,
//           paddingBottom: 140,
//         }}
//         showsVerticalScrollIndicator={false}
//       >
//         <Text
//           style={{
//             fontSize: 16,
//             color: "#777",
//           }}
//         >
//           Welcome Back 👋
//         </Text>
//         <Text
//           style={{
//             fontSize: 32,
//             fontWeight: "800",
//             color: "#111",
//             marginTop: 8,
//           }}
//         >
//           Dashboard
//         </Text>
//         <View
//           style={{
//             backgroundColor: "#6C63FF",
//             borderRadius: 30,
//             padding: 24,
//             marginTop: 30,
//           }}
//         >
//           <Text
//             style={{
//               color: "rgba(255,255,255,0.8)",
//               fontSize: 15,
//             }}
//           >
//             Remaining Balance
//           </Text>

//           <Text
//             style={{
//               color: "white",
//               fontSize: 38,
//               fontWeight: "800",
//               marginTop: 12,
//             }}
//           >
//             ₹{remainingSalary.toLocaleString()}
//           </Text>

//           <View
//             style={{
//               height: 1,
//               backgroundColor: "rgba(255,255,255,0.15)",
//               marginVertical: 22,
//             }}
//           />

//           <View
//             style={{
//               flexDirection: "row",
//               justifyContent: "space-between",
//             }}
//           >
//             <View>
//               <Text
//                 style={{
//                   color: "rgba(255,255,255,0.7)",
//                   fontSize: 14,
//                 }}
//               >
//                 Salary
//               </Text>

//               <Text
//                 style={{
//                   color: "white",
//                   fontSize: 22,
//                   fontWeight: "700",
//                   marginTop: 6,
//                 }}
//               >
//                 ₹{Number(salary || 0).toLocaleString()}
//               </Text>
//             </View>

//             <View>
//               <Text
//                 style={{
//                   color: "rgba(255,255,255,0.7)",
//                   fontSize: 14,
//                 }}
//               >
//                 Spent
//               </Text>

//               <Text
//                 style={{
//                   color: "white",
//                   fontSize: 22,
//                   fontWeight: "700",
//                   marginTop: 6,
//                 }}
//               >
//                 ₹{totalSpent.toLocaleString()}
//               </Text>
//             </View>
//           </View>
//         </View>
//         {/* Progress section */}
//         <View
//           style={{
//             backgroundColor: "white",
//             borderRadius: 26,
//             padding: 24,
//             marginTop: 24,
//           }}
//         >
//           <Text
//             style={{
//               fontSize: 22,
//               fontWeight: "700",
//               color: "#111",
//               marginBottom: 22,
//             }}
//           >
//             Monthly Usage
//           </Text>

//           <View
//             style={{
//               height: 18,
//               backgroundColor: "#ECECEC",
//               borderRadius: 999,
//               overflow: "hidden",
//             }}
//           >
//             <View
//               style={{
//                 width: `${Math.min(
//                   100,
//                   (totalSpent / Number(salary || 1)) * 100,
//                 )}%`,
//                 height: "100%",
//                 backgroundColor: remainingSalary > 0 ? "#6C63FF" : "#EF4444",
//                 borderRadius: 999,
//               }}
//             />
//           </View>

//           <View
//             style={{
//               flexDirection: "row",
//               justifyContent: "space-between",
//               marginTop: 14,
//             }}
//           >
//             <Text
//               style={{
//                 color: "#666",
//                 fontSize: 15,
//               }}
//             >
//               Used: {Math.round((totalSpent / Number(salary || 1)) * 100)}%
//             </Text>

//             <Text
//               style={{
//                 color: "#111",
//                 fontWeight: "700",
//                 fontSize: 15,
//               }}
//             >
//               ₹{totalSpent.toLocaleString()}
//             </Text>
//           </View>
//         </View>
//         {/* Overview section */}
//         <View
//           style={{
//             backgroundColor: "white",
//             borderRadius: 26,
//             padding: 24,
//             marginTop: 24,
//           }}
//         >
//           <Text
//             style={{
//               fontSize: 22,
//               fontWeight: "700",
//               color: "#111",
//               marginBottom: 20,
//             }}
//           >
//             Overview
//           </Text>

//           <View
//             style={{
//               flexDirection: "row",
//               justifyContent: "space-between",
//               marginBottom: 18,
//             }}
//           >
//             <Text
//               style={{
//                 color: "#666",
//                 fontSize: 16,
//               }}
//             >
//               Total Spent
//             </Text>

//             <Text
//               style={{
//                 fontWeight: "700",
//                 fontSize: 16,
//                 color: "#111",
//               }}
//             >
//               ₹{totalSpent.toLocaleString()}
//             </Text>
//           </View>

//           <View
//             style={{
//               flexDirection: "row",
//               justifyContent: "space-between",
//               marginBottom: 18,
//             }}
//           >
//             <Text
//               style={{
//                 color: "#666",
//                 fontSize: 16,
//               }}
//             >
//               Days Left
//             </Text>

//             <Text
//               style={{
//                 fontWeight: "700",
//                 fontSize: 16,
//                 color: "#111",
//               }}
//             >
//               {daysLeft} Days
//             </Text>
//           </View>

//           <View
//             style={{
//               flexDirection: "row",
//               justifyContent: "space-between",
//             }}
//           >
//             <Text
//               style={{
//                 color: "#666",
//                 fontSize: 16,
//               }}
//             >
//               Daily Average
//             </Text>

//             <Text
//               style={{
//                 fontWeight: "700",
//                 fontSize: 16,
//                 color: "#111",
//               }}
//             >
//               ₹{Math.max(0, Math.round(dailyAverage)).toLocaleString()}
//             </Text>
//           </View>
//         </View>
//         {/* Category section */}
//         <View
//           style={{
//             backgroundColor: "white",
//             borderRadius: 26,
//             padding: 24,
//             marginTop: 24,
//           }}
//         >
//           <Text
//             style={{
//               fontSize: 22,
//               fontWeight: "700",
//               color: "#111",
//               marginBottom: 20,
//             }}
//           >
//             By Category
//           </Text>

//           {Object.entries(grouped).length === 0 && (
//             <Text
//               style={{
//                 color: "#888",
//               }}
//             >
//               No expenses yet.
//             </Text>
//           )}

//           {Object.entries(grouped).map(([key, value], index) => {
//             const colors = [
//               "#22C55E",
//               "#3B82F6",
//               "#F59E0B",
//               "#EF4444",
//               "#8B5CF6",
//             ];

//             const color = colors[index % colors.length];

//             return (
//               <View
//                 key={key}
//                 style={{
//                   flexDirection: "row",
//                   justifyContent: "space-between",
//                   alignItems: "center",
//                   marginBottom: 14,
//                   backgroundColor: "#F5F5F5",
//                   paddingVertical: 14,
//                   paddingHorizontal: 14,
//                   borderRadius: 18,
//                 }}
//               >
//                 <View
//                   style={{
//                     flexDirection: "row",
//                     alignItems: "center",
//                   }}
//                 >
//                   <View
//                     style={{
//                       width: 12,
//                       height: 12,
//                       borderRadius: 999,
//                       backgroundColor: color,
//                       marginRight: 12,
//                     }}
//                   />

//                   <Text
//                     style={{
//                       color: "#222",
//                       fontSize: 16,
//                       fontWeight: "600",
//                     }}
//                   >
//                     {key}
//                   </Text>
//                 </View>

//                 <Text
//                   style={{
//                     fontWeight: "700",
//                     fontSize: 16,
//                     color: "#111",
//                   }}
//                 >
//                   ₹{Number(value).toLocaleString()}
//                 </Text>
//               </View>
//             );
//           })}
//         </View>
//         {/* <View
//           style={{
//             marginTop: 35,
//           }}
//         >
//           <Text
//             style={{
//               fontSize: 22,
//               fontWeight: "700",
//               color: "#111",
//               marginBottom: 18,
//             }}
//           >
//             Recent Expenses
//           </Text>

//           {expenses.length === 0 ? (
//             <View
//               style={{
//                 backgroundColor: "white",
//                 borderRadius: 24,
//                 padding: 20,
//               }}
//             >
//               <Text
//                 style={{
//                   color: "#888",
//                   textAlign: "center",
//                   fontSize: 15,
//                 }}
//               >
//                 No expenses added yet.
//               </Text>
//             </View>
//           ) : (
//             expenses.map((item) => <ExpenseItem key={item.id} item={item} />)
//           )}
//         </View> */}
//       </ScrollView>

//       <Pressable
//         onPress={() => bottomSheetRef.current?.expand()}
//         style={{
//           position: "absolute",
//           bottom: 40,
//           right: 24,
//           width: 64,
//           height: 64,
//           borderRadius: 999,
//           backgroundColor: "#6C63FF",
//           justifyContent: "center",
//           alignItems: "center",
//           shadowColor: "#000",
//           shadowOpacity: 0.15,
//           shadowRadius: 10,
//           elevation: 10,
//         }}
//       >
//         <Text
//           style={{
//             color: "white",
//             fontSize: 34,
//             marginTop: -2,
//           }}
//         >
//           +
//         </Text>
//       </Pressable>

//       <ExpenseModal ref={bottomSheetRef} handleAddExpense={handleAddExpense} />
//     </>
//   );
// }

import { Pressable, ScrollView, Text, View } from "react-native";

import { useMemo, useRef } from "react";

import BottomSheet from "@gorhom/bottom-sheet";

import ExpenseModal from "@/components/ExpenseModal";

import { useExpense } from "@/context/ExpenseContext";

import { useAuth } from "@/context/AuthContext";

export default function HomeScreen() {
  const bottomSheetRef = useRef<BottomSheet>(null);

  const { expenses, addExpense } = useExpense();

  const { userData } = useAuth();

  const totalSpent = useMemo(
    () => expenses.reduce((sum, item) => sum + Number(item.amount), 0),
    [expenses],
  );

  const remainingSalary = Number(userData?.salary || 0) - totalSpent;

  const handleAddExpense = async (amount: string, description: string) => {
    await addExpense(amount, description);
  };

  const today = new Date();

  const currentDay = today.getDate();

  const salaryDate = Number(userData?.salaryDate || 1);

  let daysLeft = 0;

  if (currentDay <= salaryDate) {
    daysLeft = salaryDate - currentDay;
  } else {
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();

    daysLeft = daysInMonth - currentDay + salaryDate;
  }

  const dailyAverage =
    daysLeft > 0 ? remainingSalary / daysLeft : remainingSalary;

  const grouped = {
    "0 - 100": 0,
    "101 - 500": 0,
    "501 - 1000": 0,
    "1000+": 0,
  };

  expenses.forEach((item) => {
    const amount = Number(item.amount);

    if (amount <= 100) {
      grouped["0 - 100"] += amount;
    } else if (amount <= 500) {
      grouped["101 - 500"] += amount;
    } else if (amount <= 1000) {
      grouped["501 - 1000"] += amount;
    } else {
      grouped["1000+"] += amount;
    }
  });

  return (
    <>
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: "#F7F7F7",
        }}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 70,
          paddingBottom: 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 16,
            color: "#777",
          }}
        >
          Welcome Back 👋
        </Text>

        <Text
          style={{
            fontSize: 32,
            fontWeight: "800",
            color: "#111",
            marginTop: 8,
          }}
        >
          Dashboard
        </Text>

        <View
          style={{
            backgroundColor: "#6C63FF",

            borderRadius: 30,

            padding: 24,

            marginTop: 30,
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.8)",

              fontSize: 15,
            }}
          >
            Remaining Balance
          </Text>

          <Text
            style={{
              color: "white",

              fontSize: 38,

              fontWeight: "800",

              marginTop: 12,
            }}
          >
            ₹{remainingSalary.toLocaleString()}
          </Text>

          <View
            style={{
              height: 1,

              backgroundColor: "rgba(255,255,255,0.15)",

              marginVertical: 22,
            }}
          />

          <View
            style={{
              flexDirection: "row",

              justifyContent: "space-between",
            }}
          >
            <View>
              <Text
                style={{
                  color: "rgba(255,255,255,0.7)",

                  fontSize: 14,
                }}
              >
                Salary
              </Text>

              <Text
                style={{
                  color: "white",

                  fontSize: 22,

                  fontWeight: "700",

                  marginTop: 6,
                }}
              >
                ₹{Number(userData?.salary || 0).toLocaleString()}
              </Text>
            </View>

            <View>
              <Text
                style={{
                  color: "rgba(255,255,255,0.7)",

                  fontSize: 14,
                }}
              >
                Spent
              </Text>

              <Text
                style={{
                  color: "white",

                  fontSize: 22,

                  fontWeight: "700",

                  marginTop: 6,
                }}
              >
                ₹{totalSpent.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "white",

            borderRadius: 26,

            padding: 24,

            marginTop: 24,
          }}
        >
          <Text
            style={{
              fontSize: 22,

              fontWeight: "700",

              color: "#111",

              marginBottom: 22,
            }}
          >
            Monthly Usage
          </Text>

          <View
            style={{
              height: 18,

              backgroundColor: "#ECECEC",

              borderRadius: 999,

              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.min(
                  100,
                  (totalSpent / Number(userData?.salary || 1)) * 100,
                )}%`,

                height: "100%",

                backgroundColor: remainingSalary > 0 ? "#6C63FF" : "#EF4444",

                borderRadius: 999,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",

              justifyContent: "space-between",

              marginTop: 14,
            }}
          >
            <Text
              style={{
                color: "#666",

                fontSize: 15,
              }}
            >
              Used:{" "}
              {Math.round((totalSpent / Number(userData?.salary || 1)) * 100)}%
            </Text>

            <Text
              style={{
                color: "#111",

                fontWeight: "700",

                fontSize: 15,
              }}
            >
              ₹{totalSpent.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* <View
          style={{
            backgroundColor: "white",

            borderRadius: 26,

            padding: 24,

            marginTop: 24,
          }}
        >
          <Text
            style={{
              fontSize: 22,

              fontWeight: "700",

              color: "#111",

              marginBottom: 20,
            }}
          >
            Overview
          </Text>

          <View
            style={{
              flexDirection: "row",

              justifyContent: "space-between",

              marginBottom: 18,
            }}
          >
            <Text
              style={{
                color: "#666",

                fontSize: 16,
              }}
            >
              Total Spent
            </Text>

            <Text
              style={{
                fontWeight: "700",

                fontSize: 16,

                color: "#111",
              }}
            >
              ₹{totalSpent.toLocaleString()}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",

              justifyContent: "space-between",

              marginBottom: 18,
            }}
          >
            <Text
              style={{
                color: "#666",

                fontSize: 16,
              }}
            >
              Days Left
            </Text>

            <Text
              style={{
                fontWeight: "700",

                fontSize: 16,

                color: "#111",
              }}
            >
              {daysLeft} Days
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",

              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                color: "#666",

                fontSize: 16,
              }}
            >
              Daily Average
            </Text>

            <Text
              style={{
                fontWeight: "700",

                fontSize: 16,

                color: "#111",
              }}
            >
              ₹{Math.max(0, Math.round(dailyAverage)).toLocaleString()}
            </Text>
          </View>
        </View> */}

        <View
          style={{
            backgroundColor: "white",

            borderRadius: 26,

            padding: 24,

            marginTop: 24,
          }}
        >
          <Text
            style={{
              fontSize: 22,

              fontWeight: "700",

              color: "#111",

              marginBottom: 20,
            }}
          >
            By Category
          </Text>

          {Object.entries(grouped).map(([key, value], index) => {
            const colors = ["#22C55E", "#3B82F6", "#F59E0B", "#EF4444"];

            const color = colors[index % colors.length];

            return (
              <View
                key={key}
                style={{
                  flexDirection: "row",

                  justifyContent: "space-between",

                  alignItems: "center",

                  marginBottom: 14,

                  backgroundColor: "#F5F5F5",

                  paddingVertical: 14,

                  paddingHorizontal: 14,

                  borderRadius: 18,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",

                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 12,

                      height: 12,

                      borderRadius: 999,

                      backgroundColor: color,

                      marginRight: 12,
                    }}
                  />

                  <Text
                    style={{
                      color: "#222",

                      fontSize: 16,

                      fontWeight: "600",
                    }}
                  >
                    {key}
                  </Text>
                </View>

                <Text
                  style={{
                    fontWeight: "700",

                    fontSize: 16,

                    color: "#111",
                  }}
                >
                  ₹{Number(value).toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => bottomSheetRef.current?.expand()}
        style={{
          position: "absolute",

          bottom: 40,

          right: 24,

          width: 64,

          height: 64,

          borderRadius: 999,

          backgroundColor: "#6C63FF",

          justifyContent: "center",

          alignItems: "center",

          shadowColor: "#000",

          shadowOpacity: 0.15,

          shadowRadius: 10,

          elevation: 10,
        }}
      >
        <Text
          style={{
            color: "white",

            fontSize: 34,

            marginTop: -2,
          }}
        >
          +
        </Text>
      </Pressable>

      <ExpenseModal ref={bottomSheetRef} handleAddExpense={handleAddExpense} />
    </>
  );
}
