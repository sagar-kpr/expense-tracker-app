import { useState } from "react";
import { StyleSheet, Text, TextProps, useWindowDimensions } from "react-native";
import { formatCompactMoney, formatMoney } from "@/utils/money";

type Props = Omit<TextProps, "children"> & {
  value: number;
  hidden?: boolean;
  prefix?: string;
  suffix?: string;
};

/** Keep amounts readable in bounded tiles; expose the exact value to screen readers. */
export default function MoneyText({
  value,
  hidden = false,
  prefix = "",
  suffix = "",
  style,
  onLayout,
  ...props
}: Props) {
  const [measurement, setMeasurement] = useState<{
    key: string;
    width: number;
  }>();
  const { width, fontScale } = useWindowDimensions();
  const fullAmount = hidden
    ? "₹ ••••••"
    : `${prefix}${formatMoney(value)}${suffix}`;
  const fontSize = StyleSheet.flatten(style)?.fontSize || 14;
  const measurementKey = `${width}:${fontScale}:${fontSize}`;
  const availableWidth =
    measurement?.key === measurementKey ? measurement.width : 0;
  const multiplier =
    props.allowFontScaling === false
      ? 1
      : Math.min(fontScale, props.maxFontSizeMultiplier || fontScale);
  const needsCompact =
    !hidden &&
    availableWidth > 0 &&
    fullAmount.length * fontSize * multiplier * 0.64 > availableWidth;
  const displayAmount = needsCompact
    ? `${prefix}${formatCompactMoney(value)}${suffix}`
    : fullAmount;
  const fittedFontSize =
    availableWidth > 0
      ? Math.min(
          fontSize,
          availableWidth / (displayAmount.length * multiplier * 0.64),
        )
      : fontSize;
  return (
    <Text
      {...props}
      style={[
        style,
        { fontSize: fittedFontSize, fontVariant: ["tabular-nums"] },
      ]}
      accessibilityLabel={hidden ? "Amount hidden" : fullAmount}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
      onLayout={(event) => {
        const measuredWidth = event.nativeEvent.layout.width;
        setMeasurement((previous) =>
          previous?.key === measurementKey
            ? previous
            : { key: measurementKey, width: measuredWidth },
        );
        onLayout?.(event);
      }}
    >
      {displayAmount}
    </Text>
  );
}
