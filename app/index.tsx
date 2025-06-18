import React, { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import SignageWebview from "../components/SignageWebview";
import { PlaylistCycle, WebviewAsset } from "../utils/assetDownloader";
import {
  getNextScheduledPlaylist,
  getPlaylistTimingMessage,
  isPlaylistActive,
} from "../utils/dateUtils";
import initializeDigitalSignage, {
  ProgressCallback,
} from "../utils/initialization";

export default function Index() {
  const [currentPlaylist, setCurrentPlaylist] = useState<PlaylistCycle | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [initializationProgress, setInitializationProgress] =
    useState<string>("Initializing...");

  useEffect(() => {
    startInitialization();
  }, []);

  const startInitialization = async () => {
    try {
      // Replace with your actual API URL
      const apiURL = "https://your-api-endpoint.com/signage-data";

      const result = await initializeDigitalSignage(
        apiURL,
        {
          clearAssetsOnStart: true,
          enableProgressTracking: true,
          maxRetries: 3,
        },
        (progress: ProgressCallback) => {
          setInitializationProgress(progress.message);
          console.log(
            `📊 ${progress.stage}: ${progress.message} ${
              progress.progress ? `(${progress.progress}%)` : ""
            }`
          );
        }
      );

      if (result.success && result.playlistCycles) {
        // Find the first active playlist based on date constraints
        let activePlaylist = null;

        // First try to find the default playlist if it's active
        const defaultPlaylist = result.playlistCycles.find((p) => p.isDefault);
        if (
          defaultPlaylist &&
          isPlaylistActive(defaultPlaylist.startDate, defaultPlaylist.endDate)
        ) {
          activePlaylist = defaultPlaylist;
        }

        // If no default playlist is active, find any active playlist
        if (!activePlaylist) {
          activePlaylist = result.playlistCycles.find((playlist) =>
            isPlaylistActive(playlist.startDate, playlist.endDate)
          );
        }

        if (activePlaylist) {
          setCurrentPlaylist(activePlaylist);
          console.log(
            `🎬 Starting digital signage display with playlist: ${activePlaylist.playlistName}`
          );
        } else {
          // Check if any playlists are scheduled for the future
          const nextPlaylist = getNextScheduledPlaylist(result.playlistCycles);

          if (nextPlaylist) {
            const message = getPlaylistTimingMessage(
              nextPlaylist.playlistName,
              nextPlaylist.startDate,
              nextPlaylist.endDate
            );
            throw new Error(`No active playlists. ${message}`);
          } else {
            throw new Error(
              "No active playlists available and no future playlists scheduled"
            );
          }
        }
      } else {
        throw new Error(result.error || "Initialization failed");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Initialization failed:", errorMessage);

      // On TV, show error in UI instead of alert
      if (Platform.OS === "android") {
        setInitializationProgress(`Error: ${errorMessage}`);
      } else {
        Alert.alert("Initialization Error", errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssetChange = (asset: WebviewAsset, remainingTime: number) => {
    console.log(`🎬 Now playing: ${asset.name} (${remainingTime}s remaining)`);
  };

  const handleError = (error: string) => {
    console.error("❌ Signage error:", error);

    // On TV, show error in UI instead of alert
    if (Platform.OS === "android") {
      setInitializationProgress(`Signage Error: ${error}`);
    } else {
      Alert.alert("Signage Error", error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Digital Signage</Text>
          <Text style={styles.progressText}>{initializationProgress}</Text>
        </View>
      </View>
    );
  }

  if (!currentPlaylist) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No playlist available</Text>
          <Text style={styles.retryText}>
            {Platform.OS === "android"
              ? "Press OK on remote to retry"
              : "Tap to retry"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SignageWebview
        playlistCycle={currentPlaylist}
        onAssetChange={handleAssetChange}
        onError={handleError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  progressText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    opacity: 0.8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "red",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  retryText: {
    color: "white",
    fontSize: 16,
    textDecorationLine: "underline",
  },
});
