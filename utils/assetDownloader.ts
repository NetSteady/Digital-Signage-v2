import * as fs from "fs";
import * as path from "path";
import { ApiResponse, Asset } from "./getInstructions";

interface WebviewAsset {
  id: string;
  name: string;
  filetype: string;
  playing_order: number; // Convert to number for easier sorting
  displayTime: number; // Convert to number (seconds) for cycling
  displayPath: string; // URL for streams, local path for files
  isStream: boolean;
  originalPath: string;
}

interface PlaylistCycle {
  playlistId: string;
  playlistName: string;
  assets: WebviewAsset[];
  totalCycleDuration: number; // Total time for complete cycle in seconds
  isDefault: boolean;
  startDate?: string | null; // ISO date string when cycle should start
  endDate?: string | null; // ISO date string when cycle should end
}

interface DownloadResult {
  asset: Asset;
  success: boolean;
  error?: string;
  localPath?: string;
}

interface DownloadProgress {
  current: number;
  total: number;
  asset: Asset;
  status: "downloading" | "completed" | "failed";
}

type ProgressCallback = (progress: DownloadProgress) => void;

class AssetDownloader {
  private assetsDir: string;

  constructor(assetsDir: string = "./assets/main") {
    this.assetsDir = assetsDir;
  }

  // Ensure the assets directory exists
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.assetsDir)) {
      fs.mkdirSync(this.assetsDir, { recursive: true });
      console.log(`Created directory: ${this.assetsDir}`);
    }
  }

  // Generate a safe filename from the asset
  private generateSafeFilename(asset: Asset): string {
    // Extract filename from URL or use asset name
    let filename = asset.name;

    // If filepath is a URL, try to extract filename from it
    if (asset.filepath.startsWith("http")) {
      const url = new URL(asset.filepath);
      const pathParts = url.pathname.split("/");
      const urlFilename = pathParts[pathParts.length - 1];

      if (urlFilename && urlFilename.includes(".")) {
        filename = urlFilename;
      }
    }

    // Clean filename and ensure it has an extension
    filename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");

    // Add extension based on filetype if not present
    if (!filename.includes(".")) {
      const extension = this.getExtensionFromFiletype(asset.filetype);
      filename += extension;
    }

    // Prefix with asset ID to avoid conflicts
    return `${asset.id}_${filename}`;
  }

  // Get file extension from filetype
  private getExtensionFromFiletype(filetype: string): string {
    const extensions: { [key: string]: string } = {
      stream: ".m3u8",
      video: ".mp4",
      audio: ".mp3",
      image: ".jpg",
      text: ".txt",
    };

    return extensions[filetype.toLowerCase()] || ".bin";
  }

  // Download a single asset (or keep stream URLs for webview)
  async downloadAsset(
    asset: Asset,
    retries: number = 3,
    onProgress?: ProgressCallback
  ): Promise<DownloadResult> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(
          `Processing asset: ${asset.name} (ID: ${asset.id})${
            attempt > 1 ? ` (attempt ${attempt}/${retries})` : ""
          }`
        );

        // Notify progress
        onProgress?.({
          current: 0,
          total: 0,
          asset,
          status: "downloading",
        });

        // For streams, just validate the URL and keep it as-is for webview
        if (asset.filetype === "stream" || asset.filepath.includes(".m3u8")) {
          console.log(`✓ Stream asset kept as URL: ${asset.name}`);

          // Optionally validate that the stream is accessible
          try {
            const response = await fetch(asset.filepath, { method: "HEAD" });
            if (!response.ok) {
              throw new Error(`Stream not accessible: ${response.status}`);
            }
          } catch (error) {
            console.warn(
              `⚠ Stream validation failed for ${asset.name}: ${error}`
            );
          }

          // Notify completion
          onProgress?.({
            current: 1,
            total: 1,
            asset,
            status: "completed",
          });

          return {
            asset,
            success: true,
            localPath: asset.filepath, // Keep original URL for streams
          };
        }

        // For non-stream assets, download as before
        const response = await fetch(asset.filepath);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const filename = this.generateSafeFilename(asset);
        const localPath = path.join(this.assetsDir, filename);

        // Download binary files
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Write file to disk
        fs.writeFileSync(localPath, buffer);

        console.log(`✓ Downloaded: ${filename}`);

        // Notify completion
        onProgress?.({
          current: 1,
          total: 1,
          asset,
          status: "completed",
        });

        return {
          asset,
          success: true,
          localPath,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        if (attempt === retries) {
          console.error(
            `✗ Failed to process ${asset.name} after ${retries} attempts: ${errorMessage}`
          );

          // Notify failure
          onProgress?.({
            current: 0,
            total: 0,
            asset,
            status: "failed",
          });

          return {
            asset,
            success: false,
            error: errorMessage,
          };
        } else {
          console.warn(
            `⚠ Attempt ${attempt} failed for ${asset.name}: ${errorMessage}. Retrying...`
          );
          // Wait before retry (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      asset,
      success: false,
      error: "Unexpected error in retry loop",
    };
  }

  // Process all assets from API response (download files, keep stream URLs)
  async downloadAllAssets(
    apiResponse: ApiResponse,
    onProgress?: ProgressCallback
  ): Promise<DownloadResult[]> {
    this.ensureDirectoryExists();

    // Extract all assets from all playlists
    const allAssets = apiResponse.playlists.flatMap(
      (playlist) => playlist.assets
    );

    // Separate streams from downloadable assets
    const streamAssets = allAssets.filter(
      (asset) => asset.filetype === "stream" || asset.filepath.includes(".m3u8")
    );
    const downloadableAssets = allAssets.filter(
      (asset) =>
        asset.filetype !== "stream" && !asset.filepath.includes(".m3u8")
    );

    console.log(`Processing ${allAssets.length} assets:`);
    console.log(`  - ${streamAssets.length} streams (keeping as URLs)`);
    console.log(`  - ${downloadableAssets.length} files (downloading)`);

    const results: DownloadResult[] = [];

    // Process all assets
    for (let i = 0; i < allAssets.length; i++) {
      const asset = allAssets[i];
      const result = await this.downloadAsset(asset, 3, onProgress);
      results.push(result);

      // Small delay between downloads (skip for stream validation)
      if (asset.filetype !== "stream" && !asset.filepath.includes(".m3u8")) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const streamsKept = results.filter(
      (r) =>
        r.success &&
        (r.asset.filetype === "stream" || r.asset.filepath.includes(".m3u8"))
    ).length;
    const filesDownloaded = results.filter(
      (r) =>
        r.success &&
        r.asset.filetype !== "stream" &&
        !r.asset.filepath.includes(".m3u8")
    ).length;

    console.log(`\nProcessing complete:`);
    console.log(`  - ${streamsKept} streams kept as URLs`);
    console.log(`  - ${filesDownloaded} files downloaded`);
    console.log(`  - ${failed} failed`);

    if (failed > 0) {
      console.log("Failed assets:");
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.asset.name}: ${r.error}`);
        });
    }

    return results;
  }

  // Download assets in parallel (use with caution)
  async downloadAllAssetsParallel(
    apiResponse: ApiResponse,
    concurrency: number = 3,
    onProgress?: ProgressCallback
  ): Promise<DownloadResult[]> {
    this.ensureDirectoryExists();

    const allAssets = apiResponse.playlists.flatMap(
      (playlist) => playlist.assets
    );

    console.log(
      `Starting parallel download of ${allAssets.length} assets with concurrency ${concurrency}...`
    );

    const results: DownloadResult[] = [];

    // Process assets in batches
    for (let i = 0; i < allAssets.length; i += concurrency) {
      const batch = allAssets.slice(i, i + concurrency);
      const batchPromises = batch.map((asset) =>
        this.downloadAsset(asset, 3, onProgress)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      console.log(
        `Completed batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(
          allAssets.length / concurrency
        )}`
      );
    }

    // Summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `\nParallel download complete: ${successful} successful, ${failed} failed`
    );

    return results;
  }

  // Prepare assets for webview display with cycling support
  prepareAssetsForWebview(results: DownloadResult[]): WebviewAsset[] {
    return results
      .filter((r) => r.success)
      .map((r) => {
        const isStream =
          r.asset.filetype === "stream" || r.asset.filepath.includes(".m3u8");

        return {
          id: r.asset.id,
          name: r.asset.name,
          filetype: r.asset.filetype,
          playing_order: parseInt(r.asset.playing_order, 10),
          displayTime: parseInt(r.asset.time, 10), // Convert to seconds
          // Use original URL for streams, local path for downloaded files
          displayPath: isStream ? r.asset.filepath : r.localPath!,
          isStream: isStream,
          originalPath: r.asset.filepath,
        };
      })
      .sort((a, b) => a.playing_order - b.playing_order);
  }

  // Prepare playlists for cycling
  preparePlaylistsForCycling(
    apiResponse: ApiResponse,
    results: DownloadResult[]
  ): PlaylistCycle[] {
    return apiResponse.playlists
      .map((playlist) => {
        // Get successful assets for this playlist
        const playlistAssets = playlist.assets
          .map((asset) => {
            const result = results.find(
              (r) => r.asset.id === asset.id && r.success
            );
            if (!result) return null;

            const isStream =
              asset.filetype === "stream" || asset.filepath.includes(".m3u8");

            return {
              id: asset.id,
              name: asset.name,
              filetype: asset.filetype,
              playing_order: parseInt(asset.playing_order, 10),
              displayTime: parseInt(asset.time, 10),
              displayPath: isStream ? asset.filepath : result.localPath!,
              isStream: isStream,
              originalPath: asset.filepath,
            };
          })
          .filter((asset): asset is WebviewAsset => asset !== null)
          .sort((a, b) => a.playing_order - b.playing_order);

        // Calculate total cycle duration
        const totalCycleDuration = playlistAssets.reduce(
          (sum, asset) => sum + asset.displayTime,
          0
        );

        return {
          playlistId: playlist.id,
          playlistName: playlist.name,
          assets: playlistAssets,
          totalCycleDuration,
          isDefault: playlist.is_default,
          startDate: playlist.startdate,
          endDate: playlist.enddate,
        };
      })
      .filter((playlist) => playlist.assets.length > 0); // Only include playlists with valid assets
  }

  // Create a webview-ready manifest with cycling information
  createWebviewManifest(
    apiResponse: ApiResponse,
    results: DownloadResult[]
  ): void {
    const playlistCycles = this.preparePlaylistsForCycling(
      apiResponse,
      results
    );
    const allAssets = this.prepareAssetsForWebview(results);

    const manifest = {
      generatedDate: new Date().toISOString(),
      totalAssets: results.length,
      readyForPlayback: allAssets.length,
      streams: allAssets.filter((a) => a.isStream).length,
      localFiles: allAssets.filter((a) => !a.isStream).length,
      playlists: playlistCycles,
      // Global assets (flat list)
      assets: allAssets,
      // Cycling information
      cyclingInfo: {
        defaultPlaylist: playlistCycles.find((p) => p.isDefault),
        totalPlaylists: playlistCycles.length,
        longestCycle: Math.max(
          ...playlistCycles.map((p) => p.totalCycleDuration)
        ),
        shortestCycle: Math.min(
          ...playlistCycles.map((p) => p.totalCycleDuration)
        ),
      },
    };

    const manifestPath = path.join(this.assetsDir, "webview-manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Webview manifest created: ${manifestPath}`);

    // Log cycling information
    console.log("\nPlaylist Cycling Information:");
    playlistCycles.forEach((playlist) => {
      console.log(
        `  ${playlist.playlistName} (${
          playlist.isDefault ? "DEFAULT" : "CUSTOM"
        }):`
      );
      console.log(`    - ${playlist.assets.length} assets`);
      console.log(`    - ${playlist.totalCycleDuration}s total cycle time`);

      // Display date information
      if (playlist.startDate) {
        console.log(`    - Start Date: ${playlist.startDate}`);
      }
      if (playlist.endDate) {
        console.log(`    - End Date: ${playlist.endDate}`);
      }

      playlist.assets.forEach((asset) => {
        console.log(`      → ${asset.name}: ${asset.displayTime}s`);
      });
    });
  }
}

