import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import {
  AssetCycler,
  PlaylistCycle,
  WebviewAsset,
} from "../utils/assetDownloader";

interface SignageWebviewProps {
  playlistCycle: PlaylistCycle;
  onAssetChange?: (asset: WebviewAsset, remainingTime: number) => void;
  onError?: (error: string) => void;
}

const SignageWebview: React.FC<SignageWebviewProps> = ({
  playlistCycle,
  onAssetChange,
  onError,
}) => {
  const [currentAsset, setCurrentAsset] = useState<WebviewAsset | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cyclerRef = useRef<AssetCycler | null>(null);
  const webViewRef = useRef<WebView>(null);

  // Create HTML content for different asset types
  const createAssetHTML = (asset: WebviewAsset): string => {
    const baseHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 0;
              background: #000;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              font-family: Arial, sans-serif;
              overflow: hidden;
            }
            .asset-container {
              width: 100%;
              height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .asset-content {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
            }
            .text-content {
              color: white;
              font-size: 24px;
              text-align: center;
              padding: 20px;
              word-wrap: break-word;
            }
            .loading {
              color: white;
              font-size: 18px;
              text-align: center;
            }
            .error {
              color: red;
              font-size: 18px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="asset-container">
    `;

    let contentHTML = "";

    switch (asset.filetype.toLowerCase()) {
      case "image":
        contentHTML = `<img src="file://${asset.displayPath}" class="asset-content" alt="${asset.name}" />`;
        break;

      case "video":
        contentHTML = `
          <video 
            class="asset-content" 
            autoplay 
            muted 
            loop
            playsinline
            src="file://${asset.displayPath}"
          >
            Your browser does not support the video tag.
          </video>
        `;
        break;

      case "audio":
        contentHTML = `
          <audio 
            autoplay 
            loop
            src="file://${asset.displayPath}"
          >
            Your browser does not support the audio tag.
          </audio>
          <div class="text-content">${asset.name}</div>
        `;
        break;

      case "stream":
        contentHTML = `
          <video 
            class="asset-content" 
            autoplay 
            muted 
            loop
            playsinline
          >
            <source src="${asset.displayPath}" type="application/x-mpegURL">
            Your browser does not support HLS streams.
          </video>
        `;
        break;

      case "text":
        contentHTML = `<div class="text-content">${asset.name}</div>`;
        break;

      default:
        contentHTML = `<div class="text-content">Unsupported file type: ${asset.filetype}</div>`;
    }

    return (
      baseHTML +
      contentHTML +
      `
          </div>
        </body>
      </html>
    `
    );
  };

  // Handle asset changes from cycler
  const handleAssetChange = (asset: WebviewAsset, remainingTime: number) => {
    setCurrentAsset(asset);
    setRemainingTime(remainingTime);
    setIsLoading(false);
    setError(null);

    // Notify parent component
    onAssetChange?.(asset, remainingTime);
  };

  // Initialize the cycler
  useEffect(() => {
    if (!playlistCycle || playlistCycle.assets.length === 0) {
      setError("No assets available in playlist");
      onError?.("No assets available in playlist");
      return;
    }

    // Create cycler with custom asset change handler
    cyclerRef.current = new AssetCycler(playlistCycle, handleAssetChange);

    // Check if playlist is active based on date constraints
    const dateStatus = cyclerRef.current.getDateStatus();

    if (!dateStatus.isActive) {
      let message = `Playlist "${playlistCycle.playlistName}" is not active`;

      if (dateStatus.timeUntilStart) {
        const hoursUntilStart = Math.floor(
          dateStatus.timeUntilStart / (1000 * 60 * 60)
        );
        const minutesUntilStart = Math.floor(
          (dateStatus.timeUntilStart % (1000 * 60 * 60)) / (1000 * 60)
        );
        message += ` - starts in ${hoursUntilStart}h ${minutesUntilStart}m`;
      } else if (
        dateStatus.timeUntilEnd !== null &&
        dateStatus.timeUntilEnd === 0
      ) {
        message += " - has ended";
      }

      setError(message);
      onError?.(message);
      return;
    }

    // Start cycling
    cyclerRef.current.startCycle();
    setIsLoading(true);

    // Cleanup on unmount
    return () => {
      cyclerRef.current?.stopCycle();
    };
  }, [playlistCycle]);

  // Handle WebView errors
  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    const errorMessage = `WebView error: ${nativeEvent.description}`;
    setError(errorMessage);
    onError?.(errorMessage);
  };

  // Handle WebView load state
  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (isLoading || !currentAsset) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>
          Loading {playlistCycle.playlistName}...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: createAssetHTML(currentAsset) }}
        style={styles.webview}
        onError={handleWebViewError}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        bounces={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowsBackForwardNavigationGestures={false}
        allowsLinkPreview={false}
        hideKeyboardAccessoryView={true}
      />

      {/* Optional: Display current asset info overlay */}
      <View style={styles.overlay}>
        <Text style={styles.assetInfo}>
          {currentAsset.name} - {remainingTime}s remaining
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 10,
    borderRadius: 5,
  },
  assetInfo: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  loadingText: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
    marginTop: 50,
  },
  errorText: {
    color: "red",
    fontSize: 18,
    textAlign: "center",
    marginTop: 50,
  },
});

export default SignageWebview;
