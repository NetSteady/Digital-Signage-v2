import * as fs from "fs";
import * as path from "path";
import downloadAssets, {
  DownloadResult,
  PlaylistCycle,
} from "./assetDownloader";
import getDeviceName from "./deviceInfo";
import getData, { ApiResponse } from "./getInstructions";

interface InitializationConfig {
  apiURL: string;
  assetsDir?: string;
  clearAssetsOnStart?: boolean;
  enableProgressTracking?: boolean;
  maxRetries?: number;
}

interface InitializationResult {
  success: boolean;
  deviceName?: string;
  apiResponse?: ApiResponse;
  downloadResults?: DownloadResult[];
  playlistCycles?: PlaylistCycle[];
  defaultPlaylist?: PlaylistCycle;
  error?: string;
  stats?: {
    totalAssets: number;
    successfulDownloads: number;
    failedDownloads: number;
    streamsKept: number;
    totalPlaylists: number;
    initializationTime: number;
  };
}

interface ProgressCallback {
  stage: "clearing" | "device-info" | "api-fetch" | "downloading" | "complete";
  message: string;
  progress?: number; // 0-100
  current?: number;
  total?: number;
}

class DigitalSignageInitializer {
  private config: InitializationConfig;
  private startTime: number;

  constructor(config: InitializationConfig) {
    this.config = {
      assetsDir: "./assets/main",
      clearAssetsOnStart: true,
      enableProgressTracking: true,
      maxRetries: 3,
      ...config,
    };
    this.startTime = Date.now();
  }

