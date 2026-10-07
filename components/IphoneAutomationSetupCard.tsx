import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const WORKER_BASE_URL =
  "https://expense-tracker-sms-ai.expense-tracker-sagar.workers.dev";
const SETUP_VIDEO_URL = "";

export default function IphoneAutomationSetupCard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const endpoint = useMemo(() => {
    if (!user?.uid) {
      return "";
    }

    return `${WORKER_BASE_URL}/api/${user.uid}/pending-transactions`;
  }, [user?.uid]);
  const hasSetupVideo = Boolean(SETUP_VIDEO_URL.trim());

  const handleCopy = async (value: string) => {
    if (!value) {
      return;
    }

    await Clipboard.setStringAsync(value);
    setCopyState("copied");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );

    setTimeout(() => {
      setCopyState("idle");
    }, 1800);
  };

  if (Platform.OS === "android" || !user?.uid) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 28,
        marginTop: 24,
        overflow: "hidden",
        padding: 22,
      }}
    >
      <Text
        style={{
          color: theme.text,
          fontSize: 20,
          fontWeight: "900",
        }}
      >
        Auto Detect Setup
      </Text>
      <Text
        style={{
          color: theme.subText,
          fontSize: 13,
          lineHeight: 19,
          marginTop: 8,
        }}
      >
        Copy this personal endpoint into your phone automation. Your uid is
        already inside the URL, so no token or secret key is needed.
      </Text>

      <View
        style={{
          backgroundColor: theme.background,
          borderColor: theme.border,
          borderRadius: 18,
          borderWidth: 1,
          marginTop: 16,
          padding: 14,
        }}
      >
        <Text
          selectable
          style={{
            color: theme.text,
            fontSize: 13,
            lineHeight: 20,
            fontFamily: Platform.OS === "web" ? "monospace" : undefined,
          }}
        >
          {endpoint}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: 12,
          marginTop: 14,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleCopy(endpoint)}
          style={{
            alignItems: "center",
            backgroundColor: theme.primary,
            borderRadius: 18,
            flex: 1,
            paddingVertical: 14,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: "800",
            }}
          >
            Copy Endpoint
          </Text>
        </TouchableOpacity>
      </View>

      {hasSetupVideo && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            Linking.openURL(SETUP_VIDEO_URL).catch(() => {});
          }}
          style={{
            alignItems: "center",
            backgroundColor: theme.border,
            borderRadius: 18,
            marginTop: 12,
            paddingVertical: 14,
          }}
        >
          <Text
            style={{
              color: theme.text,
              fontSize: 14,
              fontWeight: "800",
            }}
          >
            Watch Setup Video
          </Text>
        </TouchableOpacity>
      )}

      <Text
        style={{
          color: theme.subText,
          fontSize: 12,
          lineHeight: 18,
          marginTop: 12,
        }}
      >
        Step 1: Copy the endpoint above.
        {"\n"}Step 2: Open Shortcuts or automation app and create a new Message
        automation.
        {"\n"}Step 3: Set the trigger keyword like debited or credited.
        {"\n"}Step 4: Add Get Contents of URL and paste the endpoint.
        {"\n"}Step 5: Send the full SMS text in the request body.
      </Text>

      {copyState === "copied" && (
        <Text
          style={{
            color: theme.primary,
            fontSize: 12,
            fontWeight: "700",
            marginTop: 10,
          }}
        >
          Copied
        </Text>
      )}
    </View>
  );
}
