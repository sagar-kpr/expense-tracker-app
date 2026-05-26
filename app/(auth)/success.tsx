import { Pressable, Text, View } from "react-native";

import { router } from "expo-router";

import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useEffect } from "react";

import * as Haptics from "expo-haptics";

import Svg, { Circle } from "react-native-svg";

export default function SuccessScreen() {
  const scale = useSharedValue(0.7);

  const rotate = useSharedValue(0);

  const glow = useSharedValue(0.5);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    scale.value = withSpring(1, {
      damping: 10,

      stiffness: 120,
    });

    rotate.value = withRepeat(
      withSequence(
        withTiming(8, {
          duration: 1400,
        }),

        withTiming(-8, {
          duration: 1400,
        }),
      ),

      -1,

      true,
    );

    glow.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 1200,
        }),

        withTiming(0.5, {
          duration: 1200,
        }),
      ),

      -1,

      true,
    );
  }, []);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: scale.value,
      },

      {
        rotate: `${rotate.value}deg`,
      },
    ],

    opacity: glow.value,
  }));

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    router.replace("/(tabs)" as any);
  };

  return (
    <View
      style={{
        flex: 1,

        backgroundColor: "#F5F5F5",

        paddingHorizontal: 28,

        justifyContent: "center",

        alignItems: "center",

        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",

          width: 260,

          height: 260,

          borderRadius: 999,

          backgroundColor: "#6C63FF10",

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

          backgroundColor: "#6C63FF08",

          bottom: -50,

          left: -40,
        }}
      />

      <Animated.View
        entering={FadeIn.duration(800)}
        style={{
          position: "absolute",
        }}
      >
        <Svg width={260} height={260}>
          <Circle
            cx="130"
            cy="130"
            r="95"
            stroke="#6C63FF20"
            strokeWidth="2"
            fill="none"
          />

          <Circle
            cx="130"
            cy="130"
            r="115"
            stroke="#6C63FF10"
            strokeWidth="2"
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          {
            width: 140,

            height: 140,

            borderRadius: 999,

            backgroundColor: "#E9E7FF",

            justifyContent: "center",

            alignItems: "center",

            shadowColor: "#6C63FF",

            shadowOpacity: 0.28,

            shadowRadius: 25,

            shadowOffset: {
              width: 0,

              height: 12,
            },

            elevation: 14,
          },

          animatedIconStyle,
        ]}
      >
        <Text
          style={{
            fontSize: 62,
          }}
        >
          🎉
        </Text>
      </Animated.View>

      <Animated.Text
        entering={FadeInUp.delay(250).duration(700)}
        style={{
          fontSize: 38,

          fontWeight: "800",

          color: "#111",

          marginTop: 44,

          textAlign: "center",

          letterSpacing: -1,
        }}
      >
        All Set!
      </Animated.Text>

      <Animated.Text
        entering={FadeInUp.delay(450).duration(700)}
        style={{
          fontSize: 16,

          color: "#777",

          marginTop: 20,

          lineHeight: 28,

          textAlign: "center",

          paddingHorizontal: 20,
        }}
      >
        Your expense tracker is ready to help you manage money smarter and stay
        in control every month.
      </Animated.Text>

      <Animated.View
        entering={FadeInDown.delay(700).duration(700)}
        style={{
          width: "100%",
        }}
      >
        <Pressable
          onPress={handleContinue}
          style={{
            backgroundColor: "#6C63FF",

            paddingVertical: 18,

            borderRadius: 22,

            width: "100%",

            marginTop: 65,

            shadowColor: "#6C63FF",

            shadowOpacity: 0.25,

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
            Continue
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