  /**
   * Main initialization function that orchestrates the entire setup process
   */
  async initialize(
    onProgress?: (progress: ProgressCallback) => void
  ): Promise<InitializationResult> {
    try {
      console.log("🚀 Starting Digital Signage initialization...");

      // Stage 1: Clear assets directory
      if (this.config.clearAssetsOnStart) {
        await this.clearAssetsDirectory(onProgress);
      }

      // Stage 2: Get device information
      const deviceName = await this.getDeviceInformation(onProgress);

      // Stage 3: Fetch and parse API data
      const apiResponse = await this.fetchApiData(onProgress);

      // Stage 4: Download and process assets
      const { downloadResults, playlistCycles } =
        await this.downloadAndProcessAssets(apiResponse, onProgress);

      // Stage 5: Prepare final result
      const result = this.prepareFinalResult(
        deviceName,
        apiResponse,
        downloadResults,
        playlistCycles
      );

      // Complete
      onProgress?.({
        stage: "complete",
        message: "Initialization completed successfully!",
        progress: 100,
      });

      console.log("✅ Digital Signage initialization completed successfully!");
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown initialization error";
      console.error("❌ Initialization failed:", errorMessage);

      onProgress?.({
        stage: "complete",
        message: `Initialization failed: ${errorMessage}`,
        progress: 0,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Stage 1: Clear the assets directory
   */
  private async clearAssetsDirectory(
    onProgress?: (progress: ProgressCallback) => void
  ): Promise<void> {
    onProgress?.({
      stage: "clearing",
      message: "Clearing assets directory...",
      progress: 0,
    });

    return new Promise((resolve, reject) => {
      const assetsDir = this.config.assetsDir!;

      // Ensure directory exists
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
        console.log(`📁 Created assets directory: ${assetsDir}`);
        resolve();
        return;
      }

      // Clear directory contents
      fs.readdir(assetsDir, { withFileTypes: true }, (err, entries) => {
        if (err) {
          console.error(`❌ Error reading directory ${assetsDir}:`, err);
          reject(err);
          return;
        }

        if (entries.length === 0) {
          console.log("📁 Assets directory is already empty");
          resolve();
          return;
        }

        let completed = 0;
        const total = entries.length;

        const checkCompletion = () => {
          completed++;
          const progress = (completed / total) * 100;

          onProgress?.({
            stage: "clearing",
            message: `Clearing assets (${completed}/${total})...`,
            progress,
            current: completed,
            total,
          });

          if (completed === total) {
            console.log(`🧹 Cleared ${total} items from assets directory`);
            resolve();
          }
        };

        for (const entry of entries) {
          const fullPath = path.join(assetsDir, entry.name);

          if (entry.isDirectory()) {
            fs.rm(fullPath, { recursive: true, force: true }, (err) => {
              if (err) {
                console.error(`⚠️ Error removing directory ${fullPath}:`, err);
              } else {
                console.log(`🗑️ Removed directory: ${entry.name}`);
              }
              checkCompletion();
            });
          } else {
            fs.unlink(fullPath, (err) => {
              if (err) {
                console.error(`⚠️ Error deleting file ${fullPath}:`, err);
              } else {
                console.log(`🗑️ Deleted file: ${entry.name}`);
              }
              checkCompletion();
            });
          }
        }
      });
    });
  }

  /**
   * Stage 2: Get device information
   */
  private async getDeviceInformation(
    onProgress?: (progress: ProgressCallback) => void
  ): Promise<string | null> {
    onProgress?.({
      stage: "device-info",
      message: "Getting device information...",
      progress: 0,
    });

    try {
      const deviceName = await getDeviceName();

      onProgress?.({
        stage: "device-info",
        message: `Device: ${deviceName || "Unknown"}`,
        progress: 100,
      });

      console.log(`📱 Device name: ${deviceName || "Unknown"}`);
      return deviceName;
    } catch (error) {
      console.error("⚠️ Error getting device name:", error);
      onProgress?.({
        stage: "device-info",
        message: "Device name unavailable",
        progress: 100,
      });
      return null;
    }
  }

  /**
   * Stage 3: Fetch and parse API data
   */
  private async fetchApiData(
    onProgress?: (progress: ProgressCallback) => void
  ): Promise<ApiResponse> {
    onProgress?.({
      stage: "api-fetch",
      message: "Fetching API data...",
      progress: 0,
    });

    try {
      const apiResponse = await getData(this.config.apiURL);

      onProgress?.({
        stage: "api-fetch",
        message: `API data received: ${apiResponse.playlists.length} playlists`,
        progress: 100,
      });

      console.log(
        `📡 API data fetched successfully: ${apiResponse.playlists.length} playlists`
      );
      return apiResponse;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown API error";
      console.error("❌ API fetch failed:", errorMessage);
      throw new Error(`API fetch failed: ${errorMessage}`);
    }
  }

  /**
   * Stage 4: Download and process assets
   */
  private async downloadAndProcessAssets(
    apiResponse: ApiResponse,
    onProgress?: (progress: ProgressCallback) => void
  ): Promise<{
    downloadResults: DownloadResult[];
    playlistCycles: PlaylistCycle[];
  }> {
    onProgress?.({
      stage: "downloading",
      message: "Starting asset download...",
      progress: 0,
    });

    try {
      // Create progress callback for asset downloader
      const assetProgressCallback = this.config.enableProgressTracking
        ? (progress: any) => {
            onProgress?.({
              stage: "downloading",
              message: `Downloading: ${progress.asset.name}`,
              progress: 50, // Rough estimate
              current: 0,
              total: 0,
            });
          }
        : undefined;

      const { results: downloadResults, playlistCycles } = await downloadAssets(
        apiResponse,
        assetProgressCallback
      );

      onProgress?.({
        stage: "downloading",
        message: "Asset processing completed",
        progress: 100,
      });

      console.log(
        `📦 Asset processing completed: ${downloadResults.length} assets processed`
      );
      return { downloadResults, playlistCycles };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown download error";
      console.error("❌ Asset download failed:", errorMessage);
      throw new Error(`Asset download failed: ${errorMessage}`);
    }
  }

  /**
   * Stage 5: Prepare final result
   */
  private prepareFinalResult(
    deviceName: string | null,
    apiResponse: ApiResponse,
    downloadResults: DownloadResult[],
    playlistCycles: PlaylistCycle[]
  ): InitializationResult {
    const successfulDownloads = downloadResults.filter((r) => r.success).length;
    const failedDownloads = downloadResults.filter((r) => !r.success).length;
    const streamsKept = downloadResults.filter(
      (r) =>
        r.success &&
        (r.asset.filetype === "stream" || r.asset.filepath.includes(".m3u8"))
    ).length;
    const defaultPlaylist = playlistCycles.find((p) => p.isDefault);

    const stats = {
      totalAssets: downloadResults.length,
      successfulDownloads,
      failedDownloads,
      streamsKept,
      totalPlaylists: playlistCycles.length,
      initializationTime: Date.now() - this.startTime,
    };

    console.log("📊 Initialization Statistics:", stats);

    return {
      success: true,
      deviceName: deviceName || undefined,
      apiResponse,
      downloadResults,
      playlistCycles,
      defaultPlaylist,
      stats,
    };
  }

  /**
   * Get the default playlist for immediate display
   */
  getDefaultPlaylist(playlistCycles: PlaylistCycle[]): PlaylistCycle | null {
    return playlistCycles.find((p) => p.isDefault) || playlistCycles[0] || null;
  }

  /**
   * Validate initialization result
   */
  validateResult(result: InitializationResult): boolean {
    if (!result.success) {
      console.error("❌ Initialization validation failed:", result.error);
      return false;
    }

    if (!result.playlistCycles || result.playlistCycles.length === 0) {
      console.error("❌ No playlists available for display");
      return false;
    }

    const defaultPlaylist = this.getDefaultPlaylist(result.playlistCycles);
    if (!defaultPlaylist || defaultPlaylist.assets.length === 0) {
      console.error("❌ No assets available in default playlist");
      return false;
    }

    console.log("✅ Initialization validation passed");
    return true;
  }
}

// Convenience function for quick initialization
async function initializeDigitalSignage(
  apiURL: string,
  config?: Partial<InitializationConfig>,
  onProgress?: (progress: ProgressCallback) => void
): Promise<InitializationResult> {
  const initializer = new DigitalSignageInitializer({ apiURL, ...config });
  const result = await initializer.initialize(onProgress);

  if (initializer.validateResult(result)) {
    return result;
  } else {
    return {
      success: false,
      error: "Initialization validation failed",
    };
  }
}

export {
  DigitalSignageInitializer,
  initializeDigitalSignage,
  type InitializationConfig,
  type InitializationResult,
  type ProgressCallback,
};

export default initializeDigitalSignage;
