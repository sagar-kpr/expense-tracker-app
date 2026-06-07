import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { getCategoryMeta } from "@/components/categoryMeta";
import { useTheme } from "@/context/ThemeContext";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RUPEE = "\u20B9";

type CategoryItem = [string, number];

type Props = {
  items: CategoryItem[];
  referenceAmount: number;
  referenceLabel: string;
  totalSpent: number;
};

const formatMoney = (value: number) =>
  `${RUPEE}${Number(value || 0).toLocaleString("en-IN")}`;

export default function CategoryRadialProgress({
  items,
  referenceAmount,
  referenceLabel,
  totalSpent,
}: Props) {
  const { theme } = useTheme();
  const progress = useSharedValue(0);
  const visibleItems = items.filter(([, value]) => value > 0).slice(0, 4);
  const denominator = referenceAmount > 0 ? referenceAmount : totalSpent;

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1200 });
  }, [items, progress, referenceAmount]);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 28,
        marginTop: 24,
        padding: 24,
      }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}
      >
        Category Impact
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{
          color: theme.subText,
          fontSize: 14,
          lineHeight: 20,
          marginTop: 5,
        }}
      >
        Top categories as a share of {referenceLabel}
      </Text>

      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          marginTop: 24,
        }}
      >
        <Svg height={228} width={228}>
          {visibleItems.map(([category, value], index) => {
            const radius = 96 - index * 16;
            const circumference = 2 * Math.PI * radius;
            const ratio =
              denominator > 0 ? Math.min(value / denominator, 1) : 0;

            return (
              <React.Fragment key={category}>
                <Circle
                  cx="114"
                  cy="114"
                  r={radius}
                  fill="none"
                  stroke={theme.border}
                  strokeWidth={9}
                />
                <RadialArc
                  circumference={circumference}
                  color={getCategoryMeta(category).color}
                  progress={progress}
                  radius={radius}
                  ratio={ratio}
                />
              </React.Fragment>
            );
          })}
        </Svg>

        <View
          style={{
            alignItems: "center",
            position: "absolute",
            width: 112,
          }}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={{
              color: theme.text,
              fontSize: 25,
              fontWeight: "900",
              textAlign: "center",
              width: "100%",
            }}
          >
            {formatMoney(totalSpent)}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: theme.subText,
              fontSize: 12,
              marginTop: 4,
              textAlign: "center",
              width: "100%",
            }}
          >
            Total spent
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 22 }}>
        {visibleItems.map(([category, value], index) => {
          const meta = getCategoryMeta(category);
          const percent =
            denominator > 0 ? Math.min((value / denominator) * 100, 100) : 0;

          return (
            <View
              key={category}
              style={{
                alignItems: "center",
                borderBottomColor: theme.border,
                borderBottomWidth:
                  index === visibleItems.length - 1 ? 0 : 1,
                flexDirection: "row",
                paddingVertical: 13,
              }}
            >
              <View
                style={{
                  backgroundColor: meta.color,
                  borderRadius: 999,
                  height: 11,
                  marginRight: 12,
                  width: 11,
                }}
              />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  color: theme.text,
                  flex: 1,
                  fontSize: 15,
                  fontWeight: "800",
                  marginRight: 12,
                  minWidth: 0,
                }}
              >
                {category}
              </Text>
              <View
                style={{
                  alignItems: "flex-end",
                  flexShrink: 0,
                  width: 112,
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                  style={{
                    color: theme.text,
                    fontSize: 14,
                    fontWeight: "800",
                    textAlign: "right",
                    width: "100%",
                  }}
                >
                  {formatMoney(value)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: theme.subText,
                    fontSize: 12,
                    marginTop: 3,
                    textAlign: "right",
                    width: "100%",
                  }}
                >
                  {percent.toFixed(percent < 1 ? 1 : 0)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function RadialArc({
  circumference,
  color,
  progress,
  radius,
  ratio,
}: {
  circumference: number;
  color: string;
  progress: SharedValue<number>;
  radius: number;
  ratio: number;
}) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [
      circumference * ratio * progress.value,
      circumference,
    ],
  }));

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      cx="114"
      cy="114"
      fill="none"
      r={radius}
      stroke={color}
      strokeLinecap="round"
      strokeWidth={9}
      transform="rotate(-90 114 114)"
    />
  );
}