// Usage example with cycling support
async function downloadAssets(
  apiResponse: ApiResponse,
  onProgress?: ProgressCallback
) {
  const downloader = new AssetDownloader("./assets/main");

  try {
    // Process all assets
    const results = await downloader.downloadAllAssets(apiResponse, onProgress);

    // Create webview manifest with cycling information
    downloader.createWebviewManifest(apiResponse, results);

    // Get playlist cycles for your webview
    const playlistCycles = downloader.preparePlaylistsForCycling(
      apiResponse,
      results
    );

    return { results, playlistCycles };
  } catch (error) {
    console.error("Error processing assets:", error);
    throw error;
  }
}

// Utility class for managing asset cycling in webview
class AssetCycler {
  private currentPlaylist: PlaylistCycle;
  private currentAssetIndex: number = 0;
  private cycleTimer: NodeJS.Timeout | null = null;
  private onAssetChange: (asset: WebviewAsset, remainingTime: number) => void;
  private dateCheckTimer: NodeJS.Timeout | null = null;

  constructor(
    playlist: PlaylistCycle,
    onAssetChange: (asset: WebviewAsset, remainingTime: number) => void
  ) {
    this.currentPlaylist = playlist;
    this.onAssetChange = onAssetChange;
  }

  // Check if playlist should be active based on date constraints
  private isPlaylistActive(): boolean {
    const now = new Date();

    // Check start date
    if (this.currentPlaylist.startDate) {
      const startDate = new Date(this.currentPlaylist.startDate);
      if (now < startDate) {
        console.log(
          `Playlist ${
            this.currentPlaylist.playlistName
          } not yet active (starts: ${startDate.toISOString()})`
        );
        return false;
      }
    }

    // Check end date
    if (this.currentPlaylist.endDate) {
      const endDate = new Date(this.currentPlaylist.endDate);
      if (now > endDate) {
        console.log(
          `Playlist ${
            this.currentPlaylist.playlistName
          } has ended (ended: ${endDate.toISOString()})`
        );
        return false;
      }
    }

    return true;
  }

