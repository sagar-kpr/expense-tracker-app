import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";

type ScreenSkeletonVariant =
  | "analytics"
  | "dashboard"
  | "history"
  | "pending"
  | "profile";

type ScreenSkeletonProps = {
  variant?: ScreenSkeletonVariant;
};

const variantRows: Record<ScreenSkeletonVariant, number[]> = {
  analytics: [72, 170, 44, 44, 120, 72],
  dashboard: [96, 116, 52, 52, 160, 72, 72],
  history: [44, 48, 84, 84, 84, 84, 84],
  pending: [56, 108, 92, 92, 92, 92],
  profile: [104, 72, 72, 72, 72, 120],
};

export default function ScreenSkeleton({
  variant = "dashboard",
}: ScreenSkeletonProps) {
  const { theme, dark } = useTheme();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 720 }),
        withTiming(0.55, { duration: 720 }),
      ),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const blockColor = dark ? "#242936" : "#E7ECEA";
  const highlightColor = dark ? "#303747" : "#F1F5F3";
  const rows = variantRows[variant];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Loading content"
    >
      <Animated.View style={[animatedStyle, styles.header]}>
        <View style={[styles.title, { backgroundColor: blockColor }]} />
        <View style={[styles.subtitle, { backgroundColor: blockColor }]} />
      </Animated.View>

      <View style={styles.grid}>
        {rows.map((height, index) => (
          <Animated.View
            key={`${variant}-${height}-${index}`}
            style={[
              animatedStyle,
              styles.card,
              {
                backgroundColor: index % 2 === 0 ? blockColor : highlightColor,
                borderColor: theme.border,
                height,
              },
            ]}
          >
            {height >= 72 && (
              <>
                <View
                  style={[
                    styles.cardLine,
                    {
                      backgroundColor:
                        index % 2 === 0 ? highlightColor : blockColor,
                      width: index % 3 === 0 ? "48%" : "68%",
                    },
                  ]}
                />
                <View
                  style={[
                    styles.cardLine,
                    styles.shortLine,
                    {
                      backgroundColor:
                        index % 2 === 0 ? highlightColor : blockColor,
                    },
                  ]}
                />
              </>
            )}
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  cardLine: {
    borderRadius: 999,
    height: 12,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    paddingTop: 60,
  },
  grid: {
    gap: 14,
    marginTop: 26,
  },
  header: {
    gap: 12,
  },
  shortLine: {
    marginTop: 12,
    width: "34%",
  },
  subtitle: {
    borderRadius: 999,
    height: 14,
    width: "54%",
  },
  title: {
    borderRadius: 999,
    height: 30,
    width: "72%",
  },
});
