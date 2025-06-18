# Digital Signage Application

A modern, cross-platform digital signage solution built with React Native and Expo, specifically optimized for Android TV deployment. This application displays dynamic content including images, videos, audio, text, and live streams in an automated playlist cycle for commercial and enterprise digital signage environments.

## Features

- **Multi-Media Support**: Display images, videos, audio, text, and HLS streams
- **Automated Playlists**: Cycle through content with customizable timing and scheduling
- **Cross-Platform Compatibility**: Works on Android TV, iOS, Android, and Web platforms
- **Remote Content Management**: Fetch playlists and assets from remote API endpoints
- **Local Asset Caching**: Download and cache content for offline playback and reliability
- **Progress Tracking**: Real-time initialization and download progress monitoring
- **Error Handling**: Graceful error recovery and user-friendly error display
- **TV Optimization**: Specifically designed for Android TV with remote-friendly interface
- **Performance Monitoring**: Built-in performance tracking and memory management

## Architecture

```
DigitalSignage/
├── app/                    # Main application screens
│   ├── _layout.tsx        # Root layout configuration
│   └── index.tsx          # Main signage display screen
├── components/            # Reusable React components
│   └── SignageWebview.tsx # WebView-based content display
├── utils/                 # Utility functions and services
│   ├── assetDownloader.ts # Asset download and playlist management
│   ├── deviceInfo.ts      # Device information utilities
│   ├── getInstructions.ts # API communication
│   ├── initialization.ts  # App initialization logic
│   └── tvFileSystem.ts    # TV-specific file system operations
└── assets/               # Static assets and downloaded content
```

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Expo CLI
- Android TV device or emulator (for TV testing)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/digital-signage.git
   cd digital-signage
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure your API endpoint**

   Edit `app/index.tsx` and update the API URL:

   ```typescript
   const apiURL = "https://your-api-endpoint.com/signage-data";
   ```

4. **Start the development server**
   ```bash
   npx expo start
   ```

## Platform Support

### Android TV (Primary Target)

- Fully optimized for Android TV deployment
- Landscape orientation configuration
- Remote control navigation support
- TV-specific file system operations
- Optimized video playback performance
- Memory management for long-running displays

### Other Platforms

- iOS (iPhone/iPad) - Full compatibility
- Android (Phone/Tablet) - Full compatibility
- Web Browser - Limited functionality
- Note: Touch interactions are limited on TV platforms

## Configuration

### Application Configuration (`app.json`)

```json
{
  "expo": {
    "name": "DigitalSignage",
    "orientation": "landscape",
    "android": {
      "usesCleartextTraffic": true,
      "edgeToEdgeEnabled": true
    },
    "plugins": ["@react-native-tvos/config-tv"]
  }
}
```

### API Response Format

Your API should return data in the following JSON format:

```json
{
  "deviceName": "TV-001",
  "playlists": [
    {
      "id": "playlist-1",
      "name": "Main Display",
      "isDefault": true,
      "startdate": "2024-01-01T09:00:00Z",
      "enddate": "2024-12-31T18:00:00Z",
      "assets": [
        {
          "id": "asset-1",
          "name": "Welcome Image",
          "filetype": "image",
          "filepath": "https://example.com/image.jpg",
          "playing_order": 1,
          "time": 10
        }
      ]
    }
  ]
}
```

### Date Scheduling

The application supports playlist scheduling with start and end dates:

- **startdate**: ISO 8601 date string when the playlist should become active
- **enddate**: ISO 8601 date string when the playlist should stop being active
- **Automatic Selection**: The app automatically selects the appropriate playlist based on current time
- **Fallback Logic**: If no playlists are active, the app will show the next scheduled playlist with countdown
- **Real-time Monitoring**: Playlists are automatically stopped when their end date is reached

## Usage

### Android TV Deployment

1. **Build for production**

   ```bash
   expo build:android --platform android
   ```

2. **Install on Android TV**

   ```bash
   adb install app-release.apk
   ```

3. **Monitor application logs**
   ```bash
   adb logcat | grep -E "(ReactNative|Expo|DigitalSignage)"
   ```

### Content Management

The application automatically handles:

- Playlist data retrieval from configured API endpoints
- Media asset download and local caching
- Content cycling based on configured display times
- Network error handling and recovery
- Local storage management and optimization

## Testing

Use our comprehensive testing checklist for Android TV deployment:

```bash
# Access the testing checklist
cat TV_TESTING_CHECKLIST.md
```

### Key Testing Areas

- Build configuration validation
- File system operations verification
- Network connectivity testing
- Video playback performance
- Memory usage monitoring
- Error handling validation

## Troubleshooting

### Common Issues

**White Screen on TV Display**

- Verify WebView configuration settings
- Check file paths and permissions
- Ensure proper asset loading

**Network Connectivity Errors**

- Confirm `usesCleartextTraffic` setting is enabled
- Verify API endpoint accessibility
- Check network security policies

**Video Playback Issues**

- Verify video format compatibility
- Check file permissions and paths
- Monitor hardware performance limitations

**Memory Management Issues**

- Monitor memory usage during extended operation
- Consider reducing video quality for limited TV hardware
- Implement memory cleanup procedures

### Debug Commands

```bash
# Monitor application logs
adb logcat | grep -E "(ReactNative|Expo|DigitalSignage)"

# Verify file system structure
adb shell ls -la /data/data/com.yourpackage/files/assets/

# Monitor memory usage
adb shell dumpsys meminfo com.yourpackage

# Check network connectivity
adb shell ping your-api-endpoint.com
```

## Dependencies

### Core Dependencies

- `expo`: ~53.0.11
- `react-native-tvos`: Latest
- `react-native-webview`: ^13.13.5
- `expo-file-system`: ~18.0.0
- `react-native-device-info`: ^14.0.4

### TV-Specific Dependencies

- `@react-native-tvos/config-tv`: ^0.1.3

## Performance Specifications

### Recommended Hardware Requirements

- **RAM**: Minimum 2GB, Recommended 4GB
- **Storage**: Minimum 8GB available space
- **Network**: Stable internet connection for content updates
- **Display**: 1080p or higher resolution support

### Performance Benchmarks

- **Application Startup**: < 10 seconds
- **Asset Loading**: < 5 seconds per asset
- **Video Playback**: Smooth 30fps performance
- **Memory Usage**: < 200MB during operation
- **Battery Impact**: Minimal (designed for plugged-in operation)

## Contributing

We welcome contributions to improve the Digital Signage application. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and conventions
- Add appropriate error handling
- Include unit tests for new features
- Update documentation as needed
- Test on target platforms before submitting

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For technical support and assistance:

- **Email Support**: support@yourcompany.com
- **Issue Tracking**: [GitHub Issues](https://github.com/yourusername/digital-signage/issues)
- **Documentation**: [Project Wiki](https://github.com/yourusername/digital-signage/wiki)
- **Community**: [Discussions](https://github.com/yourusername/digital-signage/discussions)

## Acknowledgments

- Built with [Expo](https://expo.dev) framework
- React Native TV support from [react-native-tvos](https://github.com/react-native-tvos/react-native-tvos)
- Icon library from [@expo/vector-icons](https://expo.github.io/vector-icons/)

---

**Digital Signage Application - Enterprise-Ready Digital Display Solution**
