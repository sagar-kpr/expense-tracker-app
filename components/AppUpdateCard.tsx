import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, Text, TouchableOpacity, View } from "react-native";

import { db } from "@/firebase";
import { useTheme } from "@/context/ThemeContext";

type UpdateInfo = {
  apkUrl?: string;
  latestBuildVersion?: number | string;
  message?: string;
  title?: string;
};

const parseBuildVersion = (value: number | string | null | undefined) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

export default function AppUpdateCard() {
  const { theme } = useTheme();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  const currentBuildVersion = useMemo(
    () => parseBuildVersion(Application.nativeBuildVersion),
    [],
  );
  const latestBuildVersion = parseBuildVersion(updateInfo?.latestBuildVersion);
  const apkUrl = updateInfo?.apkUrl;
  const hasUpdate =
    Platform.OS === "android" &&
    !!apkUrl &&
    latestBuildVersion > currentBuildVersion;

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    return onSnapshot(doc(db, "appConfig", "android"), (snapshot) => {
      setUpdateInfo(snapshot.exists() ? (snapshot.data() as UpdateInfo) : null);
    });
  }, []);

  if (!hasUpdate) {
    return null;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => Linking.openURL(apkUrl)}
      style={{
        alignItems: "center",
        backgroundColor: theme.primary,
        borderRadius: 20,
        flexDirection: "row",
        marginTop: 20,
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.18)",
          borderRadius: 16,
          height: 42,
          justifyContent: "center",
          marginRight: 12,
          width: 42,
        }}
      >
        <Ionicons name="cloud-download" size={21} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: "900",
          }}
        >
          {updateInfo?.title || "New update available"}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            color: "rgba(255,255,255,0.82)",
            fontSize: 12,
            lineHeight: 17,
            marginTop: 4,
          }}
        >
          {updateInfo?.message || "Tap to download and install the latest APK."}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
    </TouchableOpacity>
  );
}
