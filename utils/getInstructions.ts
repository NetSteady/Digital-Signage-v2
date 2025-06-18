interface Asset {
  id: string;
  name: string;
  filepath: string;
  filetype: string;
  playing_order: string;
  time: string;
}

interface Playlist {
  id: string;
  name: string;
  starttime: string | null;
  endtime: string | null;
  startdate: string | null;
  enddate: string | null;
  weekdays: string | null;
  is_default: boolean;
  assets: Asset[];
}

interface Functions {
  is_restarting: boolean;
}

interface ApiResponse {
  functions: Functions;
  playlists: Playlist[];
}

function isValidApiResponse(data: any): data is ApiResponse {
  return (
    data &&
    typeof data === "object" &&
    data.functions &&
    typeof data.functions.is_restarting === "boolean" &&
    Array.isArray(data.playlists) &&
    data.playlists.every(
      (playlist: any) =>
        playlist.id &&
        playlist.name &&
        typeof playlist.is_default === "boolean" &&
        Array.isArray(playlist.assets) &&
        // Validate assets structure too
        playlist.assets.every(
          (asset: any) =>
            asset.id &&
            asset.name &&
            asset.filepath &&
            asset.filetype &&
            asset.playing_order &&
            asset.time
        )
    )
  );
}

async function getData(apiURL: string): Promise<ApiResponse> {
  try {
    const response = await fetch(apiURL);

    // Check if the HTTP request was successful
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status} - ${response.statusText}`
      );
    }

    const data: ApiResponse = await response.json();

    if (!isValidApiResponse(data)) {
      throw new Error("Invalid API response format");
    }

    return data;
  } catch (error) {
    // Re-throw with more context if it's a fetch error
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(`Network error: Unable to fetch data from ${apiURL}`);
    }

    throw error;
  }
}

export type { ApiResponse, Asset, Functions, Playlist };
export default getData;