  // Start the cycling
  startCycle(): void {
    if (this.currentPlaylist.assets.length === 0) {
      console.warn("No assets to cycle through");
      return;
    }

    // Check if playlist should be active
    if (!this.isPlaylistActive()) {
      console.log(
        `Playlist ${this.currentPlaylist.playlistName} is not active due to date constraints`
      );
      return;
    }

    this.showCurrentAsset();

    // Set up periodic date checking (every minute)
    this.dateCheckTimer = setInterval(() => {
      if (!this.isPlaylistActive()) {
        console.log(
          `Stopping playlist ${this.currentPlaylist.playlistName} due to date constraints`
        );
        this.stopCycle();
      }
    }, 60000); // Check every minute
  }

  // Stop the cycling
  stopCycle(): void {
    if (this.cycleTimer) {
      clearTimeout(this.cycleTimer);
      this.cycleTimer = null;
    }

    if (this.dateCheckTimer) {
      clearInterval(this.dateCheckTimer);
      this.dateCheckTimer = null;
    }
  }

  // Show current asset and set timer for next
  private showCurrentAsset(): void {
    const currentAsset = this.currentPlaylist.assets[this.currentAssetIndex];
    const displayTime = currentAsset.displayTime * 1000; // Convert to milliseconds

    console.log(
      `Displaying: ${currentAsset.name} for ${currentAsset.displayTime}s`
    );

    // Notify the webview
    this.onAssetChange(currentAsset, currentAsset.displayTime);

    // Set timer for next asset
    this.cycleTimer = setTimeout(() => {
      this.nextAsset();
    }, displayTime);
  }

