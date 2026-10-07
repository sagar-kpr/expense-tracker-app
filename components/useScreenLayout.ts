import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function useScreenLayout() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return {
    singleColumn: width / fontScale < 340,
    compact: width / fontScale < 390,
    contentStyle: {
      paddingTop: insets.top + 16,
      paddingBottom: 24,
      paddingLeft: insets.left + (width < 360 ? 12 : 20),
      paddingRight: insets.right + (width < 360 ? 12 : 20),
    },
  };
}
