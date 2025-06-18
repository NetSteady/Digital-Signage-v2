import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

// TV-specific file system operations
export class TVFileSystem {
  private assetsDir: string;

  constructor(assetsDir: string = "assets/main") {
    this.assetsDir = assetsDir;
  }

  // Ensure the assets directory exists
  async ensureDirectoryExists(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.assetsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.assetsDir, {
          intermediates: true,
        });
        console.log(`Created directory: ${this.assetsDir}`);
      }
    } catch (error) {
      console.error("Error creating directory:", error);
      throw error;
    }
  }

  // Clear assets directory
  async clearAssetsDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.assetsDir);
      if (dirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(this.assetsDir);
        for (const file of files) {
          const filePath = `${this.assetsDir}/${file}`;
          await FileSystem.deleteAsync(filePath);
          console.log(`Deleted file: ${file}`);
        }
      }
    } catch (error) {
      console.error("Error clearing assets directory:", error);
      throw error;
    }
  }

  // Write file to assets directory
  async writeFile(
    filename: string,
    data: string | ArrayBuffer
  ): Promise<string> {
    try {
      const filePath = `${this.assetsDir}/${filename}`;

      if (data instanceof ArrayBuffer) {
        // Convert ArrayBuffer to base64 for FileSystem
        const uint8Array = new Uint8Array(data);
        const base64 = btoa(String.fromCharCode(...uint8Array));
        await FileSystem.writeAsStringAsync(filePath, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        await FileSystem.writeAsStringAsync(filePath, data);
      }

      return filePath;
    } catch (error) {
      console.error("Error writing file:", error);
      throw error;
    }
  }

  // Check if file exists
  async fileExists(filename: string): Promise<boolean> {
    try {
      const filePath = `${this.assetsDir}/${filename}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists;
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
  }

  // Get file URI for WebView
  getFileURI(filePath: string): string {
    if (Platform.OS === "android") {
      return `file://${FileSystem.documentDirectory}${filePath}`;
    }
    return `file://${filePath}`;
  }
}

export default TVFileSystem;