  // Move to next asset
  private nextAsset(): void {
    this.currentAssetIndex =
      (this.currentAssetIndex + 1) % this.currentPlaylist.assets.length;
    this.showCurrentAsset();
  }

  // Get current asset
  getCurrentAsset(): WebviewAsset | null {
    if (this.currentPlaylist.assets.length === 0) return null;
    return this.currentPlaylist.assets[this.currentAssetIndex];
  }

  // Skip to specific asset
  skipToAsset(assetId: string): boolean {
    const index = this.currentPlaylist.assets.findIndex(
      (asset) => asset.id === assetId
    );
    if (index === -1) return false;

    this.stopCycle();
    this.currentAssetIndex = index;
    this.showCurrentAsset();
    return true;
  }

  // Get playlist info
  getPlaylistInfo(): {
    name: string;
    totalDuration: number;
    assetCount: number;
    startDate?: string | null;
    endDate?: string | null;
    isActive: boolean;
  } {
    return {
      name: this.currentPlaylist.playlistName,
      totalDuration: this.currentPlaylist.totalCycleDuration,
      assetCount: this.currentPlaylist.assets.length,
      startDate: this.currentPlaylist.startDate,
      endDate: this.currentPlaylist.endDate,
      isActive: this.isPlaylistActive(),
    };
  }

  // Get date status information
  getDateStatus(): {
    isActive: boolean;
    startDate?: string | null;
    endDate?: string | null;
    timeUntilStart?: number | null;
    timeUntilEnd?: number | null;
  } {
    const now = new Date();
    const isActive = this.isPlaylistActive();

    let timeUntilStart: number | null = null;
    let timeUntilEnd: number | null = null;

    if (this.currentPlaylist.startDate) {
      const startDate = new Date(this.currentPlaylist.startDate);
      timeUntilStart = Math.max(0, startDate.getTime() - now.getTime());
    }

    if (this.currentPlaylist.endDate) {
      const endDate = new Date(this.currentPlaylist.endDate);
      timeUntilEnd = Math.max(0, endDate.getTime() - now.getTime());
    }

    return {
      isActive,
      startDate: this.currentPlaylist.startDate,
      endDate: this.currentPlaylist.endDate,
      timeUntilStart,
      timeUntilEnd,
    };
  }
}

// Export for use in other modules
export {
  AssetCycler,
  AssetDownloader,
  DownloadResult,
  PlaylistCycle,
  WebviewAsset,
};

export default downloadAssets;
