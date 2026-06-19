// import { Pressable, Text, View } from "react-native";

// import { router } from "expo-router";

// export default function WelcomeScreen() {
//   return (
//     <View
//       style={{
//         flex: 1,
//         backgroundColor: "#F5F5F5",
//         paddingHorizontal: 28,
//         justifyContent: "center",
//       }}
//     >
//       <View>
//         <Text
//           style={{
//             fontSize: 44,
//             fontWeight: "800",
//             color: "#111",
//             lineHeight: 52,
//           }}
//         >
//           Expense{"\n"}
//           <Text
//             style={{
//               color: "#159B7D",
//             }}
//           >
//             Tracker
//           </Text>
//         </Text>

//         <Text
//           style={{
//             fontSize: 18,
//             color: "#666",
//             marginTop: 18,
//             lineHeight: 28,
//           }}
//         >
//           Track Simply, Live Freely
//         </Text>

//         <Text
//           style={{
//             fontSize: 15,
//             color: "#888",
//             marginTop: 30,
//             lineHeight: 24,
//           }}
//         >
//           A minimal and smart expense tracker for salary and self-employed
//           people.
//         </Text>

//         <View
//           style={{
//             marginTop: 35,
//             gap: 18,
//           }}
//         >
//           {[
//             "Quick Add Expense",
//             "Smart Categories",
//             "Salary Cycle View",
//             "Beautiful Analytics",
//           ].map((item) => (
//             <View
//               key={item}
//               style={{
//                 flexDirection: "row",
//                 alignItems: "center",
//               }}
//             >
//               <View
//                 style={{
//                   width: 10,
//                   height: 10,
//                   borderRadius: 999,
//                   backgroundColor: "#159B7D",
//                   marginRight: 12,
//                 }}
//               />

//               <Text
//                 style={{
//                   fontSize: 15,
//                   color: "#444",
//                   fontWeight: "500",
//                 }}
//               >
//                 {item}
//               </Text>
//             </View>
//           ))}
//         </View>
//       </View>

//       <Pressable
//         onPress={() => router.push("/(auth)/login")}
//         style={{
//           backgroundColor: "#159B7D",
//           paddingVertical: 18,
//           borderRadius: 20,
//           marginTop: 60,
//         }}
//       >
//         <Text
//           style={{
//             color: "white",
//             textAlign: "center",
//             fontSize: 18,
//             fontWeight: "700",
//           }}
//         >
//           Get Started
//         </Text>
//       </Pressable>
//     </View>
//   );
// }

import { Platform, Pressable, Text, View } from "react-native";

import { router } from "expo-router";

import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";

import * as Haptics from "expo-haptics";

export default function WelcomeScreen() {
  return (
    <View
      style={{
        flex: 1,

        backgroundColor: "#F5F5F5",

        paddingHorizontal: 28,

        justifyContent: "center",

        overflow: "hidden",
      }}
    >
      {/* <View
        style={{
          position: "absolute",

          width: 260,

          height: 260,

          borderRadius: 999,

          backgroundColor: "#159B7D10",

          top: -80,

          right: -80,
        }}
      />

      <View
        style={{
          position: "absolute",

          width: 180,

          height: 180,

          borderRadius: 999,

          backgroundColor: "#159B7D08",

          bottom: -50,

          left: -40,
        }}
      /> */}

      <View>
        <Animated.Text
          entering={FadeInUp.duration(450)}
          style={{
            fontSize: 46,

            fontWeight: "800",

            color: "#111",

            lineHeight: 56,

            letterSpacing: 0,
          }}
        >
          Expense{"\n"}
          <Text
            style={{
              color: "#159B7D",
            }}
          >
            Tracker
          </Text>
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(80).duration(450)}
          style={{
            fontSize: 19,

            color: "#555",

            marginTop: 20,

            lineHeight: 30,

            fontWeight: "600",
          }}
        >
          Track Simply, Live Freely
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(140).duration(450)}
          style={{
            fontSize: 15,

            color: "#5F6B6D",

            marginTop: 28,

            lineHeight: 25,
          }}
        >
          A minimal and smart expense tracker for salary and self-employed
          people.
        </Animated.Text>

        <View
          style={{
            marginTop: 42,

            gap: 18,
          }}
        >
          {[
            "Quick Add Expense",
            "Smart Categories",
            "Salary Cycle View",
            "Beautiful Analytics",
          ].map((item, index) => (
            <Animated.View
              key={item}
              entering={FadeInDown.delay(180 + index * 70).duration(450)}
              style={{
                flexDirection: "row",

                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 11,

                  height: 11,

                  borderRadius: 999,

                  backgroundColor: "#159B7D",

                  marginRight: 14,
                }}
              />

              <Text
                style={{
                  fontSize: 15,

                  color: "#444",

                  fontWeight: "600",
                }}
              >
                {item}
              </Text>
            </Animated.View>
          ))}
        </View>
      </View>

      <Animated.View entering={FadeIn.delay(260).duration(450)}>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }

            router.push("/(auth)/login");
          }}
          style={{
            backgroundColor: "#159B7D",

            paddingVertical: 18,

            borderRadius: 22,

            marginTop: 65,

            shadowColor: "#159B7D",

            shadowOpacity: 0.28,

            shadowRadius: 18,

            shadowOffset: {
              width: 0,

              height: 10,
            },

            elevation: 10,
          }}
        >
          <Text
            style={{
              color: "white",

              textAlign: "center",

              fontSize: 18,

              fontWeight: "800",

              letterSpacing: 0.3,
            }}
          >
            Get Started
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
